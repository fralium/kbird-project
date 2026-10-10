/** 鸟种图片固定标签（多选）——服务端校验 */
const BIRD_IMAGE_TAG_VALUES = [
  '雄性',
  '雌性',
  '性别不明',
  '成鸟',
  '亚成鸟',
  '幼鸟',
  '繁殖羽',
  '非繁殖羽',
  '换羽',
  '栖息',
  '飞翔',
  '取食',
  '求偶',
];

function normalizeBirdImageTags(input) {
  if (!Array.isArray(input)) return [];
  const allowed = new Set(BIRD_IMAGE_TAG_VALUES);
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
  BIRD_IMAGE_TAG_VALUES,
  normalizeBirdImageTags,
};
