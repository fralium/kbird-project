/** 轨迹五色：早 → 晚，各约 20% 路段（红 / 黄 / 蓝 / 绿 / 紫） */
export const PATH_PROGRESS_COLORS = [
  '#e63946', // 红 · 早
  '#f4c430', // 黄
  '#1d6fd8', // 蓝
  '#2a9d4a', // 绿
  '#7b2cbf', // 紫 · 晚
];

/**
 * 将点列按先后均分成 segmentCount 段（默认 5 = 各约 20%）。
 * @param {Array} coords [[lat,lng]|{lat,lng}, ...]
 * @param {number} [segmentCount=5]
 * @returns {{ color: string, positions: Array<{lat:number,lng:number}> }[]}
 */
export function splitPathIntoProgressSegments(coords, segmentCount = 5) {
  const points = normalizeCoords(coords);
  if (points.length < 2) return [];

  const edgeCount = points.length - 1;
  const n = Math.max(1, Math.min(segmentCount, PATH_PROGRESS_COLORS.length, edgeCount));
  const segments = [];

  for (let i = 0; i < n; i += 1) {
    const start = Math.floor((i / n) * edgeCount);
    const end = Math.floor(((i + 1) / n) * edgeCount);
    const slice = points.slice(start, end + 1);
    if (slice.length < 2) continue;
    segments.push({
      color: PATH_PROGRESS_COLORS[i] || PATH_PROGRESS_COLORS[PATH_PROGRESS_COLORS.length - 1],
      positions: slice,
      index: i,
    });
  }
  return segments;
}

function normalizeCoords(coords) {
  if (!Array.isArray(coords)) return [];
  return coords
    .map((coord) => {
      if (Array.isArray(coord) && coord.length >= 2) {
        return { lat: Number(coord[0]), lng: Number(coord[1]) };
      }
      if (coord && typeof coord === 'object') {
        return { lat: Number(coord.lat), lng: Number(coord.lng) };
      }
      return null;
    })
    .filter((c) => c && Number.isFinite(c.lat) && Number.isFinite(c.lng));
}
