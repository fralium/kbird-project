import dbConnect from '@/server/config/db';
import Bird from '@/server/models/birdModel';
import Record from '@/server/models/recordModel';
import User from '@/server/models/userModel';
import mongoose from 'mongoose';
import { devError, devLog } from '@/utils/devLogger';
import { sendMethodNotAllowed } from '@/utils/proxyApi';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return sendMethodNotAllowed(res, ['GET']);
  }

  try {
    await dbConnect();

    // 获取所有Record数据，按鸟类分组
    const records = await Record.find({ status: { $ne: 'draft' } })
      .populate('observer', 'name avatar')
      .sort({ date: 1 }); // 按日期升序排列

    // 为每个鸟类找到最早的观鸟记录
    const birdFirsts = [];
    const birdFirstMap = new Map(); // 用于跟踪每个鸟类的首次记录
    
    records.forEach((record) => {
      // 只处理有真实观察者的记录
      if (!record?.observer) return;
      (Array.isArray(record.birds) ? record.birds : []).forEach((birdRecord) => {
        if (!birdRecord?.birdId) return;
        const birdId = birdRecord.birdId.toString();

        // 如果这个鸟类还没有首次记录，或者这个记录更早
        if (
          !birdFirstMap.has(birdId) ||
          new Date(record.date) < new Date(birdFirstMap.get(birdId).record.date)
        ) {
          birdFirstMap.set(birdId, {
            birdId: birdRecord.birdId,
            record,
          });
        }
      });
    });

    // 获取鸟类详细信息并构建结果
    const birdIds = Array.from(birdFirstMap.keys()).map(id => new mongoose.Types.ObjectId(id));
    devLog('birdFirstMap keys:', Array.from(birdFirstMap.keys()));
    devLog('birdIds for query:', birdIds);
    
    const birds = await Bird.find({ _id: { $in: birdIds } });
    devLog('found birds:', birds.length);

    birdFirstMap.forEach((data, birdId) => {
      devLog('processing birdId:', birdId);
      const bird = birds.find(b => b._id.toString() === birdId);
      devLog('found bird:', bird ? bird.name : 'not found');
      if (bird) {
        birdFirsts.push({
          _id: `${bird._id}_${data.record._id}`,
          bird: {
            _id: bird._id,
            name: bird.name,
            scientificName: bird.scientificName,
            images: bird.images
          },
          user: {
            _id: data.record.observer._id,
            name: data.record.observer.name,
            avatar: data.record.observer.avatar
          },
          location: data.record.location ? data.record.location.name : '未知地点',
          createdAt: data.record.date
        });
      }
    });
    
    devLog('final birdFirsts:', birdFirsts.length);

    // 按首次记录时间排序
    birdFirsts.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

    res.status(200).json({
      success: true,
      data: birdFirsts,
      count: birdFirsts.length
    });

  } catch (error) {
    devError('获取鸟类首次记录榜失败:', error);
    res.status(500).json({
      success: false,
      message: '服务器错误',
      code: 'LEADERBOARD_BIRD_FIRSTS_FAILED',
    });
  }
}