/**
 * 从照片文件名和路径中智能提取：
 * 1. 鸟种图片固定标签 (性别 / 年龄 / 羽相 / 姿态)
 * 2. 拍摄日期 (如 20260418 / 2026-04-18 / 2026.04.18 / 2026年4月18日)
 * 3. 拍摄地点匹配（对比用户的地点词典）
 * 4. 整洁的图片说明 (去掉相机原始编号与扩展名)
 */

const FILENAME_TAG_RULES = [
  { tag: '雄性', patterns: [/雄鸟|雄性|公鸟|♂|(?:^|[_\-\s])male(?:$|[_\-\s])/i] },
  { tag: '雌性', patterns: [/雌鸟|雌性|母鸟|♀|(?:^|[_\-\s])female(?:$|[_\-\s])/i] },
  { tag: '亚成鸟', patterns: [/亚成鸟|亚成|(?:^|[_\-\s])subadult(?:$|[_\-\s])/i] },
  { tag: '幼鸟', patterns: [/幼鸟|雏鸟|幼体|(?:^|[_\-\s])juvenile(?:$|[_\-\s])/i] },
  { tag: '成鸟', patterns: [/成鸟|成体|(?:^|[_\-\s])adult(?:$|[_\-\s])/i] },
  { tag: '非繁殖羽', patterns: [/非繁殖羽|冬羽/i] },
  { tag: '繁殖羽', patterns: [/繁殖羽|夏羽|婚羽/i] },
  { tag: '换羽', patterns: [/换羽|蚀羽/i] },
  { tag: '飞翔', patterns: [/飞翔|飞版|飞行|起飞|悬停/i] },
  { tag: '取食', patterns: [/取食|捕食|觅食|抓鱼|吃果|吞食/i] },
  { tag: '求偶', patterns: [/求偶|交配|炫耀|踏背/i] },
  { tag: '栖息', patterns: [/栖息|站桩|呆版|停栖/i] },
];

function extractTagsFromFilename(fileName = '', folderPath = '') {
  const source = `${String(fileName || '')} ${String(folderPath || '')}`;
  const tags = [];
  for (const rule of FILENAME_TAG_RULES) {
    if (rule.patterns.some((re) => re.test(source))) {
      // 如果已经命中了“非繁殖羽”，不再误匹配“繁殖羽”
      if (rule.tag === '繁殖羽' && tags.includes('非繁殖羽')) continue;
      // 如果已经命中了“亚成鸟”，不再误匹配“成鸟”
      if (rule.tag === '成鸟' && tags.includes('亚成鸟')) continue;
      tags.push(rule.tag);
    }
  }
  return tags;
}

function extractDateFromFilename(fileName = '', folderPath = '') {
  const text = `${String(fileName || '')} ${String(folderPath || '')}`;
  // 1. YYYY-MM-DD / YYYY.MM.DD / YYYY_MM_DD / YYYY年M月D日
  const sepMatch = text.match(
    /(?:^|[^\d])(20\d{2}|19\d{2})[-_.年](\d{1,2})[-_.月](\d{1,2})日?(?:[^\d]|$)/
  );
  if (sepMatch) {
    const y = Number(sepMatch[1]);
    const m = Number(sepMatch[2]);
    const d = Number(sepMatch[3]);
    if (m >= 1 && m <= 12 && d >= 1 && d <= 31) {
      const date = new Date(y, m - 1, d, 12, 0, 0);
      if (!Number.isNaN(date.getTime()) && date.getMonth() === m - 1) {
        const dateKey = `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        return { date, dateKey };
      }
    }
  }

  // 2. 紧凑 8 位日期 YYYYMMDD
  const compactMatch = text.match(/(?:^|[^\d])(20[0-3]\d|19[7-9]\d)(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])(?:[^\d]|$)/);
  if (compactMatch) {
    const y = Number(compactMatch[1]);
    const m = Number(compactMatch[2]);
    const d = Number(compactMatch[3]);
    const date = new Date(y, m - 1, d, 12, 0, 0);
    if (!Number.isNaN(date.getTime()) && date.getMonth() === m - 1) {
      const dateKey = `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      return { date, dateKey };
    }
  }

  return null;
}

function matchLocationFromText(fileName = '', folderPath = '', knownLocationNames = []) {
  if (!Array.isArray(knownLocationNames) || !knownLocationNames.length) return '';
  const source = `${String(fileName || '')} ${String(folderPath || '')}`;
  const sorted = [...knownLocationNames]
    .map((n) => String(n || '').trim())
    .filter((n) => n.length >= 2)
    .sort((a, b) => b.length - a.length);

  for (const locName of sorted) {
    if (source.includes(locName)) {
      return locName;
    }
  }

  // 次级匹配：剥离常见场所后缀（如「圆明园遗址公园」→「圆明园」）
  for (const locName of sorted) {
    const shortName = locName
      .replace(/(国家森林公园|国家级自然保护区|自然保护区|遗址公园|森林公园|湿地公园|郊野公园|植物园|动物园|公园|风景区|景区|湿地|水库|林场)$/u, '')
      .trim();
    if (shortName.length >= 2 && source.includes(shortName)) {
      return locName;
    }
  }
  return '';
}

function buildCleanCaption(fileName = '', birdName = '') {
  const base = String(fileName || '').replace(/\.[^.]+$/, '').trim();
  if (!base) return birdName || '';
  // 如果只是纯相机流水号（如 IMG_1234, DSC01234, _DSC1234, P1010123, DJI_0012）
  if (/^[_A-Z]{2,5}[-_]?\d{3,8}(?:[-_]\d+)?$/i.test(base)) {
    return birdName ? `${birdName} (${base})` : base;
  }
  return base;
}

function parsePhotoFileMetadata({
  fileName = '',
  folderPath = '',
  birdName = '',
  exif = null,
  mtime = null,
  knownLocationNames = [],
}) {
  const exifDate = exif?.capturedAt ? new Date(exif.capturedAt) : null;
  const filenameDateInfo = extractDateFromFilename(fileName, folderPath);
  const fallbackMtime = mtime ? new Date(mtime) : new Date();

  let capturedAt = fallbackMtime;
  let dateKey = '';
  let dateSource = 'mtime';

  if (exifDate && !Number.isNaN(exifDate.getTime())) {
    capturedAt = exifDate;
    dateKey = exif.dateKey || formatDateKeyLocal(exifDate);
    dateSource = 'exif';
  } else if (filenameDateInfo) {
    capturedAt = filenameDateInfo.date;
    dateKey = filenameDateInfo.dateKey;
    dateSource = 'filename';
  } else if (!Number.isNaN(fallbackMtime.getTime())) {
    dateKey = formatDateKeyLocal(fallbackMtime);
    dateSource = 'mtime';
  }

  const inferredTags = extractTagsFromFilename(fileName, folderPath);
  const inferredLocation = matchLocationFromText(fileName, folderPath, knownLocationNames);
  const cleanCaption = buildCleanCaption(fileName, birdName);

  return {
    capturedAt,
    dateKey,
    dateSource,
    gps: Array.isArray(exif?.gps) && exif.gps.length === 2 ? exif.gps : null,
    inferredTags,
    inferredLocation,
    cleanCaption,
  };
}

function formatDateKeyLocal(date) {
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

module.exports = {
  FILENAME_TAG_RULES,
  extractTagsFromFilename,
  extractDateFromFilename,
  matchLocationFromText,
  buildCleanCaption,
  parsePhotoFileMetadata,
};
