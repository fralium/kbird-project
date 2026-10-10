/**
 * 国内常用坐标系粗略转换（展示用）
 * 记录里多为天地图/GPS 近似 WGS84；百度地图使用 BD-09。
 */

const PI = Math.PI;
const AXIS = 6378245.0;
const EE = 0.00669342162296594323;

function outOfChina(lng, lat) {
  return lng < 72.004 || lng > 137.8347 || lat < 0.8293 || lat > 55.8271;
}

function transformLat(lng, lat) {
  let ret =
    -100.0 +
    2.0 * lng +
    3.0 * lat +
    0.2 * lat * lat +
    0.1 * lng * lat +
    0.2 * Math.sqrt(Math.abs(lng));
  ret += ((20.0 * Math.sin(6.0 * lng * PI) + 20.0 * Math.sin(2.0 * lng * PI)) * 2.0) / 3.0;
  ret += ((20.0 * Math.sin(lat * PI) + 40.0 * Math.sin((lat / 3.0) * PI)) * 2.0) / 3.0;
  ret += ((160.0 * Math.sin((lat / 12.0) * PI) + 320 * Math.sin((lat * PI) / 30.0)) * 2.0) / 3.0;
  return ret;
}

function transformLng(lng, lat) {
  let ret =
    300.0 +
    lng +
    2.0 * lat +
    0.1 * lng * lng +
    0.1 * lng * lat +
    0.1 * Math.sqrt(Math.abs(lng));
  ret += ((20.0 * Math.sin(6.0 * lng * PI) + 20.0 * Math.sin(2.0 * lng * PI)) * 2.0) / 3.0;
  ret += ((20.0 * Math.sin(lng * PI) + 40.0 * Math.sin((lng / 3.0) * PI)) * 2.0) / 3.0;
  ret += ((150.0 * Math.sin((lng / 12.0) * PI) + 300.0 * Math.sin((lng / 30.0) * PI)) * 2.0) / 3.0;
  return ret;
}

export function wgs84ToGcj02(lng, lat) {
  const numLng = Number(lng);
  const numLat = Number(lat);
  if (!Number.isFinite(numLng) || !Number.isFinite(numLat) || outOfChina(numLng, numLat)) {
    return { lng: numLng, lat: numLat };
  }
  let dLat = transformLat(numLng - 105.0, numLat - 35.0);
  let dLng = transformLng(numLng - 105.0, numLat - 35.0);
  const radLat = (numLat / 180.0) * PI;
  let magic = Math.sin(radLat);
  magic = 1 - EE * magic * magic;
  const sqrtMagic = Math.sqrt(magic);
  dLat = (dLat * 180.0) / (((AXIS * (1 - EE)) / (magic * sqrtMagic)) * PI);
  dLng = (dLng * 180.0) / ((AXIS / sqrtMagic) * Math.cos(radLat) * PI);
  return { lng: numLng + dLng, lat: numLat + dLat };
}

export function gcj02ToBd09(lng, lat) {
  const numLng = Number(lng);
  const numLat = Number(lat);
  const z = Math.sqrt(numLng * numLng + numLat * numLat) + 0.00002 * Math.sin(numLat * PI * 3000.0 / 180.0);
  const theta = Math.atan2(numLat, numLng) + 0.000003 * Math.cos(numLng * PI * 3000.0 / 180.0);
  return {
    lng: z * Math.cos(theta) + 0.0065,
    lat: z * Math.sin(theta) + 0.006,
  };
}

/** 将库内近似 WGS84 坐标转为百度 BD-09（仅用于百度地图打点） */
export function wgs84ToBd09(lng, lat) {
  const gcj = wgs84ToGcj02(lng, lat);
  return gcj02ToBd09(gcj.lng, gcj.lat);
}

export function bd09ToGcj02(lng, lat) {
  const numLng = Number(lng) - 0.0065;
  const numLat = Number(lat) - 0.006;
  const z =
    Math.sqrt(numLng * numLng + numLat * numLat) -
    0.00002 * Math.sin((numLat * PI * 3000.0) / 180.0);
  const theta = Math.atan2(numLat, numLng) - 0.000003 * Math.cos((numLng * PI * 3000.0) / 180.0);
  return {
    lng: z * Math.cos(theta),
    lat: z * Math.sin(theta),
  };
}

/** GCJ-02 → 近似 WGS84（迭代反算，足够地点编辑用） */
export function gcj02ToWgs84(lng, lat) {
  const numLng = Number(lng);
  const numLat = Number(lat);
  if (!Number.isFinite(numLng) || !Number.isFinite(numLat) || outOfChina(numLng, numLat)) {
    return { lng: numLng, lat: numLat };
  }
  let wgsLng = numLng;
  let wgsLat = numLat;
  for (let i = 0; i < 4; i += 1) {
    const conv = wgs84ToGcj02(wgsLng, wgsLat);
    wgsLng += numLng - conv.lng;
    wgsLat += numLat - conv.lat;
  }
  return { lng: wgsLng, lat: wgsLat };
}

/** 百度地图点击/搜索得到的 BD-09 → 库内近似 WGS84 */
export function bd09ToWgs84(lng, lat) {
  const gcj = bd09ToGcj02(lng, lat);
  return gcj02ToWgs84(gcj.lng, gcj.lat);
}
