const fs = require('fs');
const fsp = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const { execFile } = require('child_process');
const Bird = require('../models/birdModel');
const UserSettings = require('../models/userSettingsModel');
const { canonicalizeBirdName } = require('../../data/birdNameAliases');
const { sendControllerError } = require('../middleware/controllerError');
const { clearCache } = require('../middleware/cache');
const {
  IMAGE_MIME_TO_EXT,
  buildSafeImageFileName,
  getActiveUploadsRoot,
  resolveActiveUploadUrl,
  isPathInside,
} = require('../utils/safeUploadPath');

const LARGE_BYTES = 5 * 1024 * 1024;
const MAX_FOLDERS = 2500;
const MAX_FILES = 8000;
const MAX_SCAN_DEPTH = 4;
const IMAGE_EXT_TO_MIME = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
};

const hashFile = (absPath) =>
  new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    const stream = fs.createReadStream(absPath);
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('end', () => resolve(hash.digest('hex')));
    stream.on('error', reject);
  });

const assertSafeRoot = async (rawPath) => {
  const trimmed = String(rawPath || '').trim();
  if (!trimmed) {
    const error = new Error('请填写本机分类照片文件夹');
    error.statusCode = 400;
    error.code = 'FOLDER_PHOTOS_ROOT_REQUIRED';
    throw error;
  }
  const resolved = path.resolve(trimmed);
  if (!path.isAbsolute(resolved)) {
    const error = new Error('请使用绝对路径，例如 C:\\path\\to\\bird-photos');
    error.statusCode = 400;
    error.code = 'FOLDER_PHOTOS_ROOT_INVALID';
    throw error;
  }
  const lower = resolved.toLowerCase();
  const blocked = ['\\windows\\', '/windows/', '\\program files', '/usr/', '/etc/', '\\$recycle.bin'];
  if (blocked.some((item) => lower.includes(item))) {
    const error = new Error('这个路径不能用作照片库');
    error.statusCode = 400;
    error.code = 'FOLDER_PHOTOS_ROOT_BLOCKED';
    throw error;
  }
  let stat;
  try {
    stat = await fsp.stat(resolved);
  } catch {
    const error = new Error('找不到这个文件夹，请确认路径');
    error.statusCode = 400;
    error.code = 'FOLDER_PHOTOS_ROOT_MISSING';
    throw error;
  }
  if (!stat.isDirectory()) {
    const error = new Error('路径不是文件夹');
    error.statusCode = 400;
    error.code = 'FOLDER_PHOTOS_ROOT_NOT_DIR';
    throw error;
  }
  return resolved;
};

const PICK_FOLDER_SCRIPT = `
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
Add-Type -AssemblyName System.Windows.Forms
$form = New-Object System.Windows.Forms.Form
$form.TopMost = $true
$form.WindowState = 'Minimized'
$form.ShowInTaskbar = $false
$form.Show()
$dialog = New-Object System.Windows.Forms.FolderBrowserDialog
$dialog.Description = '选择分类照片总文件夹（里面是各鸟种子文件夹）'
$dialog.ShowNewFolderButton = $false
try { $dialog.UseDescriptionForTitle = $true } catch {}
$start = $env:KBIRD_FOLDER_START
if ($start) { $dialog.SelectedPath = $start }
$result = $dialog.ShowDialog($form)
$form.Close()
$form.Dispose()
if ($result -eq [System.Windows.Forms.DialogResult]::OK) {
  [System.Console]::Out.Write($dialog.SelectedPath)
}
`;

const pickFolderWithDialog = (startPath) =>
  new Promise((resolve, reject) => {
    if (process.platform !== 'win32') {
      const error = new Error('请先填写本机总文件夹路径，再扫描');
      error.statusCode = 400;
      error.code = 'FOLDER_PHOTOS_PICK_UNSUPPORTED';
      reject(error);
      return;
    }
    execFile(
      'powershell.exe',
      ['-NoProfile', '-STA', '-ExecutionPolicy', 'Bypass', '-Command', PICK_FOLDER_SCRIPT],
      {
        encoding: 'utf8',
        windowsHide: false,
        timeout: 180000,
        maxBuffer: 64 * 1024,
        env: {
          ...process.env,
          KBIRD_FOLDER_START: String(startPath || '').slice(0, 500),
        },
      },
      (error, stdout) => {
        if (error && error.killed) {
          const timedOut = new Error('选择文件夹超时，请再试一次');
          timedOut.statusCode = 408;
          timedOut.code = 'FOLDER_PHOTOS_PICK_TIMEOUT';
          reject(timedOut);
          return;
        }
        if (error) {
          const failed = new Error('打不开文件夹选择窗，请改用路径粘贴');
          failed.statusCode = 500;
          failed.code = 'FOLDER_PHOTOS_PICK_FAILED';
          reject(failed);
          return;
        }
        resolve(String(stdout || '').trim());
      }
    );
  });

const saveRootPath = async (userId, rootPath) => {
  let settings = await UserSettings.findOne({ userId });
  if (!settings) settings = await UserSettings.create({ userId });
  settings.localBirdPhotoRoot = String(rootPath || '').slice(0, 500);
  await settings.save();
};

const matchBird = (folderName, maps) => {
  const raw = String(folderName || '').trim();
  const canonical = canonicalizeBirdName(raw);
  return maps.byName.get(raw) || maps.byName.get(canonical) || null;
};

const buildBirdMaps = (birds) => {
  const byName = new Map();
  const byId = new Map();
  birds.forEach((bird) => {
    byId.set(String(bird._id), bird);
    const main = String(bird.name || '').trim();
    if (main && !byName.has(main)) byName.set(main, bird);
    const canonical = canonicalizeBirdName(main);
    if (canonical && !byName.has(canonical)) byName.set(canonical, bird);
    (bird.nameAliases || []).forEach((alias) => {
      const key = String(alias || '').trim();
      if (key && !byName.has(key)) byName.set(key, bird);
    });
  });
  return { byName, byId };
};

const collectExistingHashes = async (bird) => {
  const hashes = new Set();
  const names = new Set();
  for (const image of bird.images || []) {
    if (image.sourceHash) hashes.add(String(image.sourceHash));
    if (image.sourceFileName) names.add(`${image.sourceFileName}|${image.sourceBytes || 0}`);
    const resolved = resolveActiveUploadUrl(image.url);
    if (!resolved?.absPath || image.sourceHash) continue;
    try {
      const digest = await hashFile(resolved.absPath);
      hashes.add(digest);
    } catch {
      /* skip missing file */
    }
  }
  return { hashes, names };
};

const isImageFile = (entry) => {
  if (!entry.isFile() || entry.name.startsWith('.')) return false;
  const ext = path.extname(entry.name).toLowerCase();
  return Boolean(IMAGE_EXT_TO_MIME[ext]);
};

const walkSpeciesFolders = async (dir, rel, depth, maps, acc) => {
  const entries = await fsp.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name.startsWith('.')) continue;
    const relPath = rel ? `${rel}/${entry.name}` : entry.name;
    const abs = path.join(dir, entry.name);
    const bird = matchBird(entry.name, maps);
    if (bird) {
      acc.species.push({ name: entry.name, relPath, abs, bird });
      continue;
    }
    if (depth >= MAX_SCAN_DEPTH) continue;
    const children = await fsp.readdir(abs, { withFileTypes: true });
    const imageFiles = children.filter(isImageFile);
    const subdirs = children.filter((child) => child.isDirectory() && !child.name.startsWith('.'));
    if (imageFiles.length && !subdirs.length) {
      acc.unmatched.push({ folder: relPath, fileCount: imageFiles.length, abs });
      continue;
    }
    if (imageFiles.length) {
      acc.unmatched.push({ folder: relPath, fileCount: imageFiles.length, abs });
    }
    await walkSpeciesFolders(abs, relPath, depth + 1, maps, acc);
  }
};

const scanRoot = async (rootPath) => {
  const birds = await Bird.find({})
    .select('_id name scientificName nameAliases images')
    .limit(5000)
    .lean();
  const maps = buildBirdMaps(birds);
  const acc = { species: [], unmatched: [] };
  await walkSpeciesFolders(rootPath, '', 0, maps, acc);

  if (acc.species.length > MAX_FOLDERS) {
    const error = new Error(`鸟种文件夹超过 ${MAX_FOLDERS} 个，请先缩小范围`);
    error.statusCode = 400;
    error.code = 'FOLDER_PHOTOS_TOO_MANY_FOLDERS';
    throw error;
  }

  const matched = [];
  const unmatched = acc.unmatched.map((item) => ({
    folder: item.folder,
    fileCount: item.fileCount,
  }));
  const largeFiles = [];
  let fileCount = 0;

  for (const folder of acc.species) {
    const files = (await fsp.readdir(folder.abs, { withFileTypes: true })).filter(isImageFile);
    fileCount += files.length;
    if (fileCount > MAX_FILES) {
      const error = new Error(`照片超过 ${MAX_FILES} 张，请分批放进文件夹再扫`);
      error.statusCode = 400;
      error.code = 'FOLDER_PHOTOS_TOO_MANY_FILES';
      throw error;
    }

    if (!files.length) continue;

    const existing = await collectExistingHashes(folder.bird);
    const photos = [];
    for (const file of files) {
      const absPath = path.join(folder.abs, file.name);
      const stat = await fsp.stat(absPath);
      const hash = await hashFile(absPath);
      const duplicate =
        existing.hashes.has(hash) || existing.names.has(`${file.name}|${stat.size}`);
      const large = stat.size > LARGE_BYTES;
      if (large) {
        largeFiles.push({
          folder: folder.relPath,
          birdName: folder.bird.name,
          fileName: file.name,
          bytes: stat.size,
        });
      }
      photos.push({
        fileName: file.name,
        bytes: stat.size,
        hash,
        duplicate,
        large,
      });
    }

    matched.push({
      folder: folder.relPath,
      birdId: String(folder.bird._id),
      birdName: folder.bird.name,
      photos,
      totalCount: photos.length,
      newCount: photos.filter((item) => !item.duplicate).length,
      duplicateCount: photos.filter((item) => item.duplicate).length,
      largeCount: photos.filter((item) => item.large && !item.duplicate).length,
    });
  }

  return {
    matched,
    unmatched,
    largeFiles,
    folderCount: acc.species.length,
    fileCount,
  };
};

const pickFolderPhotos = async (req, res) => {
  try {
    const userId = req.user._id || req.user.id;
    const settings = await UserSettings.findOne({ userId });
    const picked = await pickFolderWithDialog(settings?.localBirdPhotoRoot || req.body?.rootPath);
    if (!picked) {
      return res.status(200).json({
        success: true,
        data: { cancelled: true, rootPath: '' },
      });
    }
    const rootPath = await assertSafeRoot(picked);
    await saveRootPath(userId, rootPath);
    return res.status(200).json({
      success: true,
      data: { cancelled: false, rootPath },
    });
  } catch (error) {
    return sendControllerError(res, error, {
      defaultMessage: '选择文件夹失败',
      defaultCode: error.code || 'FOLDER_PHOTOS_PICK_FAILED',
    });
  }
};

const previewFolderPhotos = async (req, res) => {
  try {
    const rootPath = await assertSafeRoot(req.body?.rootPath);
    const userId = req.user._id || req.user.id;
    await saveRootPath(userId, rootPath);

    const scanned = await scanRoot(rootPath);
    return res.status(200).json({
      success: true,
      data: {
        rootPath,
        ...scanned,
      },
    });
  } catch (error) {
    return sendControllerError(res, error, {
      defaultMessage: '扫描分类照片失败',
      defaultCode: error.code || 'FOLDER_PHOTOS_PREVIEW_FAILED',
    });
  }
};

const applyFolderPhotos = async (req, res) => {
  try {
    const rootPath = await assertSafeRoot(req.body?.rootPath);
    const scanned = await scanRoot(rootPath);
    const selected = new Set(
      Array.isArray(req.body?.files)
        ? req.body.files.map((item) => `${item.folder}|${item.fileName}`)
        : []
    );
    const uploadDir = getActiveUploadsRoot();
    await fsp.mkdir(uploadDir, { recursive: true });

    let uploaded = 0;
    let skipped = 0;
    let failed = 0;
    const failures = [];
    const folders = [];

    for (const folder of scanned.matched) {
      const bird = await Bird.findById(folder.birdId);
      if (!bird) continue;
      let changed = false;
      let folderUploaded = 0;
      let folderSkipped = 0;
      let folderFailed = 0;
      const folderFailures = [];
      for (const photo of folder.photos) {
        const key = `${folder.folder}|${photo.fileName}`;
        if (selected.size && !selected.has(key)) continue;
        if (photo.duplicate) {
          skipped += 1;
          folderSkipped += 1;
          continue;
        }
        const absPath = path.join(rootPath, folder.folder, photo.fileName);
        if (!isPathInside(rootPath, absPath)) {
          failed += 1;
          folderFailed += 1;
          const item = { folder: folder.folder, fileName: photo.fileName, message: '路径不安全' };
          failures.push(item);
          folderFailures.push(item);
          continue;
        }
        const ext = path.extname(photo.fileName).toLowerCase();
        const mime = IMAGE_EXT_TO_MIME[ext];
        if (!mime || !IMAGE_MIME_TO_EXT[mime]) {
          failed += 1;
          folderFailed += 1;
          const item = { folder: folder.folder, fileName: photo.fileName, message: '格式不支持' };
          failures.push(item);
          folderFailures.push(item);
          continue;
        }
        try {
          const storedName = buildSafeImageFileName(mime);
          const dest = path.join(uploadDir, storedName);
          await fsp.copyFile(absPath, dest);
          const stat = await fsp.stat(absPath);
          bird.images.push({
            url: `/uploads/active/${storedName}`,
            caption: photo.fileName,
            date: stat.mtime,
            photographer: req.user._id,
            order: bird.images.length,
            tags: [],
            source: 'folder_import',
            sourceHash: photo.hash,
            sourceFileName: photo.fileName,
            sourceBytes: photo.bytes,
          });
          changed = true;
          uploaded += 1;
          folderUploaded += 1;
        } catch (error) {
          failed += 1;
          folderFailed += 1;
          const item = {
            folder: folder.folder,
            fileName: photo.fileName,
            message: error.message || '复制失败',
          };
          failures.push(item);
          folderFailures.push(item);
        }
      }
      folders.push({
        folder: folder.folder,
        birdId: String(folder.birdId),
        birdName: folder.birdName,
        uploaded: folderUploaded,
        skipped: folderSkipped,
        failed: folderFailed,
        failures: folderFailures.slice(0, 8),
      });
      if (changed) {
        await bird.save();
        clearCache(`/api/birds/${folder.birdId}`);
      }
    }
    clearCache('/api/birds\\?');

    return res.status(200).json({
      success: true,
      data: { uploaded, skipped, failed, failures: failures.slice(0, 20), folders },
    });
  } catch (error) {
    return sendControllerError(res, error, {
      defaultMessage: '上传分类照片失败',
      defaultCode: error.code || 'FOLDER_PHOTOS_APPLY_FAILED',
    });
  }
};

module.exports = { pickFolderPhotos, previewFolderPhotos, applyFolderPhotos };
