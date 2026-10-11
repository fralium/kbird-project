/**
 * 鸟种资料：提问模板 + 粘贴回填解析
 * 流程：复制提问 → 外部大模型填写 → 粘贴 → 识别并填充
 */

export const BIRD_FILL_FIELDS = [
  { key: 'name', label: '鸟类名称', hint: '中国鸟类名录常用中文名' },
  { key: 'scientificName', label: '学名', hint: '属名种加词，如 Phalaropus lobatus' },
  { key: 'nameAliases', label: '中文别名', hint: '旧称/异名，顿号分隔' },
  { key: 'description', label: '描述', hint: '2～6 句外形与概况' },
  { key: 'habitat', label: '栖息地', hint: '典型生境，可分号分隔' },
  { key: 'distribution', label: '分布区域', hint: '世界与中国分布简述' },
  { key: 'taxonomy', label: '分类', hint: '目/科，如 雀形目/噪鹛科 或 Passeriformes/Leiothrichidae' },
  { key: 'conservationStatus', label: '保护状态描述', hint: '一句话保护概况' },
  {
    key: 'chinaProtectionLevel',
    label: '中国保护级别',
    hint: '仅填其一：国家一级 / 国家二级 / 三有 / 省级保护 / 未列入',
  },
  {
    key: 'iucnProtectionLevel',
    label: 'IUCN保护级别',
    hint: '优先填完整值如 无危(LC)；也可只写 LC / NT / VU / EN / CR / EW / EX / DD / NE',
  },
  { key: 'size', label: '体型大小', hint: '如 体长约 18 cm' },
  { key: 'weight', label: '体重', hint: '如 约 30–40 g' },
  { key: 'wingspan', label: '翼展', hint: '如 约 32–41 cm' },
  { key: 'plumage', label: '羽色特征', hint: '夏羽/冬羽/幼鸟要点' },
  { key: 'bill', label: '喙的特征', hint: '形状、颜色' },
  { key: 'legs', label: '腿脚特征', hint: '形状、颜色' },
  { key: 'behavior', label: '行为习性', hint: '觅食、集群、警戒等' },
  { key: 'diet', label: '食性', hint: '主要食物' },
  { key: 'migration', label: '迁徙习性', hint: '留鸟/候鸟/过境等及季节' },
  { key: 'breedingSeason', label: '繁殖季节', hint: '如 5–7 月' },
  { key: 'nestType', label: '巢型', hint: '地面巢/树洞等' },
  { key: 'clutchSize', label: '窝卵数', hint: '如 3–4 枚' },
  { key: 'identificationTips', label: '识别要点', hint: '野外易辨特征、对比点' },
  { key: 'similarSpecies', label: '相似物种', hint: '易混种及区分点' },
  { key: 'tags', label: '标签', hint: '英文逗号分隔，如 鸻鹬, 迁徙' },
  { key: 'references', label: '参考资料', hint: '文献或权威网页，可多行' },
];

const LABEL_TO_KEY = new Map(BIRD_FILL_FIELDS.map((f) => [f.label, f.key]));

// 容错：模型可能用的近义标签
const LABEL_ALIASES = {
  中文名: 'name',
  名称: 'name',
  鸟名: 'name',
  拉丁学名: 'scientificName',
  拉丁名: 'scientificName',
  别名: 'nameAliases',
  异名: 'nameAliases',
  简介: 'description',
  概述: 'description',
  生境: 'habitat',
  分布: 'distribution',
  地理分布: 'distribution',
  分类地位: 'taxonomy',
  目科: 'taxonomy',
  保护现状: 'conservationStatus',
  保护状态: 'conservationStatus',
  国家保护级别: 'chinaProtectionLevel',
  国内保护级别: 'chinaProtectionLevel',
  IUCN: 'iucnProtectionLevel',
  IUCN等级: 'iucnProtectionLevel',
  'IUCN 保护级别': 'iucnProtectionLevel',
  IUCN级别: 'iucnProtectionLevel',
  世界自然保护联盟等级: 'iucnProtectionLevel',
  体长: 'size',
  体型: 'size',
  羽色: 'plumage',
  喙: 'bill',
  嘴: 'bill',
  腿: 'legs',
  脚: 'legs',
  行为: 'behavior',
  习性: 'behavior',
  食物: 'diet',
  迁徙: 'migration',
  繁殖期: 'breedingSeason',
  巢: 'nestType',
  卵数: 'clutchSize',
  辨识要点: 'identificationTips',
  识别特征: 'identificationTips',
  易混淆种: 'similarSpecies',
  相似种: 'similarSpecies',
  参考文献: 'references',
  资料来源: 'references',
};

function resolveFieldKey(labelRaw) {
  const label = String(labelRaw || '')
    .replace(/^[*#\-\d\.\)\s]+/, '')
    .replace(/\*+/g, '')
    .trim();
  if (!label) return null;

  const candidates = [
    label,
    label.replace(/[（(].*?[）)]/g, '').trim(),
    label.replace(/\s+/g, ''),
    label.replace(/[（(].*?[）)]/g, '').replace(/\s+/g, '').trim(),
  ].filter(Boolean);

  for (const candidate of candidates) {
    if (LABEL_TO_KEY.has(candidate)) return LABEL_TO_KEY.get(candidate);
    if (LABEL_ALIASES[candidate]) return LABEL_ALIASES[candidate];
  }

  // LABEL_TO_KEY 自身也按去空格再匹配一次（模型常写「IUCN 保护级别」）
  for (const [key, field] of LABEL_TO_KEY.entries()) {
    if (key.replace(/\s+/g, '') === label.replace(/\s+/g, '')) return field;
  }
  for (const [key, field] of Object.entries(LABEL_ALIASES)) {
    if (key.replace(/\s+/g, '') === label.replace(/\s+/g, '')) return field;
  }
  return null;
}

function cleanFieldValue(value) {
  const v = String(value ?? '').trim();
  if (!v) return '';
  if (/^(不详|未知|无|暂无|N\/A|n\/a|null|none|—|－|-|／|\/)$/i.test(v)) return '';
  return v;
}

function tryParseJson(text) {
  const raw = String(text || '').trim();
  if (!raw) return null;
  let candidate = raw;
  const fence = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) candidate = fence[1].trim();
  if (!(candidate.startsWith('{') && candidate.endsWith('}'))) return null;
  try {
    const obj = JSON.parse(candidate);
    if (!obj || typeof obj !== 'object') return null;
    const fields = {};
    BIRD_FILL_FIELDS.forEach(({ key }) => {
      if (obj[key] != null) fields[key] = cleanFieldValue(obj[key]);
      else if (obj[BIRD_FILL_FIELDS.find((f) => f.key === key)?.label] != null) {
        fields[key] = cleanFieldValue(obj[BIRD_FILL_FIELDS.find((f) => f.key === key).label]);
      }
    });
    // 也接受中文键
    Object.entries(obj).forEach(([k, v]) => {
      const key = resolveFieldKey(k) || (LABEL_TO_KEY.has(k) ? LABEL_TO_KEY.get(k) : null);
      if (key) fields[key] = cleanFieldValue(v);
    });
    return fields;
  } catch {
    return null;
  }
}

/**
 * 生成给外部大模型填写的提问模板
 */
export function buildBirdFillPrompt({ name = '', scientificName = '' } = {}) {
  const targetName = String(name || '').trim() || '（请先填写中文名）';
  const targetSci = String(scientificName || '').trim();

  const fieldBlock = BIRD_FILL_FIELDS.map(
    (f) => `${f.label}：` + (f.hint ? `  # ${f.hint}` : '')
  ).join('\n');

  return `你是鸟类学资料助手。请根据权威中文鸟类资料，填写下列鸟种在 KBird 图鉴中的字段。

【目标鸟种】
- 中文名：${targetName}
${targetSci ? `- 学名：${targetSci}` : '- 学名：若不确定请按中国鸟类名录补全'}

【输出要求】
1. 只输出「字段名：内容」列表，字段名必须与下列完全一致（含顿号/中文）。
2. 每行一个字段；长文本可在同一字段后续行继续写，直到下一个「字段名：」出现。
3. 不知道就写「不详」，不要编造保护级别或分布。
4. 不要输出开场白、总结或 Markdown 标题。
5. 中国保护级别、IUCN 保护级别请严格按字段后的可选值填写。

【请填写】
${fieldBlock}
`;
}

/**
 * 解析大模型回贴文本 → 表单字段对象（可直接 merge 进 formData）
 */
export function parseBirdFillText(text) {
  const jsonFields = tryParseJson(text);
  if (jsonFields && Object.keys(jsonFields).some((k) => jsonFields[k])) {
    return jsonFields;
  }

  const fields = {};
  let currentKey = null;
  const lines = String(text || '').replace(/\r\n/g, '\n').split('\n');

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('```')) continue;

    // 匹配「字段名：内容」或「**字段名**：内容」
    const m = trimmed.match(/^(?:\*\*|__)?([^：:*_]+?)(?:\*\*|__)?\s*[：:]\s*(.*)$/);
    if (m) {
      const key = resolveFieldKey(m[1]);
      if (key) {
        currentKey = key;
        // 去掉行内 # 提示残留（模板里的说明）
        fields[key] = cleanFieldValue(String(m[2] || '').replace(/\s+#\s*.*$/, ''));
        continue;
      }
    }

    if (currentKey && trimmed) {
      // 续行：不是新字段
      const prev = fields[currentKey] || '';
      fields[currentKey] = prev ? `${prev}\n${trimmed}` : trimmed;
    }
  }

  Object.keys(fields).forEach((k) => {
    fields[k] = cleanFieldValue(fields[k]);
  });

  return fields;
}

export const birdTextParser = {
  buildFillPrompt: buildBirdFillPrompt,
  parseBirdFillText,

  /** @returns {object} 扁平字段，可直接 spread 进表单 */
  parseText(text) {
    return parseBirdFillText(text);
  },

  getParsingSuggestions() {
    return BIRD_FILL_FIELDS.map((f) => ({
      field: f.label,
      example: f.hint || '',
    }));
  },

  getPromptUsageTips() {
    return [
      '先点「复制提问模板」，粘贴到 ChatGPT / Claude / 国产大模型等',
      '等模型按「字段名：内容」填完后，整段复制回来',
      '粘贴到下方文本框，点「识别并填充」',
      '填充后请人工核对保护级别、分布与学名',
    ];
  },

  validateParsedData(data) {
    const errors = [];
    if (!data?.name?.trim()) errors.push('鸟类名称不能为空');
    if (!data?.scientificName?.trim()) errors.push('拉丁学名不能为空');
    return { isValid: errors.length === 0, errors };
  },

  formatParsedData(data) {
    const out = {};
    BIRD_FILL_FIELDS.forEach(({ key }) => {
      out[key] = data?.[key]?.trim?.() || data?.[key] || '';
    });
    return out;
  },
};
