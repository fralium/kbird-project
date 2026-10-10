/**
 * 用地点词典回填观鸟记录里空的省/市/区。
 * 已有非空字段不覆盖。
 *
 *   node scripts/backfill-record-addresses.js
 *   node scripts/backfill-record-addresses.js --dry-run
 */
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const Record = require('../server/models/recordModel');
const Location = require('../server/models/locationModel');
const { findActiveLocationByFlexibleName } = require('../server/utils/locationName');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/kbird';
const dryRun = process.argv.includes('--dry-run');

const missingAddressFilter = {
  $or: [
    { 'location.address': { $exists: false } },
    { 'location.address.province': { $in: [null, ''] } },
    { 'location.address.city': { $in: [null, ''] } },
    { 'location.address.district': { $in: [null, ''] } },
  ],
};

const hasAdmin = (addr = {}) =>
  Boolean(String(addr.province || '').trim() || String(addr.city || '').trim() || String(addr.district || '').trim());

(async () => {
  await mongoose.connect(MONGODB_URI);

  const locations = await Location.find({ status: 'active' }).select('name address').lean();
  const byName = new Map(
    locations
      .filter((item) => hasAdmin(item.address))
      .map((item) => [String(item.name || '').trim(), item])
  );

  const records = await Record.find(missingAddressFilter)
    .select('location.name location.address')
    .lean();

  const uniqueNames = [
    ...new Set(records.map((item) => String(item.location?.name || '').trim()).filter(Boolean)),
  ];
  const resolvedByName = new Map();
  const unmatchedNames = [];

  for (const name of uniqueNames) {
    let loc = byName.get(name) || null;
    if (!loc) {
      loc = await findActiveLocationByFlexibleName(Location, name);
      loc = loc && hasAdmin(loc.address) ? loc : null;
    }
    if (loc) resolvedByName.set(name, loc);
    else unmatchedNames.push(name);
  }

  const ops = [];
  let filled = 0;
  let skippedNoDict = 0;
  let skippedNoChange = 0;

  for (const record of records) {
    const name = String(record.location?.name || '').trim();
    const dict = resolvedByName.get(name);
    if (!dict) {
      skippedNoDict += 1;
      continue;
    }
    const snap = record.location?.address && typeof record.location.address === 'object'
      ? record.location.address
      : {};
    const fromDict = dict.address || {};
    const next = {
      province: String(snap.province || fromDict.province || '').trim(),
      city: String(snap.city || fromDict.city || '').trim(),
      district: String(snap.district || fromDict.district || '').trim(),
      detail: String(snap.detail || fromDict.street || fromDict.detail || '').trim(),
    };
    const changed =
      next.province !== String(snap.province || '').trim() ||
      next.city !== String(snap.city || '').trim() ||
      next.district !== String(snap.district || '').trim() ||
      next.detail !== String(snap.detail || '').trim();
    if (!changed) {
      skippedNoChange += 1;
      continue;
    }
    filled += 1;
    ops.push({
      updateOne: {
        filter: { _id: record._id },
        update: { $set: { 'location.address': next } },
      },
    });
  }

  if (!dryRun && ops.length) {
    const chunk = 500;
    for (let i = 0; i < ops.length; i += chunk) {
      await Record.bulkWrite(ops.slice(i, i + chunk), { ordered: false });
    }
  }

  const stillMissing = dryRun
    ? records.length - filled
    : await Record.countDocuments(missingAddressFilter);

  const sample = await Record.findById('698c21879d8015f005dd4529')
    .select('location.name location.address date')
    .lean();

  console.log(
    JSON.stringify(
      {
        dryRun,
        recordsNeedingFill: records.length,
        uniqueLocationNames: uniqueNames.length,
        updated: filled,
        skippedNoDict,
        skippedNoChange,
        stillMissingAddress: stillMissing,
        unmatchedNames: unmatchedNames.slice(0, 40),
        unmatchedCount: unmatchedNames.length,
        tianmuxi: sample,
      },
      null,
      2
    )
  );

  await mongoose.disconnect();
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
