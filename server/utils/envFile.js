const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PROJECT_ROOT = path.resolve(__dirname, '..', '..');
const ENV_PATH = path.join(PROJECT_ROOT, '.env');
const EXAMPLE_PATH = path.join(PROJECT_ROOT, 'env.example');

/** Keys the GUI is allowed to write */
const WRITABLE_KEYS = new Set([
  'MONGODB_URI',
  'SITE_NAME',
  'SITE_DESCRIPTION',
  'SITE_URL',
  'PORT',
  'NEXT_PUBLIC_API_URL',
  'THEME',
  'PRIMARY_COLOR',
  'SECONDARY_COLOR',
  'ENABLE_REGISTRATION',
  'ENABLE_COMMENTS',
  'ENABLE_UPLOAD',
  'MAX_FILE_SIZE',
  'NEXT_PUBLIC_BAIDU_MAP_AK',
  'NEXT_PUBLIC_TIANDITU_TK',
  'TIANDITU_SERVER_TK',
  'OPENAI_API_KEY',
  'OPENAI_BASE_URL',
  'OPENAI_MODEL',
  'HHO_API_KEY',
  'HHO_API_URL',
  'JWT_SECRET',
]);

const SECRET_KEYS = new Set([
  'JWT_SECRET',
  'NEXT_PUBLIC_BAIDU_MAP_AK',
  'NEXT_PUBLIC_TIANDITU_TK',
  'TIANDITU_SERVER_TK',
  'OPENAI_API_KEY',
  'HHO_API_KEY',
  'INIT_SETUP_TOKEN',
]);

function ensureEnvFileExists() {
  if (fs.existsSync(ENV_PATH)) return ENV_PATH;
  if (fs.existsSync(EXAMPLE_PATH)) {
    fs.copyFileSync(EXAMPLE_PATH, ENV_PATH);
  } else {
    fs.writeFileSync(ENV_PATH, '', 'utf8');
  }
  return ENV_PATH;
}

function readEnvRaw() {
  ensureEnvFileExists();
  return fs.readFileSync(ENV_PATH, 'utf8');
}

function parseEnvContent(content) {
  const map = {};
  String(content || '')
    .split(/\r?\n/)
    .forEach((line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) return;
      const i = trimmed.indexOf('=');
      if (i < 1) return;
      const key = trimmed.slice(0, i).trim();
      let value = trimmed.slice(i + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      map[key] = value;
    });
  return map;
}

function getEnvMap() {
  return parseEnvContent(readEnvRaw());
}

function upsertEnvKeys(updates) {
  const clean = {};
  Object.entries(updates || {}).forEach(([key, value]) => {
    if (!WRITABLE_KEYS.has(key)) return;
    if (value === undefined || value === null) return;
    clean[key] = String(value);
  });
  if (!Object.keys(clean).length) {
    return { path: ENV_PATH, written: [] };
  }

  ensureEnvFileExists();
  let content = fs.readFileSync(ENV_PATH, 'utf8');
  const written = [];

  Object.entries(clean).forEach(([key, value]) => {
    const line = `${key}=${value}`;
    const re = new RegExp(`^#?\\s*${key}=.*$`, 'm');
    if (re.test(content)) {
      content = content.replace(re, line);
    } else {
      content = `${content.replace(/\s*$/, '')}\n\n# Updated via KBird GUI\n${line}\n`;
    }
    written.push(key);
  });

  if (!content.endsWith('\n')) content += '\n';
  fs.writeFileSync(ENV_PATH, content, 'utf8');
  return { path: ENV_PATH, written };
}

function buildMongoUri({ host, port, dbName }) {
  const h = String(host || 'localhost').trim() || 'localhost';
  const p = String(port || '27017').trim() || '27017';
  const db = String(dbName || 'kbird').trim() || 'kbird';
  if (!/^[A-Za-z0-9._-]+$/.test(db)) {
    throw new Error('数据库名称仅允许字母、数字、点、下划线、短横线');
  }
  if (!/^\d+$/.test(p) || Number(p) < 1 || Number(p) > 65535) {
    throw new Error('数据库端口无效');
  }
  return `mongodb://${h}:${p}/${db}`;
}

function parseMongoUri(uri) {
  const raw = String(uri || '').trim();
  const m = raw.match(/^mongodb(?:\+srv)?:\/\/([^/?#]+)(?:\/([^?#]*))?/i);
  if (!m) {
    return { host: 'localhost', port: '27017', dbName: 'kbird' };
  }
  const authority = m[1] || '';
  const dbName = decodeURIComponent(String(m[2] || 'kbird').split('/')[0] || 'kbird') || 'kbird';
  // strip credentials user:pass@
  const hostPort = authority.includes('@') ? authority.split('@').pop() : authority;
  let host = 'localhost';
  let port = '27017';
  if (hostPort.startsWith('[')) {
    const end = hostPort.indexOf(']');
    host = hostPort.slice(0, end + 1);
    const rest = hostPort.slice(end + 1);
    if (rest.startsWith(':')) port = rest.slice(1) || '27017';
  } else if (hostPort.includes(':')) {
    const idx = hostPort.lastIndexOf(':');
    host = hostPort.slice(0, idx) || 'localhost';
    port = hostPort.slice(idx + 1) || '27017';
  } else {
    host = hostPort || 'localhost';
  }
  return { host, port, dbName };
}

function maskSecret(value) {
  const v = String(value || '');
  if (!v) return { configured: false, masked: '' };
  if (v.length <= 4) return { configured: true, masked: '****' };
  return { configured: true, masked: `****${v.slice(-4)}` };
}

function parseMaxFileSizeToBytes(input) {
  const raw = String(input || '').trim();
  if (/^\d+$/.test(raw)) return raw;
  const m = raw.match(/^(\d+(?:\.\d+)?)\s*(B|KB|MB|GB)?$/i);
  if (!m) return '5242880';
  const n = Number(m[1]);
  const unit = (m[2] || 'B').toUpperCase();
  const mul = { B: 1, KB: 1024, MB: 1024 * 1024, GB: 1024 * 1024 * 1024 }[unit] || 1;
  return String(Math.round(n * mul));
}

function ensureJwtSecretInUpdates(updates, currentMap) {
  const cur = String(currentMap.JWT_SECRET || process.env.JWT_SECRET || '').trim();
  const placeholder = !cur || /^your-jwt-secret/i.test(cur) || cur.length < 16;
  if (placeholder && updates.JWT_SECRET === undefined) {
    updates.JWT_SECRET = crypto.randomBytes(32).toString('hex');
  }
  return updates;
}

/**
 * Build env updates from init / settings GUI payload.
 * Empty secret fields mean "leave unchanged" (omit from updates).
 */
function buildUpdatesFromGuiPayload(body = {}, { forInit = false } = {}) {
  const current = getEnvMap();
  const updates = {};

  if (body.dbName || body.dbHost || body.dbPort) {
    const parsed = parseMongoUri(current.MONGODB_URI || process.env.MONGODB_URI || '');
    updates.MONGODB_URI = buildMongoUri({
      host: body.dbHost != null && String(body.dbHost).trim() !== '' ? body.dbHost : parsed.host,
      port: body.dbPort != null && String(body.dbPort).trim() !== '' ? body.dbPort : parsed.port,
      dbName: body.dbName != null && String(body.dbName).trim() !== '' ? body.dbName : parsed.dbName,
    });
  }

  const plainAssign = {
    siteName: 'SITE_NAME',
    siteDescription: 'SITE_DESCRIPTION',
    siteUrl: 'SITE_URL',
    theme: 'THEME',
    primaryColor: 'PRIMARY_COLOR',
    secondaryColor: 'SECONDARY_COLOR',
    openaiBaseUrl: 'OPENAI_BASE_URL',
    openaiModel: 'OPENAI_MODEL',
    hhoApiUrl: 'HHO_API_URL',
  };
  Object.entries(plainAssign).forEach(([from, key]) => {
    if (body[from] === undefined || body[from] === null) return;
    const v = String(body[from]).trim();
    if (v === '' && !forInit) return;
    if (v !== '') updates[key] = v;
  });

  if (body.backendPort != null && String(body.backendPort).trim() !== '') {
    const port = String(body.backendPort).trim();
    updates.PORT = port;
    updates.NEXT_PUBLIC_API_URL = `http://localhost:${port}`;
  }
  if (
    (body.siteUrl === undefined || String(body.siteUrl || '').trim() === '') &&
    body.frontendPort != null &&
    String(body.frontendPort).trim() !== ''
  ) {
    updates.SITE_URL = `http://localhost:${String(body.frontendPort).trim()}`;
  }

  if (typeof body.enableRegistration === 'boolean') {
    updates.ENABLE_REGISTRATION = body.enableRegistration ? 'true' : 'false';
  }
  if (typeof body.enableComments === 'boolean') {
    updates.ENABLE_COMMENTS = body.enableComments ? 'true' : 'false';
  }
  if (typeof body.enableUpload === 'boolean') {
    updates.ENABLE_UPLOAD = body.enableUpload ? 'true' : 'false';
  }
  if (body.maxFileSize != null && String(body.maxFileSize).trim() !== '') {
    updates.MAX_FILE_SIZE = parseMaxFileSizeToBytes(body.maxFileSize);
  }

  const secretAssign = {
    baiduMapAk: 'NEXT_PUBLIC_BAIDU_MAP_AK',
    tiandituTk: 'NEXT_PUBLIC_TIANDITU_TK',
    tiandituServerTk: 'TIANDITU_SERVER_TK',
    openaiApiKey: 'OPENAI_API_KEY',
    hhoApiKey: 'HHO_API_KEY',
  };
  Object.entries(secretAssign).forEach(([from, key]) => {
    if (body[from] === undefined || body[from] === null) return;
    const v = String(body[from]).trim();
    if (v === '') return; // leave unchanged
    updates[key] = v;
  });

  ensureJwtSecretInUpdates(updates, current);
  return { updates, current };
}

function getMaskedSetupView() {
  const map = getEnvMap();
  const mongo = parseMongoUri(map.MONGODB_URI || process.env.MONGODB_URI || 'mongodb://localhost:27017/kbird');
  const secretView = {};
  [
    'NEXT_PUBLIC_BAIDU_MAP_AK',
    'NEXT_PUBLIC_TIANDITU_TK',
    'TIANDITU_SERVER_TK',
    'OPENAI_API_KEY',
    'HHO_API_KEY',
  ].forEach((key) => {
    secretView[key] = maskSecret(map[key] || process.env[key] || '');
  });

  return {
    dbName: mongo.dbName,
    dbHost: mongo.host,
    dbPort: mongo.port,
    mongoUriSet: Boolean(map.MONGODB_URI || process.env.MONGODB_URI),
    siteName: map.SITE_NAME || process.env.SITE_NAME || 'KBird',
    siteDescription: map.SITE_DESCRIPTION || process.env.SITE_DESCRIPTION || '',
    siteUrl: map.SITE_URL || process.env.SITE_URL || 'http://localhost:13080',
    backendPort: map.PORT || process.env.PORT || '13082',
    frontendPort: (() => {
      try {
        const u = new URL(map.SITE_URL || process.env.SITE_URL || 'http://localhost:13080');
        return u.port || (u.protocol === 'https:' ? '443' : '80');
      } catch {
        return '13080';
      }
    })(),
    openaiBaseUrl: map.OPENAI_BASE_URL || process.env.OPENAI_BASE_URL || '',
    openaiModel: map.OPENAI_MODEL || process.env.OPENAI_MODEL || '',
    hhoApiUrl: map.HHO_API_URL || process.env.HHO_API_URL || '',
    secrets: {
      baiduMapAk: secretView.NEXT_PUBLIC_BAIDU_MAP_AK,
      tiandituTk: secretView.NEXT_PUBLIC_TIANDITU_TK,
      tiandituServerTk: secretView.TIANDITU_SERVER_TK,
      openaiApiKey: secretView.OPENAI_API_KEY,
      hhoApiKey: secretView.HHO_API_KEY,
    },
  };
}

module.exports = {
  ENV_PATH,
  WRITABLE_KEYS,
  SECRET_KEYS,
  ensureEnvFileExists,
  getEnvMap,
  upsertEnvKeys,
  buildMongoUri,
  parseMongoUri,
  maskSecret,
  parseMaxFileSizeToBytes,
  buildUpdatesFromGuiPayload,
  getMaskedSetupView,
};
