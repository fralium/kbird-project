/**
 * Create sibling KBird-Data (parallel to repo) and write paths into .env.
 *
 *   …/KBird/          ← code
 *   …/KBird-Data/     ← personal (auto-created)
 *     uploads/
 *     backups/
 *     mongo-dumps/
 *     personal/
 *
 * Usage (repo root): node scripts/ensure-kbird-data.js
 */
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DEFAULT_DATA_ROOT = path.resolve(ROOT, '..', 'KBird-Data');

function toEnvPath(p) {
  return path.resolve(p).replace(/\\/g, '/');
}

function readEnvMap(content) {
  const map = {};
  String(content || '')
    .split(/\r?\n/)
    .forEach((line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) return;
      const eq = trimmed.indexOf('=');
      if (eq <= 0) return;
      map[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim();
    });
  return map;
}

function setEnvKey(content, key, value) {
  const line = `${key}=${value}`;
  const re = new RegExp(`^#?\\s*${key}=.*$`, 'm');
  if (re.test(content)) {
    return content.replace(re, line);
  }
  return `${content.replace(/\s*$/, '')}\n\n# Auto-set by scripts/ensure-kbird-data.js\n${line}\n`;
}

function ensureDirs(dataRoot) {
  const uploads = path.join(dataRoot, 'uploads');
  [
    dataRoot,
    uploads,
    path.join(uploads, 'active'),
    path.join(uploads, 'avatars'),
    path.join(uploads, 'projects'),
    path.join(uploads, 'temp'),
    path.join(dataRoot, 'backups'),
    path.join(dataRoot, 'mongo-dumps'),
    path.join(dataRoot, 'personal'),
  ].forEach((dir) => fs.mkdirSync(dir, { recursive: true }));
  return uploads;
}

function isWeakSecret(value, minLen = 32) {
  const v = String(value || '').trim();
  if (v.length < minLen) return true;
  const lower = v.toLowerCase();
  if (lower.startsWith('change-me') || lower.includes('your-jwt-secret')) return true;
  const weak = [
    'your-jwt-secret-key-here',
    'change-me-to-a-long-random-string',
    'change-me',
  ];
  return weak.includes(v) || weak.includes(lower);
}

function ensureEnvFile() {
  const envPath = path.join(ROOT, '.env');
  const examplePath = path.join(ROOT, 'env.example');
  if (!fs.existsSync(envPath)) {
    if (fs.existsSync(examplePath)) fs.copyFileSync(examplePath, envPath);
    else fs.writeFileSync(envPath, '', 'utf8');
  }

  let content = fs.readFileSync(envPath, 'utf8');
  const envMap = readEnvMap(content);

  // 已配置的自定义数据根不要被 update/install 改回默认 sibling
  const existingRoot = String(envMap.KBIRD_DATA_ROOT || '').trim();
  const dataRoot = existingRoot
    ? path.resolve(existingRoot)
    : DEFAULT_DATA_ROOT;
  const uploads = ensureDirs(dataRoot);
  const dataRootEnv = toEnvPath(dataRoot);
  const uploadsEnv = toEnvPath(uploads);

  if (!existingRoot) {
    content = setEnvKey(content, 'KBIRD_DATA_ROOT', dataRootEnv);
  }
  const existingUpload = String(envMap.UPLOAD_PATH || '').trim();
  if (!existingUpload) {
    content = setEnvKey(content, 'UPLOAD_PATH', uploadsEnv);
  }

  if (isWeakSecret(envMap.INIT_SETUP_TOKEN, 24)) {
    const token = crypto.randomBytes(24).toString('hex');
    content = setEnvKey(content, 'INIT_SETUP_TOKEN', token);
    console.log('[OK] Generated INIT_SETUP_TOKEN (saved to .env)');
  }

  if (isWeakSecret(envMap.JWT_SECRET, 32)) {
    const jwt = crypto.randomBytes(32).toString('hex');
    content = setEnvKey(content, 'JWT_SECRET', jwt);
    console.log('[OK] Generated JWT_SECRET (saved to .env)');
  }

  if (!content.endsWith('\n')) content += '\n';
  fs.writeFileSync(envPath, content, 'utf8');
  return { dataRootEnv, uploadsEnv };
}

const { dataRootEnv, uploadsEnv } = ensureEnvFile();
console.log(`[OK] Data root: ${dataRootEnv}`);
console.log(`[OK] Uploads:   ${uploadsEnv}`);
console.log('[OK] Ensured KBIRD_DATA_ROOT / UPLOAD_PATH / secrets in .env');
