/** Shared lat/lng extraction from heterogeneous location payloads. */

export function extractCoords(loc) {
  if (!loc || typeof loc !== 'object') return null;
  const candidates = [
    loc.coordinates,
    loc.coords,
    loc.location?.coordinates,
    loc.geo,
    loc,
  ];
  for (const c of candidates) {
    if (!c) continue;
    const lng = Number(c.lng ?? c.lon ?? c.longitude ?? c[0]);
    const lat = Number(c.lat ?? c.latitude ?? c[1]);
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      return { lat, lng };
    }
  }
  return null;
}
