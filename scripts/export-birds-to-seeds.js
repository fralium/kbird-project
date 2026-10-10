const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/kbird';

async function exportBirdsToSeeds() {
  try {
    console.log('🔧 连接数据库...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ 数据库连接成功');
    
    const Bird = mongoose.model('Bird', new mongoose.Schema({}, { strict: false }));
    
    // 获取所有鸟类数据
    const birds = await Bird.find({});
    console.log(`📊 找到 ${birds.length} 个鸟类`);
    
    // 创建seeds目录
    const seedsDir = 'seeds';
    if (!fs.existsSync(seedsDir)) {
      fs.mkdirSync(seedsDir, { recursive: true });
    }
    
    // 保存为数组格式
    const birdsArrayPath = path.join(seedsDir, 'birds-array.json');
    fs.writeFileSync(birdsArrayPath, JSON.stringify(birds, null, 2));
    console.log(`✅ 鸟类数据已导出到 ${birdsArrayPath}`);
    
    // 检查是否有占位符图片
    const birdsWithPlaceholders = birds.filter(bird => 
      bird.images && bird.images.some(img => img.url && img.url.includes('via.placeholder.com'))
    );
    
    if (birdsWithPlaceholders.length > 0) {
      console.log(`⚠️ 发现 ${birdsWithPlaceholders.length} 个鸟类仍包含占位符图片`);
      console.log('正在修复占位符图片...');
      
      // 修复占位符图片
      for (const bird of birdsWithPlaceholders) {
        if (bird.images && bird.images.length > 0) {
          bird.images.forEach(image => {
            if (image.url && image.url.includes('via.placeholder.com')) {
              image.url = '/images/default-bird.svg';
              image.caption = `${bird.name} - 默认图片`;
            }
          });
          
          await Bird.updateOne(
            { _id: bird._id },
            { $set: { images: bird.images } }
          );
        }
      }
      
      console.log(`✅ 修复了 ${birdsWithPlaceholders.length} 个鸟类的占位符图片`);
      
      // 重新导出修复后的数据
      const updatedBirds = await Bird.find({});
      fs.writeFileSync(birdsArrayPath, JSON.stringify(updatedBirds, null, 2));
      console.log('✅ 已更新birds-array.json文件');
    } else {
      console.log('✅ 所有鸟类图片都已修复');
    }
    
  } catch (error) {
    console.error('❌ 导出失败:', error.message);
  } finally {
    await mongoose.disconnect();
  }
}

exportBirdsToSeeds();

