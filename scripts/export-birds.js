const mongoose = require('mongoose');
const fs = require('fs');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/kbird';

async function exportBirds() {
  try {
    console.log('🔧 连接数据库...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ 数据库连接成功');
    
    const Bird = mongoose.model('Bird', new mongoose.Schema({}, { strict: false }));
    
    // 获取所有鸟类数据
    const birds = await Bird.find({});
    console.log(`📊 找到 ${birds.length} 个鸟类`);
    
    // 保存为数组格式
    fs.writeFileSync('ubuntu-release/build/seeds/birds-array.json', JSON.stringify(birds, null, 2));
    console.log('✅ 鸟类数据已导出到 birds-array.json');
    
    // 检查是否有占位符图片
    const birdsWithPlaceholders = birds.filter(bird => 
      bird.images && bird.images.some(img => img.url && img.url.includes('via.placeholder.com'))
    );
    
    if (birdsWithPlaceholders.length > 0) {
      console.log(`⚠️ 发现 ${birdsWithPlaceholders.length} 个鸟类仍包含占位符图片`);
    } else {
      console.log('✅ 所有鸟类图片都已修复');
    }
    
  } catch (error) {
    console.error('❌ 导出失败:', error.message);
  } finally {
    await mongoose.disconnect();
  }
}

exportBirds();

