/**
 * Export a copyright-safe public bird catalog seed (text fields only).
 *
 * Usage:
 *   node scripts/export-public-bird-seed.js
 *   node scripts/export-public-bird-seed.js --input seeds/birds-array.json --out seeds/birds-public.json
 *   node scripts/export-public-bird-seed.js --mongo   # read from MongoDB (MONGODB_URI / default)
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DEFAULT_INPUT = path.join(ROOT, 'seeds', 'birds-array.json');
const DEFAULT_OUT = path.join(ROOT, 'seeds', 'birds-public.json');

/** Catalog / taxonomy text fields safe for public share. */
const WHITELIST = [
  '_id',
  'name',
  'scientificName',
  'englishName',
  'taxonomyCode',
  'namePinyin',
  'scientificNamePinyin',
  'namePinyinInitials',
  'scientificNamePinyinInitials',
  'description',
  'habitat',
  'distribution',
  'conservationStatus',
  'chinaProtectionLevel',
  'iucnProtectionLevel',
  'category',
  'order',
  'family',
  'genus',
  'species',
  'tags',
  'nameAliases',
  'nameAliasPinyin',
  'nameAliasPinyinInitials',
  'size',
  'weight',
  'wingspan',
  'plumage',
  'bill',
  'legs',
  'behavior',
  'diet',
  'migration',
  'breedingSeason',
  'nestType',
  'clutchSize',
  'identificationTips',
  'similarSpecies',
  'references',
];

const STRIP_ALWAYS = new Set([
  'images',
  'calls',
  'sightings',
  'createdBy',
  'requestedBy',
  'isTemporary',
  'requestStatus',
  'createdAt',
  'updatedAt',
  '__v',
]);

function parseArgs(argv) {
  const args = { input: DEFAULT_INPUT, out: DEFAULT_OUT, mongo: false };
  for (let i = 2; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--mongo') args.mongo = true;
    else if (a === '--input' && argv[i + 1]) {
      args.input = path.resolve(argv[++i]);
    } else if (a === '--out' && argv[i + 1]) {
      args.out = path.resolve(argv[++i]);
    }
  }
  return args;
}

function pickPublicBird(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const out = {};
  for (const key of WHITELIST) {
    if (STRIP_ALWAYS.has(key)) continue;
    if (raw[key] === undefined || raw[key] === null) continue;
    if (Array.isArray(raw[key]) && raw[key].length === 0) {
      // keep empty alias/tag arrays out to keep seed lean
      if (key === 'tags' || key.startsWith('nameAlias')) continue;
    }
    out[key] = raw[key];
  }
  // Never ship media / personal observation arrays even if somehow in whitelist
  delete out.images;
  delete out.calls;
  delete out.sightings;
  if (!out.name || !out.scientificName) return null;
  // Seed import historically required description/habitat/distribution/category
  if (!out.description) out.description = `${out.name}（${out.scientificName}）`;
  if (!out.habitat) out.habitat = '';
  if (!out.distribution) out.distribution = '';
  if (!out.category) {
    const parts = [out.order, out.family, out.genus, out.species].filter(Boolean);
    out.category = parts.length ? parts.join(' > ') : '未分类';
  }
  return out;
}

async function loadFromMongo() {
  // Lazy require so file-only export works without DB
  // eslint-disable-next-line global-require
  require('dotenv').config({ path: path.join(ROOT, '.env') });
  // eslint-disable-next-line global-require
  const mongoose = require('mongoose');
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/kbird';
  await mongoose.connect(uri);
  const Bird = mongoose.model('Bird', new mongoose.Schema({}, { strict: false }));
  const rows = await Bird.find({}).lean();
  await mongoose.connection.close();
  return rows;
}

function loadFromFile(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Input not found: ${filePath}`);
  }
  const raw = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  if (!Array.isArray(raw)) {
    throw new Error('Input JSON must be an array of birds');
  }
  return raw;
}

function assertNoPersonalLeak(birds) {
  const leaks = [];
  for (const b of birds.slice(0, 200)) {
    for (const bad of STRIP_ALWAYS) {
      if (b[bad] !== undefined) leaks.push(`${b.name || b._id}: ${bad}`);
    }
    if (b.images || b.calls || b.sightings) {
      leaks.push(`${b.name || b._id}: media/sightings present`);
    }
  }
  if (leaks.length) {
    throw new Error(`Public seed leak detected:\n${leaks.slice(0, 20).join('\n')}`);
  }
}

async function main() {
  const args = parseArgs(process.argv);
  const source = args.mongo ? await loadFromMongo() : loadFromFile(args.input);
  const birds = [];
  let skipped = 0;
  for (const row of source) {
    // Skip temporary / pending request birds
    if (row.isTemporary || row.requestStatus === 'pending') {
      skipped += 1;
      continue;
    }
    const pub = pickPublicBird(row);
    if (!pub) {
      skipped += 1;
      continue;
    }
    birds.push(pub);
  }

  birds.sort((a, b) => String(a.name).localeCompare(String(b.name), 'zh-CN'));
  assertNoPersonalLeak(birds);

  fs.mkdirSync(path.dirname(args.out), { recursive: true });
  fs.writeFileSync(args.out, `${JSON.stringify(birds, null, 2)}\n`, 'utf8');

  const withAliases = birds.filter((b) => Array.isArray(b.nameAliases) && b.nameAliases.length).length;
  console.log(`Exported ${birds.length} public birds (skipped ${skipped})`);
  console.log(`With aliases: ${withAliases}`);
  console.log(`Wrote: ${args.out}`);
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
