/**
 * Pre-push hygiene: flag personal paths / secrets that should not ship to Gitee.
 * Run from repo root: node scripts/check-share-hygiene.js
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SKIP_DIRS = new Set([
  'node_modules',
  '.next',
  'temp',
  'uploads',
  'KBird-Data',
  '.git',
  'coverage',
  'backups',
]);

const PATTERNS = [
  { name: 'absolute-D-CADD', re: /D:[/\\]CADD/i },
  { name: 'Users-frali', re: /Users[/\\]frali/i },
  { name: 'AIDD-path', re: /AIDD[/\\]KBird/i },
  { name: 'personal-bird-photos-path', re: /鸟类分类照片/ },
  { name: 'mongo-8.0-hardcoded', re: /MongoDB\\Server\\8\.0/i },
  { name: 'hardcoded-jwt', re: /JWT_SECRET\s*=\s*['"](?!your-|change-me)[^'"]{16,}['"]/ },
  { name: 'openai-key-literal', re: /OPENAI_API_KEY\s*=\s*['"][^'"]{8,}['"]/ },
  { name: 'baidu-ak-literal', re: /BAIDU_MAP_AK\s*=\s*['"][^'"y][^'"]{8,}['"]/i },
  { name: 'tianditu-tk-literal', re: /TIANDITU_(SERVER_)?TK\s*=\s*['"][^'"y][^'"]{8,}['"]/i },
];

const TEXT_EXT = new Set([
  '.js',
  '.jsx',
  '.mjs',
  '.cjs',
  '.ts',
  '.tsx',
  '.md',
  '.ps1',
  '.bat',
  '.sh',
  '.yml',
  '.yaml',
  '.example',
  '.json',
  '.css',
  '.txt',
]);

function walk(dir, out = []) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const ent of entries) {
    if (ent.name.startsWith('.') && ent.name !== '.env.example') continue;
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      if (SKIP_DIRS.has(ent.name)) continue;
      walk(full, out);
    } else if (TEXT_EXT.has(path.extname(ent.name).toLowerCase()) || ent.name === 'env.example') {
      out.push(full);
    }
  }
  return out;
}

const hits = [];
for (const file of walk(ROOT)) {
  const rel = path.relative(ROOT, file);
  if (rel === path.join('scripts', 'check-share-hygiene.js')) continue;
  if (rel.startsWith(`seeds${path.sep}birds-array`)) continue;
  let text;
  try {
    text = fs.readFileSync(file, 'utf8');
  } catch {
    continue;
  }
  const lines = text.split(/\r?\n/);
  lines.forEach((line, i) => {
    for (const p of PATTERNS) {
      if (p.re.test(line)) {
        hits.push(`${rel}:${i + 1} [${p.name}] ${line.trim().slice(0, 120)}`);
      }
    }
  });
}

const warnings = [];
if (fs.existsSync(path.join(ROOT, '.env'))) {
  warnings.push('.env exists locally (OK if gitignored; never commit it)');
}

if (hits.length) {
  console.error('Share hygiene FAIL:\n');
  hits.forEach((h) => console.error(`  ${h}`));
  console.error(`\n${hits.length} finding(s). Fix before git push.`);
  process.exit(1);
}

if (warnings.length) {
  console.log('Share hygiene OK (with notes):');
  warnings.forEach((w) => console.log(`  - ${w}`));
} else {
  console.log('Share hygiene OK: no personal path / secret literals found in scanned files.');
}
process.exit(0);
