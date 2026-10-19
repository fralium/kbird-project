/* global process, Buffer */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { extractPhotoExif, parseExifDateString } = require('../../server/utils/exifParser');
const {
  extractTagsFromFilename,
  extractDateFromFilename,
  parsePhotoFileMetadata,
} = require('../../data/photoFilenameParser');
const {
  BIRD_OBSERVATION_TAG_VALUES,
  normalizeBirdObservationTags,
} = require('../../data/birdObservationTags');

const root = process.cwd();

test('P0/P1 new component and utility files exist', () => {
  const requiredFiles = [
    'server/utils/exifParser.js',
    'data/photoFilenameParser.js',
    'data/birdObservationTags.js',
    'components/PhenologyMonthBar.js',
    'components/TaxonCompareDrawer.js',
    'components/OutingJournalCardModal.js',
    'utils/compareStore.js',
    'utils/locationBirdCalendar.js',
    'app/personal/guide/page.js',
  ];

  requiredFiles.forEach((rel) => {
    assert.equal(fs.existsSync(path.join(root, rel)), true, `Missing required file: ${rel}`);
  });
});

test('P0-1 exifParser parses EXIF date string and minimal JPEG APP1 EXIF header', async () => {
  const d = parseExifDateString('2025:10:19 08:30:15');
  assert.ok(d && d.date instanceof Date, 'should parse EXIF date string');
  assert.equal(d.dateKey, '2025-10-19');

  // Construct a synthetic JPEG with APP1 Exif header (little-endian 'II', DateTime 0x0132)
  const dateAscii = Buffer.from('2024:05:12 06:45:00\0', 'ascii'); // 20 bytes
  const tiff = Buffer.alloc(8 + 2 + 12 + 4 + dateAscii.length);
  tiff.write('II', 0, 'ascii');
  tiff.writeUInt16LE(42, 2);
  tiff.writeUInt32LE(8, 4); // IFD0 offset = 8
  tiff.writeUInt16LE(1, 8); // 1 entry
  tiff.writeUInt16LE(0x0132, 10); // Tag: DateTime
  tiff.writeUInt16LE(2, 12); // Type: ASCII
  tiff.writeUInt32LE(dateAscii.length, 14); // Count
  tiff.writeUInt32LE(26, 18); // Value offset (8 + 2 + 12 + 4 = 26)
  tiff.writeUInt32LE(0, 22); // Next IFD = 0
  dateAscii.copy(tiff, 26);

  const exifHeader = Buffer.from('Exif\0\0', 'ascii');
  const app1Length = 2 + exifHeader.length + tiff.length;
  const jpeg = Buffer.alloc(2 + 2 + app1Length);
  jpeg[0] = 0xff;
  jpeg[1] = 0xd8; // SOI
  jpeg[2] = 0xff;
  jpeg[3] = 0xe1; // APP1
  jpeg.writeUInt16BE(app1Length, 4);
  exifHeader.copy(jpeg, 6);
  tiff.copy(jpeg, 12);

  const tmpFile = path.join(os.tmpdir(), `kbird-exif-test-${Date.now()}.jpg`);
  fs.writeFileSync(tmpFile, jpeg);
  try {
    const parsed = await extractPhotoExif(tmpFile);
    assert.ok(parsed.capturedAt instanceof Date, 'should extract capturedAt from JPEG EXIF');
    assert.equal(parsed.dateKey, '2024-05-12');
  } finally {
    fs.unlinkSync(tmpFile);
  }
});

test('P0-1 photoFilenameParser extracts tags, date, and matches location catalog', () => {
  const tags = extractTagsFromFilename('红胁蓝尾鸲_雄鸟_亚成_飞翔版_DSC_1024.jpg', '');
  assert.ok(tags.includes('雄性'));
  assert.ok(tags.includes('亚成鸟'));
  assert.ok(tags.includes('飞翔'));

  const dt = extractDateFromFilename('2025-11-08_圆明园_红胁蓝尾鸲.jpg', '');
  assert.ok(dt && dt.date instanceof Date);
  assert.equal(dt.dateKey, '2025-11-08');

  const meta = parsePhotoFileMetadata({
    fileName: '20251108_圆明园_雄鸟_取食_IMG_8891.jpg',
    folderPath: '红胁蓝尾鸲',
    birdName: '红胁蓝尾鸲',
    knownLocationNames: ['圆明园遗址公园', '奥林匹克森林公园'],
  });
  assert.ok(meta.inferredTags.includes('雄性'));
  assert.ok(meta.inferredTags.includes('取食'));
  assert.equal(meta.inferredLocation, '圆明园遗址公园');
  assert.equal(meta.dateKey, '2025-11-08');
});

test('P0-2 birdObservationTags normalizes and deduplicates valid tags', () => {
  assert.ok(BIRD_OBSERVATION_TAG_VALUES.includes('听音'));
  const normalized = normalizeBirdObservationTags(['目击', '听音', '目击', '求偶', '']);
  assert.deepEqual(normalized, ['目击', '听音', '求偶']);
});

test('P1-1 & P1-2 ES modules (compareStore & locationBirdCalendar) work as expected', async () => {
  const { extractSimilarBirdNames } = await import('../../utils/compareStore.js');
  const names = extractSimilarBirdNames('与极北柳莺、黄眉柳莺相似，但翼斑更明显。', '暗绿柳莺');
  assert.ok(names.includes('极北柳莺'));
  assert.ok(names.includes('黄眉柳莺'));

  const { buildLocationPatchPhenology } = await import('../../utils/locationBirdCalendar.js');
  const sampleRecords = [
    {
      date: '2025-04-15T08:00:00.000Z',
      birds: [
        { birdId: { _id: 'b1', name: '戴胜', scientificName: 'Upupa epops' }, count: 2 },
        { birdId: { _id: 'b2', name: '白头鹎', scientificName: 'Pycnonotus sinensis' }, count: 5 },
      ],
    },
    {
      date: '2026-04-05T08:00:00.000Z',
      birds: [
        { birdId: { _id: 'b1', name: '戴胜', scientificName: 'Upupa epops' }, count: 1 },
        { birdId: { _id: 'b3', name: '黄眉柳莺', scientificName: 'Phylloscopus inornatus' }, count: 3 },
      ],
    },
  ];

  const pheno = buildLocationPatchPhenology(sampleRecords);
  assert.equal(pheno.years.length, 2);
  assert.equal(pheno.recurringSpeciesCount, 1);
  const year2026 = pheno.years.find((y) => y.year === 2026);
  assert.equal(year2026.retentionRate, 50);
  assert.equal(year2026.newPatchSpeciesCount, 1);

  const hoopoe = pheno.speciesRows.find((s) => s.id === 'b1');
  assert.ok(hoopoe);
  assert.equal(hoopoe.yearCount, 2);
  assert.ok(hoopoe.arrivalShiftDays < 0, '2026 arrival (04-05) should be earlier than 2025 (04-15)');
});
