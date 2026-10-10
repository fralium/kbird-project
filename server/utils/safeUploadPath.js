const path = require('path');
const { getActiveUploadsRoot } = require('../config/dataPaths');

const IMAGE_MIME_TO_EXT = {
  'image/jpeg': '.jpg',
  'image/jpg': '.jpg',
  'image/png': '.png',
  'image/gif': '.gif',
  'image/webp': '.webp',
};

const AUDIO_MIME_TO_EXT = {
  'audio/mpeg': '.mp3',
  'audio/mp3': '.mp3',
  'audio/mp4': '.m4a',
  'audio/x-m4a': '.m4a',
  'audio/m4a': '.m4a',
  'audio/wav': '.wav',
  'audio/x-wav': '.wav',
  'audio/wave': '.wav',
  'audio/ogg': '.ogg',
  'audio/webm': '.webm',
};

function isPathInside(root, candidate) {
  const resolvedRoot = path.resolve(root);
  const resolved = path.resolve(candidate);
  return resolved === resolvedRoot || resolved.startsWith(`${resolvedRoot}${path.sep}`);
}

/**
 * Validate /uploads/active/... URL and resolve absolute path under uploads/active.
 * Rejects .., absolute paths, and any escape outside active.
 */
function resolveActiveUploadUrl(url) {
  const raw = String(url || '').trim();
  if (!raw.startsWith('/uploads/active/')) return null;

  const relative = raw.slice('/uploads/active/'.length);
  if (!relative || relative.includes('\0')) return null;

  const parts = relative.split(/[/\\]/).filter(Boolean);
  if (parts.length === 0 || parts.some((part) => part === '..')) return null;

  const root = getActiveUploadsRoot();
  const absPath = path.resolve(root, ...parts);
  if (!isPathInside(root, absPath)) return null;

  return {
    absPath,
    url: `/uploads/active/${parts.join('/')}`,
    fileName: parts[parts.length - 1],
  };
}

/**
 * Normalize client-provided image references for records/birds.
 * Only bare filenames or already-safe /uploads/active/* URLs are accepted.
 */
function sanitizeActiveUploadImageUrl(url) {
  const raw = String(url || '').trim();
  if (!raw) return null;

  if (raw.startsWith('/uploads/active/')) {
    const resolved = resolveActiveUploadUrl(raw);
    return resolved ? resolved.url : null;
  }

  // Reject any other absolute/relative path form
  if (raw.includes('..') || raw.includes('/') || raw.includes('\\') || raw.includes(':')) {
    return null;
  }

  const base = path.basename(raw);
  if (!base || base === '.' || base === '..') return null;
  if (!/\.(jpe?g|png|gif|webp)$/i.test(base)) return null;

  const resolved = resolveActiveUploadUrl(`/uploads/active/${base}`);
  return resolved ? resolved.url : null;
}

function buildSafeImageFileName(mimeType) {
  const ext = IMAGE_MIME_TO_EXT[mimeType];
  if (!ext) return null;
  return `image-${Date.now()}-${Math.floor(Math.random() * 1e9)}${ext}`;
}

function buildSafeAudioFileName(mimeType) {
  const ext = AUDIO_MIME_TO_EXT[mimeType];
  if (!ext) return null;
  return `call-${Date.now()}-${Math.floor(Math.random() * 1e9)}${ext}`;
}

module.exports = {
  IMAGE_MIME_TO_EXT,
  AUDIO_MIME_TO_EXT,
  getActiveUploadsRoot,
  isPathInside,
  resolveActiveUploadUrl,
  sanitizeActiveUploadImageUrl,
  buildSafeImageFileName,
  buildSafeAudioFileName,
};
