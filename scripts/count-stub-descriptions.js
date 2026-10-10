/**
 * 统计仍使用模板介绍的鸟种（「在中国分布广泛，是重要的鸟类资源」一类）
 *   node scripts/count-stub-descriptions.js
 */
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const Bird = require('../server/models/birdModel');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/kbird';
const STUB_RE = /是重要的鸟类资源/;

(async () => {
  await mongoose.connect(MONGODB_URI);
  const total = await Bird.countDocuments({});
  const resource = await Bird.find({ description: STUB_RE })
    .select('name scientificName family order description habitat distribution')
    .sort({ name: 1 })
    .lean();
  const widespread = await Bird.countDocuments({ description: /在中国分布广泛/ });
  const habit = await Bird.countDocuments({ description: /独特的生态习性/ });
  const unknown = await Bird.countDocuments({ description: /未知/ });

  const byFamily = {};
  resource.forEach((b) => {
    const key = b.family || '未填科';
    if (!byFamily[key]) byFamily[key] = [];
    byFamily[key].push(b.name);
  });

  const Record = require('../server/models/recordModel');
  const stubIds = resource.map((b) => b._id);
  const observedIds = new Set();
  const cursor = Record.find({ 'birds.birdId': { $in: stubIds } }).select('birds.birdId').lean().cursor();
  for await (const r of cursor) {
    for (const item of r.birds || []) {
      const id = item?.birdId ? String(item.birdId) : '';
      if (id) observedIds.add(id);
    }
  }
  const observedStub = resource.filter((b) => observedIds.has(String(b._id)));
  const familyCount = Object.fromEntries(
    Object.entries(byFamily).map(([k, v]) => [k, v.length]).sort((a, b) => b[1] - a[1])
  );

  console.log(
    JSON.stringify(
      {
        total,
        stubCount: resource.length,
        observedStubCount: observedStub.length,
        otherHits: {
          在中国分布广泛: widespread,
          独特的生态习性: habit,
          描述含未知: unknown,
        },
        sampleDescription: resource[0]?.description || null,
        observedStubNames: observedStub.map((b) => b.name),
        familyCount,
      },
      null,
      2
    )
  );
  await mongoose.disconnect();
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
