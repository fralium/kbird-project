const fs = require('fs');
const path = require('path');

/**
 * Personal data root (kept outside the code repo for Gitee sync).
 *
 * Priority:
 * 1) KBIRD_DATA_ROOT
 * 2) parent of UPLOAD_PATH when it ends with /uploads
 * 3) sibling ../KBird-Data (default; created by scripts/ensure-kbird-data.js)
 *
 * Layout:
 *   KBird-Data/
 *     uploads/       media (active / avatars / projects / temp)
 *     backups/       zip backups
 *     mongo-dumps/   mongodump temp
 *     personal/      other personal exports
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

  // Keep using in-repo uploads until migration if data-root uploads is empty
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
