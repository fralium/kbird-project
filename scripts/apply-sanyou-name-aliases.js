/**
 * 把三有名录中文异名写入图鉴 nameAliases（详情页「中文别名」）。
 * 若异名已是另一种的主名，则跳过，避免搜索撞名。
 *
 *   node scripts/apply-sanyou-name-aliases.js
 *   node scripts/apply-sanyou-name-aliases.js --apply
 */
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const Bird = require('../server/models/birdModel');
const report = require('../data/china-sanyou-aves-conflicts.json');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/kbird';
const apply = process.argv.includes('--apply');

(async () => {
  const pairs = (report.synonymZh || [])
    .filter((row) => row.listName && row.dbName && row.listName !== row.dbName)
    .map((row) => ({ listName: row.listName, dbName: row.dbName }));

  await mongoose.connect(MONGODB_URI);
  const birds = await Bird.find({}).select('_id name nameAliases').lean();
  const byName = new Map(birds.map((b) => [b.name, b]));

  const skippedCollision = [];
  const skippedMissing = [];
  const alreadyHas = [];
  const toAdd = [];

  pairs.forEach((pair) => {
    const owner = byName.get(pair.dbName);
    if (!owner) {
      skippedMissing.push(pair);
      return;
    }
    const collision = byName.get(pair.listName);
    if (collision && collision.name !== pair.dbName) {
      skippedCollision.push({ ...pair, collisionName: collision.name });
      return;
    }
    const aliases = owner.nameAliases || [];
    if (aliases.includes(pair.listName)) {
      alreadyHas.push(pair);
      return;
    }
    toAdd.push({ ...pair, id: owner._id, current: aliases });
  });

  console.log(
    JSON.stringify(
      {
        pairs: pairs.length,
        toAdd: toAdd.length,
        alreadyHas: alreadyHas.length,
        skippedCollision: skippedCollision.length,
        skippedMissing: skippedMissing.length,
        apply,
      },
      null,
      2
    )
  );
  toAdd.forEach((row) => console.log(`  + ${row.dbName} ← ${row.listName}`));
  if (skippedCollision.length) {
    console.log('\n跳过（异名已是另一种主名）:');
    skippedCollision.forEach((row) => console.log(`  - ${row.listName} → ${row.dbName}（主名占用）`));
  }

  if (!apply) {
    console.log('\n干跑完成。确认后加 --apply 写入。');
    await mongoose.disconnect();
    return;
  }

  let modified = 0;
  for (const row of toAdd) {
    const result = await Bird.updateOne({ _id: row.id }, { $addToSet: { nameAliases: row.listName } });
    modified += result.modifiedCount || 0;
  }
  console.log(JSON.stringify({ applied: true, modified }, null, 2));
  await mongoose.disconnect();
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
