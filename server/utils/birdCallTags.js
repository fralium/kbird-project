/** 鸟种鸣叫固定标签（多选）——服务端校验 */
const BIRD_CALL_TAG_VALUES = [
  '鸣唱',
  '鸣叫',
  '警戒',
  '求偶',
  '飞行',
  '幼鸟',
  '其它',
];

function normalizeBirdCallTags(input) {
  if (!Array.isArray(input)) return [];
  const allowed = new Set(BIRD_CALL_TAG_VALUES);
  const seen = new Set();
  const result = [];
  input.forEach((raw) => {
    const value = String(raw || '').trim();
    if (!value || !allowed.has(value) || seen.has(value)) return;
    seen.add(value);
    result.push(value);
  });
  return result;
}

module.exports = {
  BIRD_CALL_TAG_VALUES,
  normalizeBirdCallTags,
};
