// 地点统计数据缓存模块
const { isDevelopment, devLog } = require('../server/utils/devLogger');
const statsCache = new Map();
const CACHE_DURATION = 5 * 60 * 1000; // 5分钟缓存

// 计算地点统计数据的通用函数
async function calculateLocationStats(locationName, Bird) {
  try {
    // 检查缓存
    const cacheKey = `stats_${locationName}`;
    const cached = statsCache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      // 只在开发环境或数据非零时打印缓存日志
      if (isDevelopment && (cached.data.totalSightings > 0 || cached.data.uniqueSpecies > 0)) {
        devLog(`✅ 使用缓存数据 [${locationName}]: ${JSON.stringify(cached.data)}`);
      }
      return cached.data;
    }

    const birds = await Bird.find({
      'sightings.location.name': locationName
    }).select('name scientificName sightings');

    // 按观察批次统计（同一天同一地点的观察算作一个批次）
    const observationBatches = new Map();
    const speciesSet = new Set();

    birds.forEach(bird => {
      bird.sightings.forEach(sighting => {
        if (sighting.location.name === locationName) {
          // 使用地点+日期作为批次标识
          const batchKey = `${sighting.location.name}_${new Date(sighting.date).toDateString()}`;
          
          if (!observationBatches.has(batchKey)) {
            observationBatches.set(batchKey, {
              location: sighting.location.name,
              date: sighting.date,
              species: new Set()
            });
          }
          
          // 添加该鸟类到该批次的物种集合中
          observationBatches.get(batchKey).species.add(bird._id.toString());
          // 添加到总物种集合中
          speciesSet.add(bird._id.toString());
        }
      });
    });

    // 观察次数 = 批次数量
    const totalSightings = observationBatches.size;

    const result = {
      totalSightings: totalSightings,
      uniqueSpecies: speciesSet.size
    };

    // 只在有数据或开发环境时打印详细日志
    if (totalSightings > 0 || speciesSet.size > 0 || isDevelopment) {
      devLog(`📊 计算统计 [${locationName}]: ${JSON.stringify(result)}`);
      if (totalSightings > 0) {
        devLog(`🔍 批次详情 [${locationName}]: ${Array.from(observationBatches.keys()).join(', ')}`);
      }
    }

    // 缓存结果
    statsCache.set(cacheKey, {
      data: result,
      timestamp: Date.now()
    });

    return result;
  } catch (error) {
    console.error('计算地点统计失败:', error);
    return {
      totalSightings: 0,
      uniqueSpecies: 0
    };
  }
}

// 计算详细地点统计数据的通用函数
async function calculateDetailedLocationStats(locationName, Bird) {
  try {
    // 检查缓存 - 使用相同的缓存键
    const cacheKey = `stats_${locationName}`;
    const cached = statsCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      // 从基础统计数据构建详细统计数据
      const baseStats = cached.data;
      // 需要重新计算详细统计，但使用缓存的基础数据
      // 这里我们继续执行下面的计算逻辑
      if (isDevelopment && (baseStats.totalSightings > 0 || baseStats.uniqueSpecies > 0)) {
        devLog(`✅ 使用缓存基础数据 [${locationName}]: ${JSON.stringify(baseStats)}`);
      }
    }

    const birds = await Bird.find({
      'sightings.location.name': locationName
    }).select('name scientificName sightings');

    // 按观察批次统计（同一天同一地点的观察算作一个批次）
    const observationBatches = new Map();
    const speciesMap = new Map();
    const commonSpecies = [];
    const rareSpecies = [];

    birds.forEach(bird => {
      bird.sightings.forEach(sighting => {
        if (sighting.location.name === locationName) {
          // 使用地点+日期作为批次标识
          const batchKey = `${sighting.location.name}_${new Date(sighting.date).toDateString()}`;
          
          if (!observationBatches.has(batchKey)) {
            observationBatches.set(batchKey, {
              location: sighting.location.name,
              date: sighting.date,
              species: new Set()
            });
          }
          
          // 添加该鸟类到该批次的物种集合中
          observationBatches.get(batchKey).species.add(bird._id.toString());
          
          // 统计物种出现次数
          if (!speciesMap.has(bird._id.toString())) {
            speciesMap.set(bird._id.toString(), {
              name: bird.name,
              scientificName: bird.scientificName,
              count: 0
            });
          }
          speciesMap.get(bird._id.toString()).count++;
        }
      });
    });

    // 观察次数 = 批次数量
    const totalSightings = observationBatches.size;

    // 分类常见和稀有鸟类
    speciesMap.forEach(species => {
      if (species.count >= 5) {
        commonSpecies.push(species);
      } else if (species.count < 3) {
        rareSpecies.push(species);
      }
    });

    const result = {
      totalSightings: totalSightings,
      uniqueSpecies: speciesMap.size,
      commonSpecies: commonSpecies,
      rareSpecies: rareSpecies
    };

    // 缓存结果 - 使用相同的缓存键
    statsCache.set(cacheKey, {
      data: {
        totalSightings: result.totalSightings,
        uniqueSpecies: result.uniqueSpecies
      },
      timestamp: Date.now()
    });

    return result;
  } catch (error) {
    console.error('计算详细地点统计失败:', error);
    return {
      totalSightings: 0,
      uniqueSpecies: 0,
      commonSpecies: [],
      rareSpecies: []
    };
  }
}

// 清除缓存
function clearCache() {
  statsCache.clear();
}

// 清除特定地点的缓存
function clearLocationCache(locationName) {
  statsCache.delete(`stats_${locationName}`);
  statsCache.delete(`detailed_stats_${locationName}`);
}

module.exports = {
  calculateLocationStats,
  calculateDetailedLocationStats,
  clearCache,
  clearLocationCache
};
