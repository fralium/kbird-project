const mongoose = require('mongoose');
const fs = require('fs').promises;
const path = require('path');

// 导入模型
const Bird = require('../server/models/birdModel');
const User = require('../server/models/userModel');
const Location = require('../server/models/locationModel');

require('dotenv').config();

/**
 * 性能监控和数据库健康检查
 */
async function monitorPerformance() {
  try {
    // 连接数据库
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/kbird', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('✅ 数据库连接成功');

    const startTime = Date.now();
    const report = {
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development',
      checks: {}
    };

    console.log('🔍 开始性能检查...');

    // 1. 数据库连接检查
    console.log('1️⃣ 检查数据库连接...');
    const connectionCheck = {
      status: 'healthy',
      host: mongoose.connection.host,
      port: mongoose.connection.port,
      name: mongoose.connection.name,
      readyState: mongoose.connection.readyState,
      collections: mongoose.connection.db.listCollections().toArray().then(cols => cols.length)
    };
    report.checks.connection = connectionCheck;

    // 2. 集合统计检查
    console.log('2️⃣ 检查集合统计...');
    const collectionStats = {};
    
    // 鸟类统计
    const birdCount = await Bird.countDocuments();
    const birdWithImages = await Bird.countDocuments({ 'images.0': { $exists: true } });
    const birdWithSightings = await Bird.countDocuments({ 'sightings.0': { $exists: true } });
    
    collectionStats.birds = {
      total: birdCount,
      withImages: birdWithImages,
      withSightings: birdWithSightings,
      imageCoverage: birdCount > 0 ? ((birdWithImages / birdCount) * 100).toFixed(2) + '%' : '0%',
      sightingCoverage: birdCount > 0 ? ((birdWithSightings / birdCount) * 100).toFixed(2) + '%' : '0%'
    };

    // 用户统计
    const userCount = await User.countDocuments();
    const activeUsers = await User.countDocuments({ lastLogin: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } });
    
    collectionStats.users = {
      total: userCount,
      active: activeUsers,
      activeRate: userCount > 0 ? ((activeUsers / userCount) * 100).toFixed(2) + '%' : '0%'
    };

    // 地点统计
    const locationCount = await Location.countDocuments();
    const locationsWithSightings = await Location.countDocuments({ 'sightings.0': { $exists: true } });
    
    collectionStats.locations = {
      total: locationCount,
      withSightings: locationsWithSightings,
      activityRate: locationCount > 0 ? ((locationsWithSightings / locationCount) * 100).toFixed(2) + '%' : '0%'
    };

    report.checks.collections = collectionStats;

    // 3. 查询性能检查
    console.log('3️⃣ 检查查询性能...');
    const queryPerformance = {};

    // 测试常用查询
    const queryTests = [
      { name: 'birds_find_all', query: () => Bird.find({}).limit(10).lean() },
      { name: 'birds_find_by_category', query: () => Bird.find({ category: { $regex: /雀形目/ } }).limit(10).lean() },
      { name: 'birds_find_by_protection', query: () => Bird.find({ chinaProtectionLevel: '国家一级' }).limit(10).lean() },
      { name: 'users_find_all', query: () => User.find({}).select('-password').limit(10).lean() },
      { name: 'locations_find_all', query: () => Location.find({}).limit(10).lean() }
    ];

    for (const test of queryTests) {
      const queryStart = Date.now();
      try {
        await test.query();
        const queryTime = Date.now() - queryStart;
        queryPerformance[test.name] = {
          status: 'success',
          executionTime: `${queryTime}ms`,
          performance: queryTime < 100 ? 'excellent' : queryTime < 500 ? 'good' : queryTime < 1000 ? 'fair' : 'poor'
        };
      } catch (error) {
        queryPerformance[test.name] = {
          status: 'error',
          error: error.message,
          performance: 'error'
        };
      }
    }

    report.checks.queryPerformance = queryPerformance;

    // 4. 索引检查
    console.log('4️⃣ 检查数据库索引...');
    const indexInfo = await mongoose.connection.db.collection('birds').indexes();
    const indexes = indexInfo.map(index => ({
      name: index.name,
      keys: Object.keys(index.key),
      unique: index.unique || false,
      sparse: index.sparse || false
    }));

    report.checks.indexes = {
      total: indexes.length,
      indexes: indexes
    };

    // 5. 数据质量检查
    console.log('5️⃣ 检查数据质量...');
    const dataQuality = {};

    // 检查缺失字段
    const birdsWithoutImages = await Bird.countDocuments({ images: { $size: 0 } });
    const birdsWithoutDescription = await Bird.countDocuments({ $or: [{ description: { $exists: false } }, { description: '' }] });
    const birdsWithoutHabitat = await Bird.countDocuments({ $or: [{ habitat: { $exists: false } }, { habitat: '' }] });
    const birdsWithoutDistribution = await Bird.countDocuments({ $or: [{ distribution: { $exists: false } }, { distribution: '' }] });

    dataQuality.birds = {
      withoutImages: birdsWithoutImages,
      withoutDescription: birdsWithoutDescription,
      withoutHabitat: birdsWithoutHabitat,
      withoutDistribution: birdsWithoutDistribution,
      completenessScore: birdCount > 0 ? (100 - ((birdsWithoutImages + birdsWithoutDescription + birdsWithoutHabitat + birdsWithoutDistribution) / (birdCount * 4)) * 100).toFixed(2) + '%' : '0%'
    };

    report.checks.dataQuality = dataQuality;

    // 6. 系统资源检查
    console.log('6️⃣ 检查系统资源...');
    const systemInfo = {
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch,
      uptime: process.uptime(),
      memoryUsage: process.memoryUsage(),
      timestamp: new Date().toISOString()
    };

    report.checks.system = systemInfo;

    // 计算总体健康评分
    const totalChecks = Object.keys(report.checks).length;
    const healthyChecks = Object.values(report.checks).filter(check => 
      check.status === 'healthy' || check.status === 'success' || typeof check === 'object'
    ).length;

    report.overallHealth = {
      score: Math.round((healthyChecks / totalChecks) * 100),
      status: healthyChecks === totalChecks ? 'healthy' : 'warning',
      totalChecks,
      healthyChecks
    };

    const totalTime = Date.now() - startTime;
    report.executionTime = `${totalTime}ms`;

    // 输出报告
    console.log('\n📊 性能监控报告');
    console.log('=' * 50);
    console.log(`⏰ 检查时间: ${report.timestamp}`);
    console.log(`🌍 环境: ${report.environment}`);
    console.log(`⏱️ 执行时间: ${report.executionTime}`);
    console.log(`🏥 健康评分: ${report.overallHealth.score}/100 (${report.overallHealth.status})`);
    
    console.log('\n📈 集合统计:');
    Object.entries(collectionStats).forEach(([collection, stats]) => {
      console.log(`  ${collection}:`);
      Object.entries(stats).forEach(([key, value]) => {
        console.log(`    ${key}: ${value}`);
      });
    });

    console.log('\n🚀 查询性能:');
    Object.entries(queryPerformance).forEach(([query, result]) => {
      console.log(`  ${query}: ${result.executionTime || result.status} (${result.performance})`);
    });

    console.log('\n🗂️ 索引信息:');
    console.log(`  总索引数: ${indexes.length}`);
    indexes.forEach(index => {
      console.log(`  - ${index.name}: ${index.keys.join(', ')} ${index.unique ? '(唯一)' : ''}`);
    });

    console.log('\n📋 数据质量:');
    Object.entries(dataQuality).forEach(([collection, stats]) => {
      console.log(`  ${collection}:`);
      Object.entries(stats).forEach(([key, value]) => {
        console.log(`    ${key}: ${value}`);
      });
    });

    // 保存报告到文件
    const reportsDir = path.join(process.cwd(), 'reports');
    await fs.mkdir(reportsDir, { recursive: true });
    
    const reportFile = path.join(reportsDir, `performance-report-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
    await fs.writeFile(reportFile, JSON.stringify(report, null, 2), 'utf8');
    
    console.log(`\n💾 详细报告已保存到: ${reportFile}`);

    return report;

  } catch (error) {
    console.error('❌ 性能监控失败:', error.message);
    throw error;
  } finally {
    await mongoose.disconnect();
    console.log('🔌 数据库连接已关闭');
  }
}

// 命令行执行
if (require.main === module) {
  monitorPerformance()
    .then(() => {
      console.log('\n🎉 性能监控完成');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 性能监控失败:', error);
      process.exit(1);
    });
}

module.exports = {
  monitorPerformance
};





