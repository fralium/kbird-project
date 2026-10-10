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
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DATA_ROOT = path.resolve(ROOT, '..', 'KBird-Data');
const UPLOADS = path.join(DATA_ROOT, 'uploads');

function toEnvPath(p) {
  return path.resolve(p).replace(/\\/g, '/');
}

function ensureDirs() {
  [
    DATA_ROOT,
    UPLOADS,
    path.join(UPLOADS, 'active'),
    path.join(UPLOADS, 'avatars'),
    path.join(UPLOADS, 'projects'),
    path.join(UPLOADS, 'temp'),
    path.join(DATA_ROOT, 'backups'),
    path.join(DATA_ROOT, 'mongo-dumps'),
    path.join(DATA_ROOT, 'personal'),
  ].forEach((dir) => fs.mkdirSync(dir, { recursive: true }));
}

function setEnvKey(content, key, value) {
  const line = `${key}=${value}`;
  const re = new RegExp(`^#?\\s*${key}=.*$`, 'm');
  if (re.test(content)) {
    return content.replace(re, line);
  }
  return `${content.replace(/\s*$/, '')}\n\n# Auto-set by scripts/ensure-kbird-data.js\n${line}\n`;
}

function ensureEnvFile() {
  const envPath = path.join(ROOT, '.env');
  const examplePath = path.join(ROOT, 'env.example');
  if (!fs.existsSync(envPath)) {
    if (fs.existsSync(examplePath)) fs.copyFileSync(examplePath, envPath);
    else fs.writeFileSync(envPath, '', 'utf8');
  }

  const dataRootEnv = toEnvPath(DATA_ROOT);
  const uploadsEnv = toEnvPath(UPLOADS);
  let content = fs.readFileSync(envPath, 'utf8');
  content = setEnvKey(content, 'KBIRD_DATA_ROOT', dataRootEnv);
  content = setEnvKey(content, 'UPLOAD_PATH', uploadsEnv);
  if (!content.endsWith('\n')) content += '\n';
  fs.writeFileSync(envPath, content, 'utf8');
  return { dataRootEnv, uploadsEnv };
}

ensureDirs();
const { dataRootEnv, uploadsEnv } = ensureEnvFile();
console.log(`[OK] Data root: ${dataRootEnv}`);
console.log(`[OK] Uploads:   ${uploadsEnv}`);
console.log('[OK] Wrote KBIRD_DATA_ROOT / UPLOAD_PATH into .env');
