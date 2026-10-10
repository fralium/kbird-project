/**
 * 为图鉴中文别名补拼音/首字母，供搜索使用。
 *
 *   node scripts/backfill-alias-pinyin.js
 *   node scripts/backfill-alias-pinyin.js --apply
 */
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const Bird = require('../server/models/birdModel');
const { buildAliasPinyinFields } = require('../server/utils/birdSearch');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/kbird';
const apply = process.argv.includes('--apply');

(async () => {
  await mongoose.connect(MONGODB_URI);
  const birds = await Bird.find({}).select('name nameAliases nameAliasPinyinInitials').lean();
  let changed = 0;
  for (const bird of birds) {
    const next = buildAliasPinyinFields(bird.name, bird.nameAliases || []);
    const prev = (bird.nameAliasPinyinInitials || []).join(',');
    const now = next.nameAliasPinyinInitials.join(',');
    if (prev === now && (bird.nameAliases || []).length === 0 && next.nameAliasPinyinInitials.length === 0) {
      continue;
    }
    if (prev === now) continue;
    changed += 1;
    if (!apply) {
      if (changed <= 12) {
        console.log(`${bird.name}: ${prev || '(无)'} → ${now || '(无)'}`);
      }
      continue;
    }
    await Bird.updateOne(
      { _id: bird._id },
      {
        $set: {
          nameAliasPinyin: next.nameAliasPinyin,
          nameAliasPinyinInitials: next.nameAliasPinyinInitials,
        },
      }
    );
  }
  console.log(JSON.stringify({ total: birds.length, changed, apply }, null, 2));
  await mongoose.disconnect();
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
