const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const Location = require('../server/models/locationModel');
const Record = require('../server/models/recordModel');

const { stripLocationRegionPrefix } = require('../server/utils/locationName');

/**
 * 去掉「省市区 + 空格」前缀，例如：
 * 「浙江省杭州市临安区 西天目山」→「西天目山」
 */
function stripRegionPrefix(name) {
  return stripLocationRegionPrefix(name);
}

const dryRun = process.argv.includes('--dry-run');

(async () => {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/kbird');

  const prefixed = await Location.find({
    status: { $in: ['active', 'archived', 'inactive'] },
    name: /\s+\S/,
  })
    .select('name address status')
    .lean();

  const candidates = [];
  for (const loc of prefixed) {
    const short = stripRegionPrefix(loc.name);
    if (!short || short === loc.name) continue;
    // 仅处理「前缀看起来像省市区」的
    if (!/[省市县区州旗]/.test(loc.name.slice(0, loc.name.length - short.length))) continue;
    candidates.push({ loc, short });
  }

  console.log('candidates', candidates.length, dryRun ? '(dry-run)' : '(write)');

  let renamed = 0;
  let mergedIntoExisting = 0;
  let recordsUpdated = 0;
  let archivedDup = 0;
  const conflicts = [];

  for (const { loc, short } of candidates) {
    const existing = await Location.findOne({
      name: short,
      _id: { $ne: loc._id },
    });

    const recordCount = await Record.countDocuments({ 'location.name': loc.name });

    if (existing) {
      conflicts.push({
        from: loc.name,
        to: short,
        existingId: String(existing._id),
        existingStatus: existing.status,
        records: recordCount,
      });
      if (!dryRun) {
        // 记录改到短名；旧长名地点归档
        if (recordCount > 0) {
          const setPayload = {
            'location.name': short,
            'location.address.province':
              existing.address?.province || loc.address?.province || '',
            'location.address.city': existing.address?.city || loc.address?.city || '',
            'location.address.district':
              existing.address?.district || loc.address?.district || '',
          };
          if (existing.coordinates?.coordinates) {
            setPayload['location.coordinates'] = existing.coordinates;
          }
          const res = await Record.updateMany({ 'location.name': loc.name }, { $set: setPayload });
          recordsUpdated += res.modifiedCount || 0;
        }
        if (loc.status === 'active') {
          await Location.updateOne({ _id: loc._id }, { $set: { status: 'archived' } });
          archivedDup += 1;
        }
        if (existing.status !== 'active') {
          await Location.updateOne({ _id: existing._id }, { $set: { status: 'active' } });
        }
        mergedIntoExisting += 1;
      }
      console.log('MERGE', loc.name, '->', short, `(records=${recordCount})`);
      continue;
    }

    console.log('RENAME', loc.name, '->', short, `(records=${recordCount})`);
    if (!dryRun) {
      if (recordCount > 0) {
        const setPayload = {
          'location.name': short,
        };
        // 尽量保留原 address；若空则不覆盖
        const res = await Record.updateMany({ 'location.name': loc.name }, { $set: setPayload });
        recordsUpdated += res.modifiedCount || 0;
      }
      await Location.updateOne({ _id: loc._id }, { $set: { name: short } });
      renamed += 1;
    }
  }

  console.log('\nSummary:');
  console.log(' renamed locations:', renamed);
  console.log(' merged into existing short name:', mergedIntoExisting);
  console.log(' records updated:', recordsUpdated);
  console.log(' archived duplicate long names:', archivedDup);
  console.log(' conflict/merge cases:', conflicts.length);

  await mongoose.disconnect();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
