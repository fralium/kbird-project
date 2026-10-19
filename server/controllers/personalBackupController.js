const fs = require('fs');
const path = require('path');
const Record = require('../models/recordModel');
const Bird = require('../models/birdModel');
const Location = require('../models/locationModel');
const PersonalChecklist = require('../models/personalChecklistModel');
const UserSettings = require('../models/userSettingsModel');
const Project = require('../models/projectModel');
const { sendControllerError } = require('../middleware/controllerError');
const { clearCache, clearLeaderboardCache } = require('../middleware/cache');
const { devError } = require('../utils/devLogger');
const {
  resolveActiveUploadUrl,
  getActiveUploadsRoot,
} = require('../utils/safeUploadPath');
const { getProjectsUploadsRoot } = require('../config/dataPaths');

const ARCHIVE_VERSION = 3;
const MAX_MEDIA_BYTES = 40 * 1024 * 1024; // 单次导出媒体上限约 40MB

function dayKey(dateLike) {
  const d = new Date(dateLike);
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 10);
}

function recordFingerprint(record) {
  const locationName = String(record?.location?.name || '').trim().toLowerCase();
  const birdIds = (Array.isArray(record?.birds) ? record.birds : [])
    .map((b) => {
      const id = b?.birdId?._id || b?.birdId;
      return id ? String(id) : '';
    })
    .filter(Boolean)
    .sort()
    .join(',');
  return `${dayKey(record?.date)}|${locationName}|${birdIds}`;
}

function collectActiveUploadUrls({ records = [], birdMedia = [], locations = [] }) {
  const urls = new Set();
  (records || []).forEach((record) => {
    (record.images || []).forEach((img) => {
      if (img?.url) urls.add(String(img.url));
    });
    (record.birds || []).forEach((bird) => {
      (bird.images || []).forEach((img) => {
        if (img?.url) urls.add(String(img.url));
      });
    });
  });
  (birdMedia || []).forEach((bird) => {
    (bird.images || []).forEach((img) => {
      if (img?.url) urls.add(String(img.url));
    });
    (bird.calls || []).forEach((call) => {
      if (call?.url) urls.add(String(call.url));
    });
  });
  (locations || []).forEach((loc) => {
    (loc.images || []).forEach((img) => {
      if (img?.url) urls.add(String(img.url));
    });
  });
  return [...urls];
}

function collectProjectMedia(projects) {
  const files = [];
  (projects || []).forEach((project) => {
    (project.assets || []).forEach((asset) => {
      const relativePath = asset?.file?.relativePath;
      if (!relativePath) return;
      files.push({
        kind: 'project',
        projectId: String(project._id),
        assetId: asset.id,
        relativePath: String(relativePath).replace(/^[/\\]+/, ''),
      });
    });
  });
  return files;
}

function buildMediaEntries(recordUrls, projectFiles, { includeContent }) {
  const entries = [];
  let totalBytes = 0;
  let skipped = 0;

  recordUrls.forEach((url) => {
    const resolved = resolveActiveUploadUrl(url);
    if (!resolved) {
      skipped += 1;
      return;
    }
    let size = 0;
    let exists = false;
    try {
      if (fs.existsSync(resolved.absPath)) {
        exists = true;
        size = fs.statSync(resolved.absPath).size;
      }
    } catch {
      exists = false;
    }

    const entry = {
      kind: 'record',
      url: resolved.url,
      relativePath: resolved.url.replace(/^\//, ''),
      size,
      exists,
    };

    if (includeContent && exists && totalBytes + size <= MAX_MEDIA_BYTES) {
      try {
        entry.base64 = fs.readFileSync(resolved.absPath).toString('base64');
        totalBytes += size;
      } catch {
        skipped += 1;
      }
    } else if (includeContent && exists) {
      skipped += 1;
      entry.omitted = true;
    }

    entries.push(entry);
  });

  const projectsRoot = getProjectsUploadsRoot();
  projectFiles.forEach((file) => {
    const absPath = path.resolve(projectsRoot, file.relativePath);
    if (!absPath.startsWith(projectsRoot + path.sep) && absPath !== projectsRoot) {
      skipped += 1;
      return;
    }
    let size = 0;
    let exists = false;
    try {
      if (fs.existsSync(absPath)) {
        exists = true;
        size = fs.statSync(absPath).size;
      }
    } catch {
      exists = false;
    }

    const entry = {
      kind: 'project',
      projectId: file.projectId,
      assetId: file.assetId,
      relativePath: `uploads/projects/${file.relativePath.replace(/\\/g, '/')}`,
      size,
      exists,
    };

    if (includeContent && exists && totalBytes + size <= MAX_MEDIA_BYTES) {
      try {
        entry.base64 = fs.readFileSync(absPath).toString('base64');
        totalBytes += size;
      } catch {
        skipped += 1;
      }
    } else if (includeContent && exists) {
      skipped += 1;
      entry.omitted = true;
    }

    entries.push(entry);
  });

  return { entries, totalBytes, skipped };
}

async function buildArchivePayload(userId, { includeMedia }) {
  const [records, checklist, settings, projects, birdsWithMedia, locations] = await Promise.all([
    Record.find({ observer: userId }).lean(),
    PersonalChecklist.findOne({ userId }).lean(),
    UserSettings.findOne({ userId }).lean(),
    Project.find({ ownerId: userId }).lean(),
    Bird.find({
      $or: [
        { 'images.0': { $exists: true } },
        { 'calls.0': { $exists: true } },
      ],
    })
      .select('name scientificName nameAliases images calls')
      .lean(),
    Location.find({ status: { $ne: 'archived' } }).lean(),
  ]);

  const birdMedia = (birdsWithMedia || []).map((b) => ({
    birdId: String(b._id),
    name: b.name || '',
    scientificName: b.scientificName || '',
    nameAliases: Array.isArray(b.nameAliases) ? b.nameAliases : [],
    images: Array.isArray(b.images) ? b.images : [],
    calls: Array.isArray(b.calls) ? b.calls : [],
  }));

  const activeUrls = collectActiveUploadUrls({ records, birdMedia, locations });
  const projectFiles = collectProjectMedia(projects);
  const media = buildMediaEntries(activeUrls, projectFiles, { includeContent: includeMedia });

  return {
    version: ARCHIVE_VERSION,
    exportedAt: new Date().toISOString(),
    app: 'KBird',
    userId: String(userId),
    includeMedia: Boolean(includeMedia),
    counts: {
      records: records.length,
      checklistSpecies: Array.isArray(checklist?.observedBirds) ? checklist.observedBirds.length : 0,
      projects: projects.length,
      birdMediaSpecies: birdMedia.length,
      locations: locations.length,
      settings: settings ? 1 : 0,
      mediaFiles: media.entries.length,
      mediaEmbedded: media.entries.filter((e) => e.base64).length,
      mediaBytes: media.totalBytes,
      mediaSkipped: media.skipped,
    },
    records,
    checklist: checklist || null,
    settings: settings || null,
    projects,
    birdMedia,
    locations,
    media: media.entries,
  };
}

function parseArchiveBody(body) {
  if (!body || typeof body !== 'object') return null;
  if (
    !Array.isArray(body.records) &&
    !body.checklist &&
    !Array.isArray(body.projects) &&
    !Array.isArray(body.birdMedia) &&
    !Array.isArray(body.locations)
  ) {
    return null;
  }
  return body;
}

async function computeMergePreview(userId, archive) {
  const existingRecords = await Record.find({ observer: userId }).select('date location.name birds.birdId').lean();
  const existingFingerprints = new Set(existingRecords.map(recordFingerprint));

  const incomingRecords = Array.isArray(archive.records) ? archive.records : [];
  let recordsAdd = 0;
  let recordsSkip = 0;
  incomingRecords.forEach((record) => {
    const fp = recordFingerprint(record);
    if (fp && existingFingerprints.has(fp)) recordsSkip += 1;
    else recordsAdd += 1;
  });

  const existingChecklist = await PersonalChecklist.findOne({ userId }).lean();
  const existingBirdIds = new Set(
    (existingChecklist?.observedBirds || []).map((item) => String(item.birdId))
  );
  const incomingBirds = archive.checklist?.observedBirds || [];
  let checklistAdd = 0;
  let checklistSkip = 0;
  incomingBirds.forEach((item) => {
    const id = item?.birdId ? String(item.birdId) : '';
    if (!id) return;
    if (existingBirdIds.has(id)) checklistSkip += 1;
    else checklistAdd += 1;
  });

  const existingProjects = await Project.find({ ownerId: userId }).select('title').lean();
  const existingTitles = new Set(existingProjects.map((p) => String(p.title || '').trim().toLowerCase()));
  const incomingProjects = Array.isArray(archive.projects) ? archive.projects : [];
  let projectsAdd = 0;
  let projectsSkip = 0;
  incomingProjects.forEach((project) => {
    const title = String(project?.title || '').trim().toLowerCase();
    if (title && existingTitles.has(title)) projectsSkip += 1;
    else projectsAdd += 1;
  });

  const mediaWithContent = (archive.media || []).filter((m) => m?.base64);
  const settingsWillMerge = Boolean(archive.settings);

  const incomingBirdMedia = Array.isArray(archive.birdMedia) ? archive.birdMedia : [];
  const incomingLocations = Array.isArray(archive.locations) ? archive.locations : [];
  let locationsAdd = 0;
  let locationsSkip = 0;
  if (incomingLocations.length > 0) {
    const existingLocs = await Location.find({}).select('name').lean();
    const existingLocNames = new Set(existingLocs.map((l) => String(l.name || '').trim()));
    incomingLocations.forEach((loc) => {
      const name = String(loc?.name || '').trim();
      if (!name) return;
      if (existingLocNames.has(name)) locationsSkip += 1;
      else locationsAdd += 1;
    });
  }

  return {
    records: { add: recordsAdd, skip: recordsSkip, total: incomingRecords.length },
    checklist: { add: checklistAdd, skip: checklistSkip, total: incomingBirds.length },
    projects: { add: projectsAdd, skip: projectsSkip, total: incomingProjects.length },
    birdMedia: { species: incomingBirdMedia.length },
    locations: { add: locationsAdd, merge: locationsSkip, total: incomingLocations.length },
    settings: { merge: settingsWillMerge },
    media: { restoreable: mediaWithContent.length, listed: Array.isArray(archive.media) ? archive.media.length : 0 },
  };
}

function writeMediaEntry(entry, userId) {
  if (!entry?.base64) return { ok: false, reason: 'no-content' };
  const buf = Buffer.from(entry.base64, 'base64');
  if (!buf.length) return { ok: false, reason: 'empty' };

  if (entry.kind === 'record' || entry.url) {
    const preferredUrl = entry.url || (entry.relativePath ? `/${String(entry.relativePath).replace(/^\/+/, '')}` : '');
    const resolved = resolveActiveUploadUrl(preferredUrl);
    if (!resolved) return { ok: false, reason: 'unsafe-path' };
    fs.mkdirSync(path.dirname(resolved.absPath), { recursive: true });
    if (!fs.existsSync(resolved.absPath)) {
      fs.writeFileSync(resolved.absPath, buf);
    }
    return { ok: true, url: resolved.url };
  }

  if (entry.kind === 'project' && entry.relativePath) {
    const projectsRoot = getProjectsUploadsRoot();
    const rel = String(entry.relativePath).replace(/^uploads\/projects\//, '').replace(/^[/\\]+/, '');
    const userRoot = path.resolve(projectsRoot, String(userId));
    const absPath = path.resolve(userRoot, path.basename(rel));
    if (!absPath.startsWith(userRoot + path.sep) && absPath !== userRoot) {
      return { ok: false, reason: 'unsafe-project-path' };
    }
    fs.mkdirSync(path.dirname(absPath), { recursive: true });
    if (!fs.existsSync(absPath)) {
      fs.writeFileSync(absPath, buf);
    }
    return {
      ok: true,
      relativePath: path.relative(projectsRoot, absPath).replace(/\\/g, '/'),
    };
  }

  return { ok: false, reason: 'unknown-kind' };
}

// @desc    导出当前用户个人档案包（JSON）
// @route   GET /api/personal/backup/export
// @access  Private
const exportBackup = async (req, res) => {
  try {
    const userId = req.user.id;
    const includeMedia =
      String(req.query.includeMedia || '').toLowerCase() === '1' ||
      String(req.query.includeMedia || '').toLowerCase() === 'true';

    const payload = await buildArchivePayload(userId, { includeMedia });
    const body = JSON.stringify(payload, null, 2);
    const mediaTag = includeMedia ? 'with-media' : 'data';
    const safeName = `kbird-archive-${mediaTag}-${new Date().toISOString().slice(0, 10)}.json`;

    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${safeName}"`);
    res.send(body);
  } catch (error) {
    devError('导出备份失败:', error);
    return sendControllerError(res, error, {
      defaultMessage: '导出备份失败',
      defaultCode: 'PERSONAL_BACKUP_OPERATION_FAILED',
    });
  }
};

// @desc    预览合并恢复
// @route   POST /api/personal/backup/restore/preview
// @access  Private
const previewRestore = async (req, res) => {
  try {
    const archive = parseArchiveBody(req.body);
    if (!archive) {
      return res.status(400).json({
        success: false,
        message: '无效的备份包',
        code: 'PERSONAL_BACKUP_INVALID',
      });
    }

    const preview = await computeMergePreview(req.user.id, archive);
    return res.json({
      success: true,
      data: {
        version: archive.version || 1,
        exportedAt: archive.exportedAt || null,
        preview,
      },
    });
  } catch (error) {
    devError('预览恢复失败:', error);
    return sendControllerError(res, error, {
      defaultMessage: '预览恢复失败',
      defaultCode: 'PERSONAL_BACKUP_OPERATION_FAILED',
    });
  }
};

// @desc    合并恢复到当前用户
// @route   POST /api/personal/backup/restore/apply
// @access  Private
const applyRestore = async (req, res) => {
  try {
    const userId = req.user.id;
    const archive = parseArchiveBody(req.body);
    if (!archive) {
      return res.status(400).json({
        success: false,
        message: '无效的备份包',
        code: 'PERSONAL_BACKUP_INVALID',
      });
    }

    const preview = await computeMergePreview(userId, archive);
    const result = {
      recordsAdded: 0,
      recordsSkipped: 0,
      checklistAdded: 0,
      projectsAdded: 0,
      birdMediaMerged: 0,
      locationsAdded: 0,
      locationsMerged: 0,
      settingsMerged: false,
      mediaRestored: 0,
      mediaFailed: 0,
    };

    // 媒体先写回（记录 URL 依赖本地文件存在）
    if (Array.isArray(archive.media)) {
      archive.media.forEach((entry) => {
        if (!entry?.base64) return;
        const written = writeMediaEntry(entry, userId);
        if (written.ok) result.mediaRestored += 1;
        else result.mediaFailed += 1;
      });
    }

    const existingRecords = await Record.find({ observer: userId }).select('date location.name birds.birdId').lean();
    const existingFingerprints = new Set(existingRecords.map(recordFingerprint));

    for (const record of archive.records || []) {
      const fp = recordFingerprint(record);
      if (fp && existingFingerprints.has(fp)) {
        result.recordsSkipped += 1;
        continue;
      }

      const doc = { ...record };
      delete doc._id;
      delete doc.__v;
      delete doc.createdAt;
      delete doc.updatedAt;
      doc.observer = userId;
      if (doc.status === 'draft') doc.status = 'published';

      try {
        await Record.create(doc);
        result.recordsAdded += 1;
        if (fp) existingFingerprints.add(fp);
      } catch (err) {
        devError('合并记录失败:', err);
        result.recordsSkipped += 1;
      }
    }

    if (archive.checklist) {
      let checklist = await PersonalChecklist.findOne({ userId });
      if (!checklist) {
        checklist = await PersonalChecklist.create({
          userId,
          observedBirds: [],
          goals: archive.checklist.goals || {},
          settings: archive.checklist.settings || {},
        });
      }

      const existingBirdIds = new Set(
        (checklist.observedBirds || []).map((item) => String(item.birdId))
      );
      (archive.checklist.observedBirds || []).forEach((item) => {
        const id = item?.birdId ? String(item.birdId) : '';
        if (!id || existingBirdIds.has(id)) return;
        checklist.observedBirds.push({
          birdId: item.birdId,
          firstSeenDate: item.firstSeenDate || new Date(),
          firstSeenLocation: item.firstSeenLocation || null,
          totalObservations: item.totalObservations || 1,
        });
        existingBirdIds.add(id);
        result.checklistAdded += 1;
      });

      if (archive.checklist.goals && typeof archive.checklist.goals === 'object') {
        checklist.goals = {
          ...(checklist.goals?.toObject?.() || checklist.goals || {}),
          ...archive.checklist.goals,
        };
      }
      await checklist.save();
    }

    if (archive.settings && typeof archive.settings === 'object') {
      const incoming = { ...archive.settings };
      delete incoming._id;
      delete incoming.__v;
      delete incoming.userId;
      delete incoming.createdAt;
      delete incoming.updatedAt;
      await UserSettings.findOneAndUpdate(
        { userId },
        { $setOnInsert: { userId }, $set: incoming },
        { upsert: true, new: true }
      );
      result.settingsMerged = true;
    }

    const existingProjects = await Project.find({ ownerId: userId }).select('title').lean();
    const existingTitles = new Set(existingProjects.map((p) => String(p.title || '').trim().toLowerCase()));
    for (const project of archive.projects || []) {
      const title = String(project?.title || '').trim();
      const titleKey = title.toLowerCase();
      if (titleKey && existingTitles.has(titleKey)) continue;

      const doc = { ...project };
      delete doc._id;
      delete doc.__v;
      delete doc.createdAt;
      delete doc.updatedAt;
      doc.ownerId = userId;
      doc.title = title || `导入项目 ${new Date().toISOString().slice(0, 10)}`;

      try {
        await Project.create(doc);
        result.projectsAdded += 1;
        existingTitles.add(String(doc.title).toLowerCase());
      } catch (err) {
        devError('合并项目失败:', err);
      }
    }

    // 合并鸟种图鉴个人图片/录音与别名
    for (const bm of archive.birdMedia || []) {
      const name = String(bm?.name || '').trim();
      const sci = String(bm?.scientificName || '').trim();
      if (!name && !sci && !bm?.birdId) continue;

      let birdDoc = null;
      if (bm.birdId) {
        birdDoc = await Bird.findById(bm.birdId).catch(() => null);
      }
      if (!birdDoc && name) {
        birdDoc = await Bird.findOne({ name });
      }
      if (!birdDoc && sci) {
        birdDoc = await Bird.findOne({ scientificName: sci });
      }
      if (!birdDoc) continue;

      let changed = false;
      const existingImgUrls = new Set((birdDoc.images || []).map((img) => String(img?.url || '')));
      const existingImgHashes = new Set(
        (birdDoc.images || []).map((img) => String(img?.sourceHash || '')).filter(Boolean)
      );
      (bm.images || []).forEach((img) => {
        const url = String(img?.url || '').trim();
        if (!url || existingImgUrls.has(url)) return;
        if (img.sourceHash && existingImgHashes.has(String(img.sourceHash))) return;
        birdDoc.images.push({
          url,
          caption: img.caption || '',
          location: img.location || '',
          date: img.date || new Date(),
          photographer: userId,
          order: typeof img.order === 'number' ? img.order : birdDoc.images.length,
          tags: Array.isArray(img.tags) ? img.tags : [],
          source: img.source || '',
          sourceHash: img.sourceHash || '',
          sourceFileName: img.sourceFileName || '',
          sourceBytes: Number(img.sourceBytes) || 0,
        });
        existingImgUrls.add(url);
        if (img.sourceHash) existingImgHashes.add(String(img.sourceHash));
        changed = true;
      });

      const existingCallUrls = new Set((birdDoc.calls || []).map((c) => String(c?.url || '')));
      (bm.calls || []).forEach((call) => {
        const url = String(call?.url || '').trim();
        if (!url || existingCallUrls.has(url)) return;
        birdDoc.calls.push({
          url,
          caption: call.caption || '',
          location: call.location || '',
          date: call.date || new Date(),
          recorder: userId,
          order: typeof call.order === 'number' ? call.order : birdDoc.calls.length,
          tags: Array.isArray(call.tags) ? call.tags : [],
          mimeType: call.mimeType || '',
          durationSec: call.durationSec,
        });
        existingCallUrls.add(url);
        changed = true;
      });

      if (changed) {
        await birdDoc.save().catch((err) => devError('合并鸟种媒体失败:', err));
        result.birdMediaMerged += 1;
      }
    }

    // 合并观鸟地点词典与生境照片
    for (const loc of archive.locations || []) {
      const name = String(loc?.name || '').trim();
      if (!name) continue;
      const existingLoc = await Location.findOne({ name });
      if (!existingLoc) {
        const doc = { ...loc };
        delete doc._id;
        delete doc.__v;
        delete doc.createdAt;
        delete doc.updatedAt;
        doc.createdBy = userId;
        try {
          await Location.create(doc);
          result.locationsAdded += 1;
        } catch (err) {
          devError('合并新增地点失败:', err);
        }
      } else {
        let locChanged = false;
        const existingUrls = new Set((existingLoc.images || []).map((img) => String(img?.url || '')));
        (loc.images || []).forEach((img) => {
          const url = String(img?.url || '').trim();
          if (!url || existingUrls.has(url)) return;
          existingLoc.images.push({
            url,
            caption: img.caption || '',
            photographer: userId,
            uploadedAt: img.uploadedAt || new Date(),
          });
          existingUrls.add(url);
          locChanged = true;
        });
        if (!existingLoc.description && loc.description) {
          existingLoc.description = loc.description;
          locChanged = true;
        }
        if (locChanged) {
          await existingLoc.save().catch((err) => devError('合并地点图片失败:', err));
          result.locationsMerged += 1;
        }
      }
    }

    if (result.recordsAdded > 0 || result.birdMediaMerged > 0 || result.locationsAdded > 0 || result.locationsMerged > 0) {
      clearCache('/api/records');
      clearCache('/api/records\\?');
      clearCache('/api/locations');
      clearCache('/api/birds');
      clearLeaderboardCache();
    }

    return res.json({
      success: true,
      message: '合并恢复完成',
      data: { preview, result },
    });
  } catch (error) {
    devError('合并恢复失败:', error);
    return sendControllerError(res, error, {
      defaultMessage: '合并恢复失败',
      defaultCode: 'PERSONAL_BACKUP_OPERATION_FAILED',
    });
  }
};

module.exports = {
  exportBackup,
  previewRestore,
  applyRestore,
  // exposed for tests/tools
  recordFingerprint,
  getActiveUploadsRoot,
};
