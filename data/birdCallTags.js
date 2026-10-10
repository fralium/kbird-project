/** 鸟种鸣叫固定标签（多选） */
export const BIRD_CALL_TAG_GROUPS = [
  {
    id: 'type',
    label: '类型',
    options: [
      { value: '鸣唱', label: '鸣唱' },
      { value: '鸣叫', label: '鸣叫' },
      { value: '警戒', label: '警戒' },
      { value: '求偶', label: '求偶' },
      { value: '飞行', label: '飞行' },
      { value: '幼鸟', label: '幼鸟' },
      { value: '其它', label: '其它' },
    ],
  },
];

export const BIRD_CALL_TAG_VALUES = BIRD_CALL_TAG_GROUPS.flatMap((group) =>
  group.options.map((option) => option.value)
);

export function normalizeBirdCallTags(input) {
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
