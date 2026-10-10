/**
 * Look up unmatched 三有 names against DB bird names.
 */
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const Bird = require('../server/models/birdModel');

const missing = process.argv.slice(2);
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/kbird';

(async () => {
  await mongoose.connect(MONGODB_URI);
  const names = await Bird.find({}).select('name').lean();
  missing.forEach((q) => {
    const hits = names
      .filter((b) => b.name.includes(q.slice(-2)) || b.name.includes(q.slice(0, 2)))
      .map((b) => b.name)
      .slice(0, 8);
    console.log(`${q} → ${hits.join(' / ') || '无'}`);
  });
  await mongoose.disconnect();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
