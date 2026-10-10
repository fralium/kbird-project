/** 鸟种图片固定标签（多选） */
export const BIRD_IMAGE_TAG_GROUPS = [
  {
    id: 'sex',
    label: '性别',
    options: [
      { value: '雄性', label: '雄性' },
      { value: '雌性', label: '雌性' },
      { value: '性别不明', label: '不明' },
    ],
  },
  {
    id: 'age',
    label: '年龄',
    options: [
      { value: '成鸟', label: '成鸟' },
      { value: '亚成鸟', label: '亚成鸟' },
      { value: '幼鸟', label: '幼鸟' },
    ],
  },
  {
    id: 'plumage',
    label: '羽相',
    options: [
      { value: '繁殖羽', label: '繁殖羽' },
      { value: '非繁殖羽', label: '非繁殖羽' },
      { value: '换羽', label: '换羽' },
    ],
  },
  {
    id: 'pose',
    label: '姿态',
    options: [
      { value: '栖息', label: '栖息' },
      { value: '飞翔', label: '飞翔' },
      { value: '取食', label: '取食' },
      { value: '求偶', label: '求偶' },
    ],
  },
];

export const BIRD_IMAGE_TAG_VALUES = BIRD_IMAGE_TAG_GROUPS.flatMap((group) =>
  group.options.map((option) => option.value)
);

export function normalizeBirdImageTags(input) {
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
