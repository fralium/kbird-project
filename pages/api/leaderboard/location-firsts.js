import dbConnect from '@/server/config/db';
import Record from '@/server/models/recordModel';
import Location from '@/server/models/locationModel';
import { sendMethodNotAllowed } from '@/utils/proxyApi';

const {
  resolveCanonicalLocationName,
  normalizeLocationName,
} = require('@/server/utils/locationName');

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return sendMethodNotAllowed(res, ['GET']);
  }

  try {
    await dbConnect();

    const records = await Record.find({ status: { $ne: 'draft' } })
      .populate('observer', 'name avatar')
      .sort({ date: 1 });

    const locationMap = new Map();

    records.forEach((record) => {
      if (!record?.observer) return;

      const locationName = normalizeLocationName(record.location?.name || '未知地点');
      if (!locationName) return;

      if (!locationMap.has(locationName)) {
        locationMap.set(locationName, {
          location: locationName,
          firstRecordDate: record.date,
          firstUser: {
            _id: record.observer._id,
            name: record.observer.name,
            avatar: record.observer.avatar,
          },
          _birdIds: new Set(),
        });
      }

      const existing = locationMap.get(locationName);
      (Array.isArray(record.birds) ? record.birds : []).forEach((birdRecord) => {
        const birdId = birdRecord?.birdId?._id || birdRecord?.birdId;
        if (birdId) existing._birdIds.add(String(birdId));
      });

      if (new Date(record.date) < new Date(existing.firstRecordDate)) {
        existing.firstRecordDate = record.date;
        existing.firstUser = {
          _id: record.observer._id,
          name: record.observer.name,
          avatar: record.observer.avatar,
        };
      }
    });

    // 可选：用 canonical 合并长/短地名（与 express 控制器一致的方向）
    const canonicalNames = new Set(locationMap.keys());
    const merged = new Map();
    locationMap.forEach((item, name) => {
      const canonical = resolveCanonicalLocationName(name, '', canonicalNames) || name;
      if (!merged.has(canonical)) {
        merged.set(canonical, {
          location: canonical,
          firstRecordDate: item.firstRecordDate,
          firstUser: item.firstUser,
          _birdIds: new Set(item._birdIds),
        });
        return;
      }
      const target = merged.get(canonical);
      item._birdIds.forEach((id) => target._birdIds.add(id));
      if (new Date(item.firstRecordDate) < new Date(target.firstRecordDate)) {
        target.firstRecordDate = item.firstRecordDate;
        target.firstUser = item.firstUser;
      }
    });

    const ranked = Array.from(merged.values())
      .map((item) => ({
        location: item.location,
        firstRecordDate: item.firstRecordDate,
        firstUser: item.firstUser,
        birdCount: item._birdIds.size,
      }))
      .sort((a, b) => new Date(a.firstRecordDate) - new Date(b.firstRecordDate))
      .slice(0, 50);

    const names = ranked.map((item) => item.location);
    const locationDocs = names.length
      ? await Location.find({ name: { $in: names }, status: { $ne: 'archived' } })
          .select('name type images environment')
          .lean()
      : [];
    const locationByName = new Map(
      locationDocs.map((doc) => [normalizeLocationName(doc.name || ''), doc])
    );

    const results = ranked.map((item, index) => {
      const doc = locationByName.get(normalizeLocationName(item.location));
      return {
        _id: doc?._id ? String(doc._id) : `location_${index}`,
        location: item.location,
        firstRecordDate: item.firstRecordDate,
        firstUser: item.firstUser,
        birdCount: item.birdCount,
        locationId: doc?._id ? String(doc._id) : null,
        locationType: doc?.type || '',
        images: Array.isArray(doc?.images) ? doc.images : [],
        environment: doc?.environment || null,
      };
    });

    res.status(200).json({
      success: true,
      data: results,
      count: results.length,
    });
  } catch (error) {
    console.error('获取地点首次发现成就榜失败:', error);
    res.status(500).json({
      success: false,
      message: '获取成就榜失败',
    });
  }
}
