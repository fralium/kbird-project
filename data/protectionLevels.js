// 鸟类保护级别数据

// 中国保护级别（暖橙系，与 IUCN 湖泊青区分；不用红/紫）
export const chinaProtectionLevels = {
  "国家一级": {
    value: "国家一级",
    description: "国家重点保护野生动物名录（一级）",
    color: "#fd7e14", // 橙色
    icon: "🟠"
  },
  "国家二级": {
    value: "国家二级", 
    description: "国家重点保护野生动物名录（二级）",
    color: "#fd7e14", // 橙色
    icon: "🟠"
  },
  "三有": {
    value: "三有",
    description: "国家保护的有重要生态、科学、社会价值的陆生野生动物",
    color: "#0f766e", // 深青绿，浅底上更清晰
    icon: "🟢"
  },
  "省级保护": {
    value: "省级保护",
    description: "省级重点保护野生动物",
    color: "#219EBC", // 湖泊蓝
    icon: "🔵"
  },
  "未列入": {
    value: "未列入",
    description: "未列入任何保护名录",
    color: "#6c757d", // 灰色
    icon: "⚪"
  }
};

// IUCN保护级别（统一湖泊青，不用红/紫）
export const iucnProtectionLevels = {
  "无危(LC)": {
    value: "无危(LC)",
    fullName: "Least Concern",
    description: "Least Concern - 无危",
    color: "#219EBC", // 湖泊蓝
    icon: "🟢"
  },
  "近危(NT)": {
    value: "近危(NT)",
    fullName: "Near Threatened", 
    description: "Near Threatened - 近危",
    color: "#219EBC",
    icon: "🟡"
  },
  "易危(VU)": {
    value: "易危(VU)",
    fullName: "Vulnerable",
    description: "Vulnerable - 易危",
    color: "#219EBC",
    icon: "🟠"
  },
  "濒危(EN)": {
    value: "濒危(EN)",
    fullName: "Endangered",
    description: "Endangered - 濒危", 
    color: "#1780a0", // 略深湖泊蓝
    icon: "🔵"
  },
  "极危(CR)": {
    value: "极危(CR)",
    fullName: "Critically Endangered",
    description: "Critically Endangered - 极危",
    color: "#1780a0",
    icon: "🔵"
  },
  "野外灭绝(EW)": {
    value: "野外灭绝(EW)",
    fullName: "Extinct in the Wild",
    description: "Extinct in the Wild - 野外灭绝",
    color: "#6c757d", // 灰色
    icon: "⚫"
  },
  "灭绝(EX)": {
    value: "灭绝(EX)",
    fullName: "Extinct",
    description: "Extinct - 灭绝",
    color: "#343a40", // 深灰色
    icon: "💀"
  },
  "数据缺乏(DD)": {
    value: "数据缺乏(DD)",
    fullName: "Data Deficient",
    description: "Data Deficient - 数据缺乏",
    color: "#6c757d", // 灰色
    icon: "❓"
  },
  "未评估(NE)": {
    value: "未评估(NE)",
    fullName: "Not Evaluated",
    description: "Not Evaluated - 未评估",
    color: "#6c757d", // 灰色
    icon: "❔"
  }
};

// 获取所有中国保护级别
export const getChinaProtectionLevels = () => {
  return Object.keys(chinaProtectionLevels);
};

// 获取所有IUCN保护级别
export const getIucnProtectionLevels = () => {
  return Object.keys(iucnProtectionLevels);
};

// 获取保护级别信息
export const getProtectionLevelInfo = (type, level) => {
  if (type === 'china') {
    return chinaProtectionLevels[level] || null;
  } else if (type === 'iucn') {
    return iucnProtectionLevels[level] || null;
  }
  return null;
};

/** IUCN：近危及以上视为需醒目提示 */
export const isElevatedIucnLevel = (level) =>
  ['近危(NT)', '易危(VU)', '濒危(EN)', '极危(CR)', '野外灭绝(EW)', '灭绝(EX)'].includes(level);

/** 中国：国家一/二级重点保护需醒目提示 */
export const isElevatedChinaLevel = (level) => level === '国家一级' || level === '国家二级';

export const isElevatedProtectionLevel = (type, level) => {
  if (type === 'china') return isElevatedChinaLevel(level);
  if (type === 'iucn') return isElevatedIucnLevel(level);
  return false;
};

const CHINA_IMPORTANCE_RANK = {
  国家一级: 200,
  国家二级: 150,
  省级保护: 80,
  三有: 40,
};

const IUCN_IMPORTANCE_RANK = {
  '灭绝(EX)': 100,
  '野外灭绝(EW)': 95,
  '极危(CR)': 90,
  '濒危(EN)': 80,
  '易危(VU)': 70,
  '近危(NT)': 55,
};

const pickBirdInfo = (recordBirdOrBird) => {
  if (!recordBirdOrBird) return {};
  if (recordBirdOrBird.birdId && typeof recordBirdOrBird.birdId === 'object') {
    return recordBirdOrBird.birdId;
  }
  return recordBirdOrBird;
};

/**
 * 观鸟记录中的「重要鸟种」高亮信息：国家重点保护 或 IUCN 近危及以上
 */
export const getRecordBirdHighlight = (recordBirdOrBird) => {
  const bird = pickBirdInfo(recordBirdOrBird);
  const china = String(bird?.chinaProtectionLevel || '').trim();
  const iucn = String(bird?.iucnProtectionLevel || '').trim();
  const chinaElevated = isElevatedChinaLevel(china);
  const iucnElevated = isElevatedIucnLevel(iucn);
  const notable = chinaElevated || iucnElevated;
  const score =
    (notable ? 1000 : 0) +
    (CHINA_IMPORTANCE_RANK[china] || 0) +
    (IUCN_IMPORTANCE_RANK[iucn] || 0);

  let shortLabel = '';
  if (china === '国家一级') shortLabel = '国一';
  else if (china === '国家二级') shortLabel = '国二';
  else if (iucnElevated) {
    const code = iucn.match(/\((CR|EN|VU|NT|EW|EX)\)/);
    shortLabel = code ? code[1] : '稀有';
  }

  return {
    notable,
    chinaElevated,
    iucnElevated,
    china,
    iucn,
    score,
    shortLabel,
  };
};

/** 重要种优先，稳定保留原相对顺序作为次键 */
export const sortRecordBirdsByImportance = (birds = []) => {
  const source = Array.isArray(birds) ? birds : [];
  return source
    .map((bird, idx) => ({ bird, idx, highlight: getRecordBirdHighlight(bird) }))
    .sort((a, b) => {
      if (b.highlight.score !== a.highlight.score) return b.highlight.score - a.highlight.score;
      return a.idx - b.idx;
    })
    .map((item) => item.bird);
};

// 搜索保护级别
export const searchProtectionLevels = (query) => {
  if (!query) return [];
  
  const results = [];
  const lowerQuery = query.toLowerCase();
  
  // 搜索中国保护级别
  for (const [level, info] of Object.entries(chinaProtectionLevels)) {
    if (level.toLowerCase().includes(lowerQuery) || 
        info.description.toLowerCase().includes(lowerQuery)) {
      results.push({
        type: 'china',
        level: level,
        info: info
      });
    }
  }
  
  // 搜索IUCN保护级别
  for (const [level, info] of Object.entries(iucnProtectionLevels)) {
    if (level.toLowerCase().includes(lowerQuery) || 
        info.fullName.toLowerCase().includes(lowerQuery) ||
        info.description.toLowerCase().includes(lowerQuery)) {
      results.push({
        type: 'iucn',
        level: level,
        info: info
      });
    }
  }
  
  return results;
};

// 构建保护状态显示文本
export const buildProtectionStatusText = (chinaLevel, iucnLevel) => {
  const parts = [];
  
  if (chinaLevel && chinaLevel !== '未列入') {
    parts.push(`中国: ${chinaLevel}`);
  }
  
  if (iucnLevel && iucnLevel !== '未评估(NE)') {
    parts.push(`IUCN: ${iucnLevel}`);
  }
  
  return parts.length > 0 ? parts.join(' | ') : '未评估';
};

const CHINA_LEVEL_ALIASES = {
  国家一级: '国家一级',
  一级: '国家一级',
  国一: '国家一级',
  '国家Ⅰ级': '国家一级',
  '国家I级': '国家一级',
  国家二级: '国家二级',
  二级: '国家二级',
  国二: '国家二级',
  '国家Ⅱ级': '国家二级',
  '国家II级': '国家二级',
  三有: '三有',
  三有保护: '三有',
  省级保护: '省级保护',
  省级: '省级保护',
  未列入: '未列入',
  非保护: '未列入',
  无: '未列入',
};

const IUCN_LEVEL_ALIASES = {
  '无危(LC)': '无危(LC)',
  无危: '无危(LC)',
  LC: '无危(LC)',
  'Least Concern': '无危(LC)',
  '近危(NT)': '近危(NT)',
  近危: '近危(NT)',
  NT: '近危(NT)',
  'Near Threatened': '近危(NT)',
  '易危(VU)': '易危(VU)',
  易危: '易危(VU)',
  VU: '易危(VU)',
  Vulnerable: '易危(VU)',
  '濒危(EN)': '濒危(EN)',
  濒危: '濒危(EN)',
  EN: '濒危(EN)',
  Endangered: '濒危(EN)',
  '极危(CR)': '极危(CR)',
  极危: '极危(CR)',
  CR: '极危(CR)',
  'Critically Endangered': '极危(CR)',
  '野外灭绝(EW)': '野外灭绝(EW)',
  野外灭绝: '野外灭绝(EW)',
  EW: '野外灭绝(EW)',
  'Extinct in the Wild': '野外灭绝(EW)',
  '灭绝(EX)': '灭绝(EX)',
  灭绝: '灭绝(EX)',
  EX: '灭绝(EX)',
  Extinct: '灭绝(EX)',
  '数据缺乏(DD)': '数据缺乏(DD)',
  数据缺乏: '数据缺乏(DD)',
  DD: '数据缺乏(DD)',
  'Data Deficient': '数据缺乏(DD)',
  '未评估(NE)': '未评估(NE)',
  未评估: '未评估(NE)',
  NE: '未评估(NE)',
  'Not Evaluated': '未评估(NE)',
};

/** 把模型/粘贴文本归一到 schema 枚举 */
export const normalizeChinaProtectionLevel = (raw) => {
  const text = String(raw || '').trim();
  if (!text) return '';
  if (chinaProtectionLevels[text]) return text;
  if (CHINA_LEVEL_ALIASES[text]) return CHINA_LEVEL_ALIASES[text];
  // 优先匹配更长的正式名，避免「一级」误伤
  const ordered = [...getChinaProtectionLevels()].sort((a, b) => b.length - a.length);
  for (const level of ordered) {
    if (text.includes(level)) return level;
  }
  // 短别名（一级/二级/无）仅接受整字段精确匹配，避免长文本误伤
  for (const [alias, level] of Object.entries(CHINA_LEVEL_ALIASES)) {
    if (alias.length < 3) continue;
    if (text.includes(alias)) return level;
  }
  return '';
};

export const normalizeIucnProtectionLevel = (raw) => {
  const text = String(raw || '').trim();
  if (!text) return '';
  if (iucnProtectionLevels[text]) return text;
  if (IUCN_LEVEL_ALIASES[text]) return IUCN_LEVEL_ALIASES[text];
  const upper = text.toUpperCase();
  const codeMatch = upper.match(/\b(LC|NT|VU|EN|CR|EW|EX|DD|NE)\b/);
  if (codeMatch && IUCN_LEVEL_ALIASES[codeMatch[1]]) {
    return IUCN_LEVEL_ALIASES[codeMatch[1]];
  }
  const ordered = [...getIucnProtectionLevels()].sort((a, b) => b.length - a.length);
  for (const level of ordered) {
    if (text.includes(level)) return level;
  }
  for (const [alias, level] of Object.entries(IUCN_LEVEL_ALIASES)) {
    if (/^[A-Z]{2}$/.test(alias)) continue; // 代码已用正则处理
    if (alias.length >= 2 && text.toLowerCase().includes(alias.toLowerCase())) return level;
  }
  return '';
};

// 解析保护状态文本
export const parseProtectionStatusText = (text) => {
  if (!text) return { china: '', iucn: '' };
  return {
    china: normalizeChinaProtectionLevel(text),
    iucn: normalizeIucnProtectionLevel(text),
  };
};

/**
 * 提交前汇总保护级别：专用字段优先，其次从描述文本解析，最后给安全默认值
 */
export const resolveProtectionLevels = ({
  chinaProtectionLevel = '',
  iucnProtectionLevel = '',
  conservationStatus = '',
} = {}) => {
  const fromStatus = parseProtectionStatusText(conservationStatus);
  const china =
    normalizeChinaProtectionLevel(chinaProtectionLevel) ||
    fromStatus.china ||
    '未列入';
  const iucn =
    normalizeIucnProtectionLevel(iucnProtectionLevel) ||
    fromStatus.iucn ||
    '未评估(NE)';
  return {
    chinaProtectionLevel: china,
    iucnProtectionLevel: iucn,
    conservationStatus:
      String(conservationStatus || '').trim() ||
      buildProtectionStatusText(china, iucn),
  };
};
























