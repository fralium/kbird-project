const fsp = require('fs').promises;

const MAX_EXIF_HEADER_BYTES = 65536;

const TAG_DATE_TIME = 0x0132;
const TAG_EXIF_IFD = 0x8769;
const TAG_GPS_IFD = 0x8825;
const TAG_DATE_TIME_ORIGINAL = 0x9003;
const TAG_DATE_TIME_DIGITIZED = 0x9004;

const TAG_GPS_LAT_REF = 0x0001;
const TAG_GPS_LAT = 0x0002;
const TAG_GPS_LNG_REF = 0x0003;
const TAG_GPS_LNG = 0x0004;

function parseExifDateString(raw) {
  if (!raw || typeof raw !== 'string') return null;
  const cleaned = raw.replace(/\0/g, '').trim();
  const match = cleaned.match(
    /^(\d{4})[:\-/.](\d{2})[:\-/.](\d{2})(?:\s+(\d{2}):(\d{2})(?::(\d{2}))?)?/
  );
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4] || 12);
  const minute = Number(match[5] || 0);
  const second = Number(match[6] || 0);

  if (year < 1970 || year > 2100 || month < 1 || month > 12 || day < 1 || day > 31) {
    return null;
  }
  const date = new Date(year, month - 1, day, hour, minute, second);
  if (Number.isNaN(date.getTime())) return null;
  const dateKey = `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  return { date, dateKey, raw: cleaned };
}

function readUInt16(buf, offset, littleEndian) {
  if (offset < 0 || offset + 2 > buf.length) return null;
  return littleEndian ? buf.readUInt16LE(offset) : buf.readUInt16BE(offset);
}

function readUInt32(buf, offset, littleEndian) {
  if (offset < 0 || offset + 4 > buf.length) return null;
  return littleEndian ? buf.readUInt32LE(offset) : buf.readUInt32BE(offset);
}

function readAsciiTag(buf, tiffStart, valueOffsetField, count, littleEndian) {
  if (!count || count <= 0 || count > 256) return '';
  let dataStart;
  if (count <= 4) {
    dataStart = valueOffsetField;
  } else {
    const rel = readUInt32(buf, valueOffsetField, littleEndian);
    if (rel === null) return '';
    dataStart = tiffStart + rel;
  }
  if (dataStart < 0 || dataStart + count > buf.length) return '';
  return buf.slice(dataStart, dataStart + count).toString('ascii').replace(/\0+$/g, '').trim();
}

function readRationalArray(buf, tiffStart, valueOffsetField, count, littleEndian) {
  if (!count || count <= 0 || count > 16) return null;
  const rel = readUInt32(buf, valueOffsetField, littleEndian);
  if (rel === null) return null;
  const start = tiffStart + rel;
  if (start < 0 || start + count * 8 > buf.length) return null;
  const values = [];
  for (let i = 0; i < count; i += 1) {
    const num = readUInt32(buf, start + i * 8, littleEndian);
    const den = readUInt32(buf, start + i * 8 + 4, littleEndian);
    if (num === null || den === null || den === 0) return null;
    values.push(num / den);
  }
  return values;
}

function dmsToDecimal(dms, ref) {
  if (!Array.isArray(dms) || dms.length < 3) return null;
  const [deg, min, sec] = dms;
  if (!Number.isFinite(deg) || !Number.isFinite(min) || !Number.isFinite(sec)) return null;
  let dec = deg + min / 60 + sec / 3600;
  const refUpper = String(ref || '').trim().toUpperCase();
  if (refUpper === 'S' || refUpper === 'W') {
    dec = -dec;
  }
  return Number(dec.toFixed(6));
}

function parseTiffBlock(buf, tiffStart) {
  if (tiffStart < 0 || tiffStart + 8 > buf.length) return null;
  const byteOrder = buf.slice(tiffStart, tiffStart + 2).toString('ascii');
  const littleEndian = byteOrder === 'II' ? true : byteOrder === 'MM' ? false : null;
  if (littleEndian === null) return null;

  const magic = readUInt16(buf, tiffStart + 2, littleEndian);
  if (magic !== 0x002a) return null;

  const ifd0Rel = readUInt32(buf, tiffStart + 4, littleEndian);
  if (ifd0Rel === null) return null;

  let dateTime = null;
  let dateTimeOriginal = null;
  let dateTimeDigitized = null;
  let exifIfdRel = null;
  let gpsIfdRel = null;

  const readIfd = (ifdRel, mode = 'ifd0') => {
    const ifdStart = tiffStart + ifdRel;
    const entryCount = readUInt16(buf, ifdStart, littleEndian);
    if (entryCount === null || entryCount > 256) return null;
    const gpsRaw = {};

    for (let i = 0; i < entryCount; i += 1) {
      const entryOffset = ifdStart + 2 + i * 12;
      if (entryOffset + 12 > buf.length) break;
      const tag = readUInt16(buf, entryOffset, littleEndian);
      const type = readUInt16(buf, entryOffset + 2, littleEndian);
      const count = readUInt32(buf, entryOffset + 4, littleEndian);
      const valField = entryOffset + 8;

      if (mode === 'ifd0') {
        if (tag === TAG_DATE_TIME && type === 2) {
          dateTime = readAsciiTag(buf, tiffStart, valField, count, littleEndian);
        } else if (tag === TAG_EXIF_IFD) {
          exifIfdRel = readUInt32(buf, valField, littleEndian);
        } else if (tag === TAG_GPS_IFD) {
          gpsIfdRel = readUInt32(buf, valField, littleEndian);
        }
      } else if (mode === 'exif') {
        if (tag === TAG_DATE_TIME_ORIGINAL && type === 2) {
          dateTimeOriginal = readAsciiTag(buf, tiffStart, valField, count, littleEndian);
        } else if (tag === TAG_DATE_TIME_DIGITIZED && type === 2) {
          dateTimeDigitized = readAsciiTag(buf, tiffStart, valField, count, littleEndian);
        }
      } else if (mode === 'gps') {
        if (tag === TAG_GPS_LAT_REF && type === 2) {
          gpsRaw.latRef = readAsciiTag(buf, tiffStart, valField, count, littleEndian);
        } else if (tag === TAG_GPS_LNG_REF && type === 2) {
          gpsRaw.lngRef = readAsciiTag(buf, tiffStart, valField, count, littleEndian);
        } else if (tag === TAG_GPS_LAT && type === 5) {
          gpsRaw.latDms = readRationalArray(buf, tiffStart, valField, count, littleEndian);
        } else if (tag === TAG_GPS_LNG && type === 5) {
          gpsRaw.lngDms = readRationalArray(buf, tiffStart, valField, count, littleEndian);
        }
      }
    }
    return gpsRaw;
  };

  readIfd(ifd0Rel, 'ifd0');
  if (exifIfdRel !== null) {
    readIfd(exifIfdRel, 'exif');
  }

  let gps = null;
  if (gpsIfdRel !== null) {
    const gpsRaw = readIfd(gpsIfdRel, 'gps');
    if (gpsRaw?.latDms && gpsRaw?.lngDms) {
      const lat = dmsToDecimal(gpsRaw.latDms, gpsRaw.latRef || 'N');
      const lng = dmsToDecimal(gpsRaw.lngDms, gpsRaw.lngRef || 'E');
      if (
        lat !== null &&
        lng !== null &&
        Math.abs(lat) <= 90 &&
        Math.abs(lng) <= 180 &&
        !(lat === 0 && lng === 0)
      ) {
        gps = [lng, lat];
      }
    }
  }

  const parsedDate =
    parseExifDateString(dateTimeOriginal) ||
    parseExifDateString(dateTimeDigitized) ||
    parseExifDateString(dateTime);

  return {
    capturedAt: parsedDate?.date || null,
    dateKey: parsedDate?.dateKey || '',
    rawDate: parsedDate?.raw || '',
    gps,
  };
}

function parseExifFromBuffer(buf) {
  if (!Buffer.isBuffer(buf) || buf.length < 12) return null;

  // JPEG SOI (0xFFD8)
  if (buf[0] === 0xff && buf[1] === 0xd8) {
    let offset = 2;
    while (offset + 4 <= buf.length) {
      if (buf[offset] !== 0xff) break;
      const marker = buf[offset + 1];
      if (marker === 0xda || marker === 0xd9) break; // SOS or EOI
      const segLength = buf.readUInt16BE(offset + 2);
      if (segLength < 2 || offset + 2 + segLength > buf.length) break;

      if (marker === 0xe1 && segLength >= 10) {
        const header = buf.slice(offset + 4, offset + 10).toString('ascii');
        if (header === 'Exif\0\0') {
          return parseTiffBlock(buf, offset + 10);
        }
      }
      offset += 2 + segLength;
    }
    return null;
  }

  // WebP RIFF....WEBP
  if (
    buf.slice(0, 4).toString('ascii') === 'RIFF' &&
    buf.slice(8, 12).toString('ascii') === 'WEBP'
  ) {
    let offset = 12;
    while (offset + 8 <= buf.length) {
      const chunkId = buf.slice(offset, offset + 4).toString('ascii');
      const chunkSize = buf.readUInt32LE(offset + 4);
      const dataStart = offset + 8;
      if (dataStart + chunkSize > buf.length) break;
      if (chunkId === 'EXIF') {
        const hasExifPrefix =
          chunkSize >= 6 && buf.slice(dataStart, dataStart + 6).toString('ascii') === 'Exif\0\0';
        return parseTiffBlock(buf, hasExifPrefix ? dataStart + 6 : dataStart);
      }
      offset = dataStart + chunkSize + (chunkSize % 2);
    }
  }

  return null;
}

async function extractPhotoExif(absPath) {
  let handle = null;
  try {
    handle = await fsp.open(absPath, 'r');
    const buf = Buffer.alloc(MAX_EXIF_HEADER_BYTES);
    const { bytesRead } = await handle.read(buf, 0, MAX_EXIF_HEADER_BYTES, 0);
    if (!bytesRead || bytesRead < 12) return null;
    return parseExifFromBuffer(buf.slice(0, bytesRead));
  } catch {
    return null;
  } finally {
    if (handle) {
      await handle.close().catch(() => {});
    }
  }
}

module.exports = {
  parseExifDateString,
  parseExifFromBuffer,
  extractPhotoExif,
};
