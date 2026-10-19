const MONTH_LABELS = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];

function getBirdMeta(birdEntry) {
  const info = birdEntry?.birdId && typeof birdEntry.birdId === 'object' ? birdEntry.birdId : null;
  if (!info?._id && !info?.name) return null;
  return {
    id: info._id ? String(info._id) : info.name,
    name: info.name || '未知鸟种',
    scientificName: info.scientificName || '',
  };
}

/**
 * 根据某地点的观鸟记录生成 1–12 月鸟历
 * @param {Array} records Record 列表（需 populate birds.birdId）
 */
export function buildLocationBirdCalendar(records = []) {
  const months = Array.from({ length: 12 }, (_, index) => ({
    month: index + 1,
    label: MONTH_LABELS[index],
    visitDates: new Set(),
    speciesMap: new Map(),
    recordCount: 0,
  }));

  let lastVisit = null;

  (Array.isArray(records) ? records : []).forEach((record) => {
    if (!record?.date) return;
    const date = new Date(record.date);
    if (Number.isNaN(date.getTime())) return;
    const monthIndex = date.getMonth();
    const bucket = months[monthIndex];
    const dayKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    bucket.visitDates.add(dayKey);
    bucket.recordCount += 1;
    if (!lastVisit || date > lastVisit) lastVisit = date;

    (record.birds || []).forEach((entry) => {
      const meta = getBirdMeta(entry);
      if (!meta) return;
      const existing = bucket.speciesMap.get(meta.id);
      if (existing) {
        existing.count += Math.max(1, Number(entry.count) || 1);
        existing.records += 1;
      } else {
        bucket.speciesMap.set(meta.id, {
          ...meta,
          count: Math.max(1, Number(entry.count) || 1),
          records: 1,
        });
      }
    });
  });

  const monthStats = months.map((bucket) => {
    const species = Array.from(bucket.speciesMap.values()).sort((a, b) => {
      if (b.records !== a.records) return b.records - a.records;
      return a.name.localeCompare(b.name, 'zh-CN');
    });
    return {
      month: bucket.month,
      label: bucket.label,
      visitDays: bucket.visitDates.size,
      recordCount: bucket.recordCount,
      speciesCount: species.length,
      species,
      topSpecies: species.slice(0, 8),
    };
  });

  const activeMonths = monthStats.filter((m) => m.speciesCount > 0 || m.recordCount > 0);
  const currentMonth = new Date().getMonth() + 1;

  return {
    months: monthStats,
    activeMonthCount: activeMonths.length,
    totalSpecies: new Set(
      monthStats.flatMap((m) => m.species.map((s) => s.id))
    ).size,
    lastVisit,
    currentMonth,
    currentMonthStats: monthStats[currentMonth - 1],
  };
}

function dayOfYearFromDate(d) {
  const start = new Date(d.getFullYear(), 0, 0);
  const diff = d - start;
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

function formatMonthDay(d) {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${m}-${day}`;
}

/**
 * 自留地 (Patch/Plot) 跨年物候与留存率分析
 * @param {Array} records 该地点的全部观察记录
 */
export function buildLocationPatchPhenology(records = []) {
  const validRecords = (Array.isArray(records) ? records : [])
    .map((r) => {
      const d = r?.date ? new Date(r.date) : null;
      return d && !Number.isNaN(d.getTime()) ? { ...r, _parsedDate: d } : null;
    })
    .filter(Boolean)
    .sort((a, b) => a._parsedDate - b._parsedDate);

  const yearBuckets = new Map();
  const speciesHistory = new Map();
  const seenEverAtPatch = new Set();

  validRecords.forEach((record) => {
    const d = record._parsedDate;
    const year = d.getFullYear();
    const monthIdx = d.getMonth();
    const dayKey = `${year}-${formatMonthDay(d)}`;
    const doy = dayOfYearFromDate(d);

    if (!yearBuckets.has(year)) {
      yearBuckets.set(year, {
        year,
        recordCount: 0,
        visitDays: new Set(),
        speciesSet: new Set(),
        newPatchSpecies: [],
      });
    }
    const yBucket = yearBuckets.get(year);
    yBucket.recordCount += 1;
    yBucket.visitDays.add(dayKey);

    (record.birds || []).forEach((entry) => {
      const meta = getBirdMeta(entry);
      if (!meta) return;

      yBucket.speciesSet.add(meta.id);
      if (!seenEverAtPatch.has(meta.id)) {
        seenEverAtPatch.add(meta.id);
        yBucket.newPatchSpecies.push({
          id: meta.id,
          name: meta.name,
          firstDate: dayKey,
        });
      }

      if (!speciesHistory.has(meta.id)) {
        speciesHistory.set(meta.id, {
          id: meta.id,
          name: meta.name,
          scientificName: meta.scientificName,
          totalRecords: 0,
          monthsActive: Array(12).fill(0),
          byYear: new Map(),
        });
      }
      const sp = speciesHistory.get(meta.id);
      sp.totalRecords += 1;
      sp.monthsActive[monthIdx] += 1;

      if (!sp.byYear.has(year)) {
        sp.byYear.set(year, {
          year,
          firstDate: d,
          firstMd: formatMonthDay(d),
          firstDoy: doy,
          lastDate: d,
          lastMd: formatMonthDay(d),
          records: 1,
        });
      } else {
        const yEntry = sp.byYear.get(year);
        yEntry.records += 1;
        if (d < yEntry.firstDate) {
          yEntry.firstDate = d;
          yEntry.firstMd = formatMonthDay(d);
          yEntry.firstDoy = doy;
        }
        if (d > yEntry.lastDate) {
          yEntry.lastDate = d;
          yEntry.lastMd = formatMonthDay(d);
        }
      }
    });
  });

  const sortedYearsAsc = Array.from(yearBuckets.keys()).sort((a, b) => a - b);
  const yearSummaries = sortedYearsAsc
    .map((year, idx) => {
      const current = yearBuckets.get(year);
      const prevYear = idx > 0 ? yearBuckets.get(sortedYearsAsc[idx - 1]) : null;
      let retainedCount = 0;
      let retentionRate = null;
      if (prevYear && prevYear.speciesSet.size > 0) {
        current.speciesSet.forEach((spId) => {
          if (prevYear.speciesSet.has(spId)) retainedCount += 1;
        });
        retentionRate = Math.round((retainedCount / prevYear.speciesSet.size) * 100);
      }
      return {
        year,
        recordCount: current.recordCount,
        visitDays: current.visitDays.size,
        speciesCount: current.speciesSet.size,
        newPatchSpeciesCount: current.newPatchSpecies.length,
        newPatchSpecies: current.newPatchSpecies.slice(0, 6),
        retainedCount,
        retentionRate,
      };
    })
    .reverse();

  const latestYear = sortedYearsAsc[sortedYearsAsc.length - 1] || new Date().getFullYear();

  const speciesPhenologyRows = Array.from(speciesHistory.values())
    .map((sp) => {
      const years = Array.from(sp.byYear.keys()).sort((a, b) => b - a);
      const latestInfo = sp.byYear.get(latestYear) || sp.byYear.get(years[0]);
      const priorInfos = years
        .filter((y) => y !== latestInfo?.year)
        .map((y) => sp.byYear.get(y))
        .filter(Boolean);

      let arrivalShiftDays = null;
      let arrivalShiftText = '';
      if (latestInfo && priorInfos.length > 0) {
        const avgPriorDoy =
          priorInfos.reduce((sum, item) => sum + item.firstDoy, 0) / priorInfos.length;
        arrivalShiftDays = Math.round(latestInfo.firstDoy - avgPriorDoy);
        if (Math.abs(arrivalShiftDays) <= 2) {
          arrivalShiftText = '与往年持平';
        } else if (arrivalShiftDays < 0) {
          arrivalShiftText = `早到 ${Math.abs(arrivalShiftDays)} 天`;
        } else {
          arrivalShiftText = `晚到 ${arrivalShiftDays} 天`;
        }
      }

      const allEntries = Array.from(sp.byYear.values());
      const earliestEver = [...allEntries].sort((a, b) => a.firstDoy - b.firstDoy)[0];

      return {
        id: sp.id,
        name: sp.name,
        scientificName: sp.scientificName,
        totalRecords: sp.totalRecords,
        yearCount: years.length,
        years,
        monthsActive: sp.monthsActive,
        latestYear: latestInfo?.year || null,
        latestFirstMd: latestInfo?.firstMd || '—',
        earliestEverMd: earliestEver ? `${earliestEver.firstMd} (${earliestEver.year})` : '—',
        arrivalShiftDays,
        arrivalShiftText,
      };
    })
    .sort((a, b) => {
      if (b.yearCount !== a.yearCount) return b.yearCount - a.yearCount;
      if (b.totalRecords !== a.totalRecords) return b.totalRecords - a.totalRecords;
      return a.name.localeCompare(b.name, 'zh-CN');
    });

  const recurringSpeciesCount = speciesPhenologyRows.filter((s) => s.yearCount >= 2).length;

  return {
    years: yearSummaries,
    speciesRows: speciesPhenologyRows.slice(0, 30),
    totalSpeciesCount: speciesPhenologyRows.length,
    recurringSpeciesCount,
    hasMultiYear: yearSummaries.length >= 2,
  };
}

export { MONTH_LABELS };
