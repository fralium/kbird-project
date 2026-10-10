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

export { MONTH_LABELS };
