// 鸟类保护级别数据

// 中国保护级别
export const chinaProtectionLevels = {
  "国家一级": {
    value: "国家一级",
    description: "国家重点保护野生动物名录（一级）",
    color: "#dc3545", // 红色
    icon: "🔴"
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
    color: "#ffc107", // 黄色
    icon: "🟡"
  },
  "省级保护": {
    value: "省级保护",
    description: "省级重点保护野生动物",
    color: "#20c997", // 青色
    icon: "🔵"
  },
  "未列入": {
    value: "未列入",
    description: "未列入任何保护名录",
    color: "#6c757d", // 灰色
    icon: "⚪"
  }
};

// IUCN保护级别
export const iucnProtectionLevels = {
  "无危(LC)": {
    value: "无危(LC)",
    fullName: "Least Concern",
    description: "Least Concern - 无危",
    color: "#28a745", // 绿色
    icon: "🟢"
  },
  "近危(NT)": {
    value: "近危(NT)",
    fullName: "Near Threatened", 
    description: "Near Threatened - 近危",
    color: "#ffc107", // 黄色
    icon: "🟡"
  },
  "易危(VU)": {
    value: "易危(VU)",
    fullName: "Vulnerable",
    description: "Vulnerable - 易危",
    color: "#fd7e14", // 橙色
    icon: "🟠"
  },
  "濒危(EN)": {
    value: "濒危(EN)",
    fullName: "Endangered",
    description: "Endangered - 濒危", 
    color: "#dc3545", // 红色
    icon: "🔴"
  },
  "极危(CR)": {
    value: "极危(CR)",
    fullName: "Critically Endangered",
    description: "Critically Endangered - 极危",
    color: "#6f42c1", // 紫色
    icon: "🟣"
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

// 解析保护状态文本
export const parseProtectionStatusText = (text) => {
  if (!text) return { china: '', iucn: '' };
  
  const result = { china: '', iucn: '' };
  
  // 解析中国保护级别
  for (const level of getChinaProtectionLevels()) {
    if (text.includes(level)) {
      result.china = level;
      break;
    }
  }
  
  // 解析IUCN保护级别
  for (const level of getIucnProtectionLevels()) {
    if (text.includes(level)) {
      result.iucn = level;
      break;
    }
  }
  
  return result;
};






















