import dbConnect from '../../../server/config/db';
import Record from '../../../server/models/recordModel';
import User from '../../../server/models/userModel';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, message: '方法不允许' });
  }

  try {
    await dbConnect();

    // 获取所有Record数据
    const records = await Record.find({ status: { $in: ['approved', 'pending'] } })
      .populate('observer', 'name avatar')
      .sort({ date: 1 }); // 按日期升序排列

    // 按地点分组，找到每个地点的首次记录
    const locationMap = new Map();

    records.forEach(record => {
      // 只处理有真实观察者的记录
      if (record.observer) {
        const location = record.location.name.trim();
        
        if (!locationMap.has(location)) {
          locationMap.set(location, {
            location: location,
            firstRecordDate: record.date,
            firstUser: {
              _id: record.observer._id,
              name: record.observer.name,
              avatar: record.observer.avatar
            },
            birdCount: record.birds.length // 使用Record中的鸟类数量
          });
        } else {
          const existing = locationMap.get(location);
          existing.birdCount += record.birds.length; // 累加鸟类数量
          
          // 更新最早记录时间
          if (new Date(record.date) < new Date(existing.firstRecordDate)) {
            existing.firstRecordDate = record.date;
            existing.firstUser = {
              _id: record.observer._id,
              name: record.observer.name,
              avatar: record.observer.avatar
            };
          }
        }
      }
    });

    // 转换为数组并按首次记录时间排序
    const locationFirsts = Array.from(locationMap.values())
      .sort((a, b) => new Date(a.firstRecordDate) - new Date(b.firstRecordDate))
      .slice(0, 50) // 限制返回数量
      .map((item, index) => ({
        _id: `location_${index}`,
        ...item
      }));

    res.status(200).json({
      success: true,
      data: locationFirsts,
      count: locationFirsts.length
    });

  } catch (error) {
    console.error('获取地点首次记录榜失败:', error);
    res.status(500).json({
      success: false,
      message: '服务器错误'
    });
  }
}