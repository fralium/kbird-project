/**
 * 观测热度计算工具
 * 基于观察记录数量、时间分布、用户参与度等因素计算热度指数
 */

/**
 * 计算鸟类观测热度
 * @param {Object} bird - 鸟类对象
 * @param {Array} sightings - 观察记录数组
 * @returns {Object} 热度信息
 */
export function calculateObservationHeat(bird, sightings = []) {
  if (!sightings || sightings.length === 0) {
    return {
      level: 0,
      score: 0,
      label: '无记录',
      description: '暂无观察记录',
      color: '#9E9E9E'
    };
  }

  // 基础分数：观察记录数量
  let score = sightings.length * 10;

  // 时间因子：最近30天内的记录权重更高
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  
  const recentSightings = sightings.filter(sighting => {
    const sightingDate = new Date(sighting.date);
    return sightingDate >= thirtyDaysAgo;
  });
  
  score += recentSightings.length * 15; // 最近30天的记录额外加分

  // 用户参与度：不同用户的记录数量
  const uniqueUsers = new Set(sightings.map(s => s.observer?._id || s.observer));
  score += uniqueUsers.size * 5; // 每个不同用户加分

  // 地点多样性：不同地点的记录数量
  const uniqueLocations = new Set(sightings.map(s => s.location?.name || s.location));
  score += uniqueLocations.size * 3; // 每个不同地点加分

  // 季节性活跃度：基于记录的时间分布
  const monthlyDistribution = getMonthlyDistribution(sightings);
  const seasonalityScore = calculateSeasonalityScore(monthlyDistribution);
  score += seasonalityScore;

  return getHeatLevel(score);
}

/**
 * 获取月度分布
 * @param {Array} sightings - 观察记录数组
 * @returns {Array} 12个月的记录数量数组
 */
function getMonthlyDistribution(sightings) {
  const monthlyCount = new Array(12).fill(0);
  
  sightings.forEach(sighting => {
    const date = new Date(sighting.date);
    const month = date.getMonth(); // 0-11
    monthlyCount[month]++;
  });
  
  return monthlyCount;
}

/**
 * 计算季节性得分
 * @param {Array} monthlyDistribution - 月度分布数组
 * @returns {Number} 季节性得分
 */
function calculateSeasonalityScore(monthlyDistribution) {
  const maxCount = Math.max(...monthlyDistribution);
  const totalCount = monthlyDistribution.reduce((sum, count) => sum + count, 0);
  
  if (totalCount === 0) return 0;
  
  // 如果某个月份有较多记录，说明有明显的季节性
  const seasonality = maxCount / totalCount;
  return Math.round(seasonality * 20); // 最高20分
}

/**
 * 根据分数获取热度等级
 * @param {Number} score - 热度分数
 * @returns {Object} 热度等级信息
 */
function getHeatLevel(score) {
  if (score >= 100) {
    return {
      level: 5,
      score,
      label: '🔥 极高',
      description: '非常活跃，经常被观察',
      color: '#FF5722'
    };
  } else if (score >= 70) {
    return {
      level: 4,
      score,
      label: '🔥 很高',
      description: '很活跃，经常被观察',
      color: '#FF9800'
    };
  } else if (score >= 50) {
    return {
      level: 3,
      score,
      label: '🔥 较高',
      description: '比较活跃，偶尔被观察',
      color: '#FFC107'
    };
  } else if (score >= 30) {
    return {
      level: 2,
      score,
      label: '🔥 一般',
      description: '偶尔被观察',
      color: '#8D6E63'
    };
  } else if (score >= 10) {
    return {
      level: 1,
      score,
      label: '🔥 较低',
      description: '很少被观察',
      color: 'var(--text-muted)'
    };
  } else {
    return {
      level: 0,
      score,
      label: '📝 新记录',
      description: '刚刚开始记录',
      color: 'var(--text-muted)'
    };
  }
}

/**
 * 获取热度等级对应的星星数量
 * @param {Number} level - 热度等级 (0-5)
 * @returns {String} 星星字符串
 */
export function getHeatStars(level) {
  const stars = ['⭐', '⭐⭐', '⭐⭐⭐', '⭐⭐⭐⭐', '⭐⭐⭐⭐⭐'];
  return stars[level - 1] || '📝';
}

/**
 * 获取热度颜色
 * @param {Number} level - 热度等级 (0-5)
 * @returns {String} 颜色值
 */
export function getHeatColor(level) {
  const colors = [
    '#FFFFFF', // 无记录
    '#FFFFFF', // 较低
    '#FFFFFF', // 一般
    '#FFC107', // 较高
    '#FF9800', // 很高
    '#FF5722'  // 极高
  ];
  return colors[level] || colors[0];
}






