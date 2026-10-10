const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

/**
 * Idempotent import of public bird text seed into the current mongoose connection.
 * Skips docs that already exist (by _id or name).
 */
async function seedBirdsIfEmpty({ force = false } = {}) {
  const Bird = require('../models/birdModel');
  const projectRoot = path.resolve(__dirname, '..', '..');
  const candidates = [
    path.join(projectRoot, 'seeds', 'birds-public.json'),
    path.join(projectRoot, 'seeds', 'birds-array.json'),
  ];
  const seedPath = candidates.find((p) => fs.existsSync(p));
  if (!seedPath) {
    return { seeded: false, reason: 'no_seed_file', imported: 0, skipped: 0 };
  }

  const count = await Bird.countDocuments();
  if (!force && count > 0) {
    return { seeded: false, reason: 'already_has_birds', imported: 0, skipped: count, seedPath };
  }

  const raw = JSON.parse(fs.readFileSync(seedPath, 'utf8'));
  if (!Array.isArray(raw)) {
    return { seeded: false, reason: 'invalid_seed', imported: 0, skipped: 0 };
  }

  let imported = 0;
  let skipped = 0;

  for (const bird of raw) {
    try {
      const existing = bird._id
        ? await Bird.findOne({ _id: bird._id }).select('_id').lean()
        : await Bird.findOne({ name: bird.name }).select('_id').lean();
      if (existing) {
        skipped += 1;
        continue;
      }

      const doc = { ...bird };
      if (!doc.createdBy) {
        doc.createdBy = new mongoose.Types.ObjectId();
      }
      if (!Array.isArray(doc.images)) doc.images = [];
      if (!Array.isArray(doc.calls)) doc.calls = [];
      if (!Array.isArray(doc.sightings)) doc.sightings = [];

      await Bird.create(doc);
      imported += 1;
    } catch {
      skipped += 1;
    }
  }

  return {
    seeded: imported > 0,
    reason: 'ok',
    imported,
    skipped,
    seedPath,
  };
}

module.exports = { seedBirdsIfEmpty };
