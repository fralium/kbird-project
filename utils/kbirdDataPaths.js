const fs = require('fs');
const path = require('path');

/**
 * 涓汉鏁版嵁鏍圭洰褰曪紙涓庝唬鐮佷粨搴撻殧绂伙紝渚夸簬 Gitee 鍚屾涓嶅甫闅愮锛? *
 * 浼樺厛绾э細
 * 1) KBIRD_DATA_ROOT
 * 2) UPLOAD_PATH 鐨勪笂涓€绾э紙鑻ユ寚鍚?.../uploads锛? * 3) 浠撳簱鏃?../KBird-Data
 *
 * 甯冨眬锛? *   KBird-Data/
 *     uploads/          濯掍綋锛坅ctive / avatars / projects / temp锛? *     backups/          鑷姩鍘嬬缉澶囦唤鍖? *     mongo-dumps/      mongodump 涓存椂鐩綍
 *     personal/         瀵煎嚭/鍏跺畠涓汉鏂囦欢
 */

function projectRoot() {
  return path.resolve(__dirname, '..');
}

function resolveDataRoot() {
  const fromEnv = String(process.env.KBIRD_DATA_ROOT || '').trim();
  if (fromEnv) return path.resolve(fromEnv);

  const uploadEnv = String(process.env.UPLOAD_PATH || '').trim();
  if (uploadEnv) {
    const abs = path.resolve(uploadEnv);
    if (path.basename(abs).toLowerCase() === 'uploads') {
      return path.dirname(abs);
    }
    return abs;
  }

  return path.resolve(projectRoot(), '..', 'KBird-Data');
}

function getDataRoot() {
  return resolveDataRoot();
}

function getUploadsRoot() {
  const uploadEnv = String(process.env.UPLOAD_PATH || '').trim();
  if (uploadEnv) {
    const abs = path.resolve(uploadEnv);
    if (path.basename(abs).toLowerCase() === 'uploads') return abs;
    return path.join(abs, 'uploads');
  }

  const dataRoot = getDataRoot();
  const preferred = path.join(dataRoot, 'uploads');
  const legacy = path.join(projectRoot(), 'uploads');

  // 灏氭湭杩佸埌鏁版嵁鏍规椂锛岀户缁敤浠撳簱鍐呮棫 uploads锛岄伩鍏嶇獊鐒惰涓嶅埌鐓х墖
  try {
    const preferredHas = fs.existsSync(preferred) && fs.readdirSync(preferred).length > 0;
    const legacyHas = fs.existsSync(legacy) && fs.readdirSync(legacy).length > 0;
    if (!preferredHas && legacyHas) return legacy;
  } catch {
    // ignore
  }

  return preferred;
}

function getBackupsRoot() {
  return path.join(getDataRoot(), 'backups');
}

function getMongoDumpsRoot() {
  return path.join(getDataRoot(), 'mongo-dumps');
}

function getPersonalRoot() {
  return path.join(getDataRoot(), 'personal');
}

function getActiveUploadsRoot() {
  return path.join(getUploadsRoot(), 'active');
}

function getAvatarsRoot() {
  return path.join(getUploadsRoot(), 'avatars');
}

function getProjectsUploadsRoot() {
  return path.join(getUploadsRoot(), 'projects');
}

function getTempUploadsRoot() {
  return path.join(getUploadsRoot(), 'temp');
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
  return dirPath;
}

function ensureDataDirs() {
  const uploads = getUploadsRoot();
  ensureDir(getDataRoot());
  ensureDir(uploads);
  ensureDir(path.join(uploads, 'active'));
  ensureDir(path.join(uploads, 'avatars'));
  ensureDir(path.join(uploads, 'projects'));
  ensureDir(path.join(uploads, 'temp'));
  ensureDir(getBackupsRoot());
  ensureDir(getMongoDumpsRoot());
  ensureDir(getPersonalRoot());
  return {
    dataRoot: getDataRoot(),
    uploadsRoot: uploads,
    backupsRoot: getBackupsRoot(),
  };
}

module.exports = {
  projectRoot,
  getDataRoot,
  getUploadsRoot,
  getBackupsRoot,
  getMongoDumpsRoot,
  getPersonalRoot,
  getActiveUploadsRoot,
  getAvatarsRoot,
  getProjectsUploadsRoot,
  getTempUploadsRoot,
  ensureDir,
  ensureDataDirs,
};

