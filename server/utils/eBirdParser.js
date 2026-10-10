/**
 * eBird CSV格式解析器
 * eBird CSV格式标准：https://help.ebird.org/en/support/solutions/articles/48001237821-ebird-basic-dataset
 */

/**
 * 解析eBird CSV格式数据
 * @param {string} csvData - CSV文件内容
 * @returns {Array} 解析后的记录数组
 */
function parseEBirdCSV(csvData) {
  const lines = csvData.split('\n').filter(line => line.trim());
  if (lines.length < 2) {
    throw new Error('CSV文件至少需要包含标题行和一行数据');
  }

  // 解析标题行
  const headers = parseCSVLine(lines[0]);
  
  // 查找必需的列
  const requiredColumns = {
    'GLOBAL UNIQUE IDENTIFIER': 'globalUniqueIdentifier',
    'LAST EDITED DATE': 'lastEditedDate',
    'TAXONOMIC ORDER': 'taxonomicOrder',
    'CATEGORY': 'category',
    'COMMON NAME': 'commonName',
    'SCIENTIFIC NAME': 'scientificName',
    'OBSERVATION COUNT': 'observationCount',
    'OBSERVATION DATE': 'observationDate',
    'OBSERVATION TIME': 'observationTime',
    'STATE/PROVINCE': 'stateProvince',
    'COUNTY': 'county',
    'LOCALITY': 'locality',
    'LATITUDE': 'latitude',
    'LONGITUDE': 'longitude',
    'OBSERVER ID': 'observerId',
    'SAMPLING EVENT IDENTIFIER': 'samplingEventIdentifier',
    'PROTOCOL TYPE': 'protocolType',
    'PROTOCOL CODE': 'protocolCode',
    'DURATION MINUTES': 'durationMinutes',
    'EFFORT DISTANCE KM': 'effortDistanceKm',
    'EFFORT AREA HA': 'effortAreaHa',
    'NUMBER OBSERVERS': 'numberObservers',
    'ALL SPECIES REPORTED': 'allSpeciesReported',
    'GROUP IDENTIFIER': 'groupIdentifier',
    'HAS MEDIA': 'hasMedia',
    'APPROVED': 'approved',
    'REVIEWED': 'reviewed',
    'REASON': 'reason',
    'TRIP COMMENTS': 'tripComments',
    'SPECIES COMMENTS': 'speciesComments',
  };

  const columnMap = {};
  headers.forEach((header, index) => {
    const normalizedHeader = header.toUpperCase().trim();
    if (requiredColumns[normalizedHeader]) {
      columnMap[requiredColumns[normalizedHeader]] = index;
    }
  });

  // 验证必需的列
  const requiredFields = ['observationDate', 'locality', 'commonName'];
  const missingFields = requiredFields.filter(field => columnMap[field] === undefined);
  if (missingFields.length > 0) {
    throw new Error(`缺少必需的列: ${missingFields.join(', ')}`);
  }

  // 解析数据行
  const records = [];
  const recordMap = new Map(); // 用于合并同一观察事件的多个鸟类

  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    if (values.length !== headers.length) {
      continue; // 跳过格式不正确的行
    }

    const observationDate = values[columnMap['observationDate']];
    const locality = values[columnMap['locality']] || '';
    const commonName = values[columnMap['commonName']] || '';
    const scientificName = values[columnMap['scientificName']] || '';
    const observationCount = values[columnMap['observationCount']] || 'X';
    const latitude = values[columnMap['latitude']] || '';
    const longitude = values[columnMap['longitude']] || '';
    const observationTime = values[columnMap['observationTime']] || '';
    const speciesComments = values[columnMap['speciesComments']] || '';
    const tripComments = values[columnMap['tripComments']] || '';

    // 创建记录的唯一键（日期+地点+时间）
    const recordKey = `${observationDate}_${locality}_${observationTime || '00:00'}`;

    if (!recordMap.has(recordKey)) {
      // 创建新记录
      const record = {
        date: parseEBirdDate(observationDate),
        location: {
          name: locality,
          coordinates: {
            type: 'Point',
            coordinates: [
              longitude ? parseFloat(longitude) : 0,
              latitude ? parseFloat(latitude) : 0,
            ],
          },
        },
        birds: [],
        notes: tripComments || '',
        eBirdData: {
          globalUniqueIdentifier: values[columnMap['globalUniqueIdentifier']] || '',
          taxonomicOrder: values[columnMap['taxonomicOrder']] || '',
          category: values[columnMap['category']] || '',
          protocolType: values[columnMap['protocolType']] || '',
          durationMinutes: values[columnMap['durationMinutes']] || '',
          effortDistanceKm: values[columnMap['effortDistanceKm']] || '',
          effortAreaHa: values[columnMap['effortAreaHa']] || '',
          numberObservers: values[columnMap['numberObservers']] || '',
          allSpeciesReported: values[columnMap['allSpeciesReported']] || '',
        },
      };
      recordMap.set(recordKey, record);
    }

    // 添加鸟类到记录
    const record = recordMap.get(recordKey);
    record.birds.push({
      name: commonName,
      scientificName: scientificName,
      count: observationCount === 'X' ? 1 : (parseInt(observationCount) || 1),
      notes: speciesComments || '',
    });
  }

  // 转换为数组
  return Array.from(recordMap.values());
}

/**
 * 解析CSV行（处理引号内的逗号）
 */
function parseCSVLine(line) {
  const values = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        // 转义的双引号
        current += '"';
        i++; // 跳过下一个引号
      } else {
        // 切换引号状态
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      // 字段分隔符
      values.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  values.push(current.trim()); // 最后一个字段

  return values;
}

/**
 * 解析eBird日期格式 (YYYY-MM-DD)
 */
function parseEBirdDate(dateString) {
  if (!dateString) return new Date();
  
  // eBird日期格式: YYYY-MM-DD
  const parts = dateString.split('-');
  if (parts.length === 3) {
    return new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
  }
  
  return new Date(dateString);
}

/**
 * 将记录转换为eBird CSV格式
 * @param {Array} records - 记录数组
 * @returns {string} CSV格式字符串
 */
function toEBirdCSV(records) {
  const headers = [
    'GLOBAL UNIQUE IDENTIFIER',
    'LAST EDITED DATE',
    'TAXONOMIC ORDER',
    'CATEGORY',
    'COMMON NAME',
    'SCIENTIFIC NAME',
    'OBSERVATION COUNT',
    'OBSERVATION DATE',
    'OBSERVATION TIME',
    'STATE/PROVINCE',
    'COUNTY',
    'LOCALITY',
    'LATITUDE',
    'LONGITUDE',
    'OBSERVER ID',
    'SAMPLING EVENT IDENTIFIER',
    'PROTOCOL TYPE',
    'PROTOCOL CODE',
    'DURATION MINUTES',
    'EFFORT DISTANCE KM',
    'EFFORT AREA HA',
    'NUMBER OBSERVERS',
    'ALL SPECIES REPORTED',
    'GROUP IDENTIFIER',
    'HAS MEDIA',
    'APPROVED',
    'REVIEWED',
    'REASON',
    'TRIP COMMENTS',
    'SPECIES COMMENTS',
  ];

  const rows = [headers.join(',')];

  records.forEach(record => {
    const date = new Date(record.date);
    const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    const timeStr = date.toTimeString().slice(0, 5); // HH:MM
    const locality = escapeCSV(record.location?.name || '');
    const lat = record.location?.coordinates?.coordinates?.[1] || '';
    const lng = record.location?.coordinates?.coordinates?.[0] || '';

    record.birds?.forEach((bird, index) => {
      const row = [
        '', // GLOBAL UNIQUE IDENTIFIER
        dateStr, // LAST EDITED DATE
        '', // TAXONOMIC ORDER
        'species', // CATEGORY
        escapeCSV(bird.name || bird.birdId?.name || ''),
        escapeCSV(bird.scientificName || bird.birdId?.scientificName || ''),
        bird.count || 1, // OBSERVATION COUNT
        dateStr, // OBSERVATION DATE
        timeStr, // OBSERVATION TIME
        '', // STATE/PROVINCE
        '', // COUNTY
        locality, // LOCALITY
        lat, // LATITUDE
        lng, // LONGITUDE
        '', // OBSERVER ID
        `${record._id || Date.now()}-${index}`, // SAMPLING EVENT IDENTIFIER
        'Stationary', // PROTOCOL TYPE
        'P21', // PROTOCOL CODE
        '', // DURATION MINUTES
        '', // EFFORT DISTANCE KM
        '', // EFFORT AREA HA
        '1', // NUMBER OBSERVERS
        '1', // ALL SPECIES REPORTED
        '', // GROUP IDENTIFIER
        (bird.images?.length > 0 || record.images?.length > 0) ? '1' : '0', // HAS MEDIA
        '1', // APPROVED
        '1', // REVIEWED
        '', // REASON
        escapeCSV(record.notes || ''), // TRIP COMMENTS
        escapeCSV(bird.notes || ''), // SPECIES COMMENTS
      ];
      rows.push(row.join(','));
    });
  });

  return rows.join('\n');
}

/**
 * 转义CSV字段（处理引号和逗号）
 */
function escapeCSV(value) {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * 将记录转换为 eBird Record Format（便于导入 eBird）
 * 参考：https://support.ebird.org/en/support/solutions/articles/48000837575
 * @param {Array} records
 * @returns {string} CSV
 */
function toEBirdRecordFormatCSV(records = []) {
  const headers = [
    'Common Name',
    'Genus',
    'Species',
    'Number',
    'Species Comments',
    'Location Name',
    'Latitude',
    'Longitude',
    'Date',
    'Start Time',
    'State',
    'Country',
    'Protocol',
    'Number of Observers',
    'Duration',
    'All observations reported?',
    'Distance covered',
    'Area covered',
    'Checklist Comments',
  ];

  const rows = [headers.map(escapeCSV).join(',')];

  for (const record of records) {
    const date = record?.date ? new Date(record.date) : null;
    const dateStr =
      date && !Number.isNaN(date.getTime())
        ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
        : '';
    const timeStr =
      date && !Number.isNaN(date.getTime()) ? date.toTimeString().slice(0, 5) : '';

    const coords = record.location?.coordinates?.coordinates || record.location?.coordinates || [];
    const lng = Array.isArray(coords) ? coords[0] : '';
    const lat = Array.isArray(coords) ? coords[1] : '';
    const validCoords =
      Number.isFinite(Number(lng)) &&
      Number.isFinite(Number(lat)) &&
      !(Number(lng) === 0 && Number(lat) === 0);

    const locality = record.location?.name || '';
    const state = record.location?.address?.province || '';
    const protocol = record.effort?.isCompleteChecklist ? 'traveling' : 'stationary';
    const duration = record.effort?.durationMinutes != null ? String(record.effort.durationMinutes) : '';
    const distance =
      record.effort?.distanceKm != null ? String(record.effort.distanceKm) : '';
    const observers =
      record.effort?.observersCount != null ? String(record.effort.observersCount) : '1';
    const allReported = record.effort?.isCompleteChecklist ? 'Y' : 'N';
    const checklistComments = [record.notes, record.description].filter(Boolean).join(' | ');

    const birds = Array.isArray(record.birds) ? record.birds : [];
    for (const bird of birds) {
      const info = bird?.birdId && typeof bird.birdId === 'object' ? bird.birdId : {};
      const common =
        info.englishName ||
        bird?.englishName ||
        info.name ||
        bird?.name ||
        '';
      const sci = String(info.scientificName || bird?.scientificName || '').trim();
      const [genus = '', species = ''] = sci.split(/\s+/);
      rows.push(
        [
          escapeCSV(common),
          escapeCSV(genus),
          escapeCSV(species),
          bird.count || 1,
          escapeCSV(bird.notes || ''),
          escapeCSV(locality),
          validCoords ? lat : '',
          validCoords ? lng : '',
          dateStr,
          timeStr,
          escapeCSV(state),
          'CN',
          protocol,
          observers,
          duration,
          allReported,
          distance,
          '',
          escapeCSV(checklistComments),
        ].join(',')
      );
    }
  }

  return `\uFEFF${rows.join('\n')}`;
}

module.exports = {
  parseEBirdCSV,
  toEBirdCSV,
  toEBirdRecordFormatCSV,
};
