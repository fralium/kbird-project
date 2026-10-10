/**
 * 将观鸟记录中「地点名称 A」合并为「地点名称 B」（完全字符串匹配）
 *
 * 背景：统计、热门地点等按 record.location.name 精确分组。同一地点若写法不同
 * （如「浙江省杭州市余杭区 五常湿地」与「五常湿地，浙江省 • 杭州市 • 余杭区」）
 * 会被算作两处。本脚本把前者全部改为后者，并统一坐标与 address 快照。
 *
 * 用法（项目根目录，需配置 .env 中 MONGODB_URI）:
 *   node scripts/merge-record-locations-by-name.js "旧名称全文" "新名称全文"
 *   node scripts/merge-record-locations-by-name.js "旧名称" "新名称" --dry-run
 *
 * 示例:
 *   node scripts/merge-record-locations-by-name.js --list 五常湿地
 *   node scripts/merge-record-locations-by-name.js "浙江省杭州市余杭区 五常湿地" "五常湿地，浙江省 • 杭州市 • 余杭区" --dry-run
 *
 * 逻辑:
 * - 匹配 location.name === 旧名称（trim 后，含草稿）
 * - 坐标/地址优先从已有「新名称」的最近一条观鸟记录复制；若无则从 Location(active) 复制
 * - 若地点名录存在 name === 旧名称 的文档，合并后将其 status 设为 archived
 */
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const Record = require('../server/models/recordModel');
const Location = require('../server/models/locationModel');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/kbird';

function escapeRegex(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function parseArgs(argv) {
  const dryRun = argv.includes('--dry-run');
  const listIdx = argv.indexOf('--list');
  if (listIdx !== -1) {
    const sub = argv[listIdx + 1];
    if (!sub || sub.startsWith('--')) {
      return { mode: 'list', listSub: null, dryRun: false };
    }
    return { mode: 'list', listSub: sub, dryRun: false };
  }
  const rest = argv.slice(2).filter((a) => a !== '--dry-run' && a !== '--list');
  return { mode: 'merge', fromName: rest[0], toName: rest[1], dryRun };
}

function buildSetPayloadFromRef(ref) {
  const loc = ref.location || ref;
  const name = String(loc.name || '').trim();
  const coords = loc.coordinates?.coordinates;
  const lng = Array.isArray(coords) && coords.length >= 2 ? Number(coords[0]) : null;
  const lat = Array.isArray(coords) && coords.length >= 2 ? Number(coords[1]) : null;
  const addr = loc.address || {};
  const useDefault = !Number.isFinite(lng) || !Number.isFinite(lat) || (lng === 0 && lat === 0);
  return {
    'location.name': name,
    'location.coordinates': {
      type: 'Point',
      coordinates: useDefault ? [120.1551, 30.2741] : [lng, lat],
    },
    'location.address': {
      province: addr.province || '',
      city: addr.city || '',
      district: addr.district || '',
      detail: addr.detail || addr.street || '',
    },
  };
}

async function main() {
  const args = parseArgs(process.argv);

  if (args.mode === 'list') {
    if (!args.listSub) {
      console.error('请提供关键词: node scripts/merge-record-locations-by-name.js --list 五常湿地');
      process.exit(1);
    }
    await mongoose.connect(MONGODB_URI);
    const sub = escapeRegex(String(args.listSub).trim());
    const rx = new RegExp(sub, 'i');
    const rows = await Record.aggregate([
      { $match: { status: { $ne: 'draft' }, 'location.name': rx } },
      { $group: { _id: '$location.name', n: { $sum: 1 } } },
      { $sort: { n: -1 } },
    ]);
    console.log(`非草稿记录中，地点名包含「${args.listSub}」的分组（请复制全文用于合并）:\n`);
    rows.forEach((r) => console.log(`  [${r.n} 条] ${r._id}`));
    console.log(`\n共 ${rows.length} 种不同写法。`);
    await mongoose.disconnect();
    return;
  }

  const { fromName, toName, dryRun } = args;
  if (!fromName || !toName) {
    console.error('用法:');
    console.error('  合并: node scripts/merge-record-locations-by-name.js "旧名称全文" "新名称全文" [--dry-run]');
    console.error('  列举: node scripts/merge-record-locations-by-name.js --list 关键词');
    process.exit(1);
  }
  const fromTrim = String(fromName).trim();
  const toTrim = String(toName).trim();
  if (fromTrim === toTrim) {
    console.error('旧名称与新名称相同，无需合并。');
    process.exit(1);
  }

  await mongoose.connect(MONGODB_URI);
  console.log('已连接 MongoDB');

  const countFrom = await Record.countDocuments({ 'location.name': fromTrim });
  console.log(`\n使用旧名称的记录总数: ${countFrom} 条（含草稿）`);
  if (countFrom === 0) {
    console.log('没有需要合并的记录，退出。');
    await mongoose.disconnect();
    return;
  }

  let refWrapper = null;
  const refRecord = await Record.findOne({ 'location.name': toTrim })
    .sort({ date: -1 })
    .lean();
  if (refRecord) {
    refWrapper = refRecord;
  } else {
    const locDoc = await Location.findOne({ name: toTrim, status: 'active' }).lean();
    if (locDoc) {
      refWrapper = {
        location: {
          name: locDoc.name,
          coordinates: locDoc.coordinates,
          address: locDoc.address,
        },
      };
    }
  }

  if (!refWrapper) {
    console.error(
      `\n错误: 找不到「新名称」的参考数据：\n  "${toTrim}"\n` +
        '请至少存在一条使用该 location.name 的记录，或地点名录中有同名 active 地点。'
    );
    process.exit(1);
  }

  const payload = buildSetPayloadFromRef(refWrapper);
  payload['location.name'] = toTrim;

  console.log('\n参考来源:', refRecord ? '观鸟记录（按 date 最近）' : '地点名录 Location');
  console.log('将写入的 location 字段:');
  console.log(JSON.stringify(payload, null, 2));

  if (dryRun) {
    console.log('\n[--dry-run] 未写入数据库。去掉 --dry-run 后执行实际合并。');
    await mongoose.disconnect();
    return;
  }

  const resAll = await Record.updateMany({ 'location.name': fromTrim }, { $set: payload });
  console.log(`\n已更新记录: matched=${resAll.matchedCount}, modified=${resAll.modifiedCount}`);

  const locOld = await Location.findOne({ name: fromTrim });
  if (locOld) {
    locOld.status = 'archived';
    await locOld.save({ validateBeforeSave: false });
    console.log(`地点名录: 已将旧名称文档标为 archived → "${fromTrim}"`);
  } else {
    console.log('地点名录: 无与旧名称完全一致的文档。');
  }

  console.log(
    '\n说明: 两条原始字符串不同，但通常指向同一实地（如都含「五常湿地」）。合并后统计会合并为一条。'
  );
  console.log('完成。');
  await mongoose.disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
