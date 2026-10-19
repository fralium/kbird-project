/**
 * 观察记录中单物种的行为与状态微标签（多选）
 * 注：在未来植物站 (KFlora) 中，同一套字段直接映射为物候状态（展叶 / 花蕾 / 盛花 / 初果 / 熟果 / 落叶）。
 */

const BIRD_OBSERVATION_TAG_OPTIONS = [
  { value: '目击', label: '目击', hint: '直接观察到个体' },
  { value: '听音', label: '听音', hint: '听到鸣唱或叫声识别' },
  { value: '飞过', label: '飞过', hint: '空中高飞或过境掠过' },
  { value: '求偶', label: '求偶', hint: '炫耀、追逐、鸣唱占区或交配' },
  { value: '筑巢/携巢材', label: '筑巢/携材', hint: '衔枝、营巢或孵卵' },
  { value: '育雏/喂食', label: '育雏/喂食', hint: '亲鸟携食喂雏或带领出飞幼鸟' },
  { value: '取食', label: '取食', hint: '捕食、觅食或饮水' },
  { value: '集群', label: '集群', hint: '多只结群活动或夜栖集群' },
];

const BIRD_OBSERVATION_TAG_VALUES = BIRD_OBSERVATION_TAG_OPTIONS.map((item) => item.value);

function normalizeBirdObservationTags(input) {
  if (!Array.isArray(input)) return [];
  const allowed = new Set(BIRD_OBSERVATION_TAG_VALUES);
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
  BIRD_OBSERVATION_TAG_OPTIONS,
  BIRD_OBSERVATION_TAG_VALUES,
  normalizeBirdObservationTags,
};
