/**
 * Explore live merge: catalog (plan) + 自留地 species (records).
 * recordedNo = 自留地种级表按 earliest firstSeenAt 排序的序号（#1 最早）。
 */

function firstSeenTs(value) {
  if (!value) return Number.POSITIVE_INFINITY;
  const t = new Date(value).getTime();
  return Number.isFinite(t) ? t : Number.POSITIVE_INFINITY;
}

/** @returns {Map<string, number>} name → 1-based discovery order */
export function buildRecordedNoByName(liveList = []) {
  const ranked = (Array.isArray(liveList) ? liveList : [])
    .map((s, i) => ({
      name: String(s?.name || '').trim(),
      ts: firstSeenTs(s?.firstSeenAt),
      i,
    }))
    .filter((s) => s.name)
    .sort((a, b) => a.ts - b.ts || a.i - b.i);

  const map = new Map();
  ranked.forEach((s, idx) => {
    if (!map.has(s.name)) map.set(s.name, idx + 1);
  });
  return map;
}

export function buildLiveSpecies(catalog = [], plot = null) {
  const liveList = Array.isArray(plot?.species) ? plot.species : [];
  const recordedNoByName = buildRecordedNoByName(liveList);
  const recordedNames = new Set(recordedNoByName.keys());
  const birdIdByName = new Map();
  const firstSeenByName = new Map();
  for (const s of liveList) {
    const name = String(s.name || '').trim();
    if (!name) continue;
    if (s.birdId) birdIdByName.set(name, s.birdId);
    if (s.firstSeenAt && !firstSeenByName.has(name)) {
      firstSeenByName.set(name, s.firstSeenAt);
    }
  }

  const species = catalog.map((s) => {
    const liveHit = recordedNames.has(s.name);
    const recordedNo = liveHit ? recordedNoByName.get(s.name) || null : null;
    return {
      ...s,
      catalogRecorded: Boolean(s.recorded),
      recorded: Boolean(s.recorded) || liveHit,
      liveHit,
      recordedNo,
      firstSeenAt: firstSeenByName.get(s.name) || s.firstSeenAt || null,
      birdId: birdIdByName.get(s.name) || s.birdId || null,
    };
  });

  const recorded = species.filter((s) => s.recorded).length;
  const keyTargets = species.filter((s) => s.targetLevel === '重点目标');
  const keyConfirmed = keyTargets.filter((s) => s.recorded).length;

  return {
    species,
    recordedNames,
    recorded,
    keyConfirmed,
    keyTargets: keyTargets.length,
    liveSpeciesCount: recordedNames.size,
    hasLivePlot: Boolean(plot),
  };
}

/** UI label: 已记录 #N | 已记录 | 待发现 #N */
export function recordedStatusLabel(bird) {
  if (!bird?.recorded) {
    return bird?.pendingNo ? `待发现 #${bird.pendingNo}` : '待发现';
  }
  if (bird.recordedNo) return `已记录 #${bird.recordedNo}`;
  return '已记录';
}

/** Calendar months (1–12) that have at least one mapped/live report. */
export function monthsWithReports(plots = [], liveReports = []) {
  const set = new Set();
  const add = (value) => {
    const raw = String(value || '');
    const m = raw.match(/(\d{4})[/-](\d{1,2})/);
    if (m) {
      const month = Number(m[2]);
      if (month >= 1 && month <= 12) set.add(month);
    }
  };
  for (const p of plots) {
    for (const r of p.关联报告 || []) add(r.time);
  }
  for (const r of liveReports || []) {
    add(r.startAt);
    add(r.timeRaw);
    add(r.date);
  }
  return set;
}

export function seasonCoverage(monthsSet) {
  return {
    春迁: [3, 4].some((m) => monthsSet.has(m)),
    繁殖季: [5, 6, 7].some((m) => monthsSet.has(m)),
    秋迁: [8, 9, 10, 11].some((m) => monthsSet.has(m)),
    越冬季: [12, 1, 2].some((m) => monthsSet.has(m)),
  };
}

export function matchPlotKeyFromText(text, plots = []) {
  const raw = String(text || '');
  if (!raw) return '';
  const hit = plots.find(
    (p) =>
      raw.includes(p.key) ||
      raw.includes(String(p.title || '')) ||
      raw.includes(String(p['样区名称'] || '').replace(/\(.*$/, '')),
  );
  return hit?.key || '';
}

export function checklistStorageKey(projectId) {
  return `kbird-explore-checklist:${projectId || 'leping'}`;
}

export function planFoldStorageKey(projectId) {
  return `kbird-explore-plan-fold:${projectId || 'leping'}`;
}
