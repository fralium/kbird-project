/**
 * 观察记录生境筛选。关键词与封面归类共用，避免筛出来的记录和卡片生境对不上。
 */
const HABITAT_FILTERS = [
  {
    key: 'wetland',
    label: '湿地',
    keywords: ['湿地', '湖', '荡', '沼', '苇', '滩涂', '水库', '塘', '河', '溪', '湾', '浜', '港', '浦'],
  },
  {
    key: 'forest',
    label: '林地',
    keywords: ['林', '森林', '竹', '园', '植物园', '树木园', '自然保护区'],
  },
  {
    key: 'mountain',
    label: '山地',
    keywords: ['山', '峰', '岭', '峡谷', '高原', '谷'],
  },
  {
    key: 'coastal',
    label: '海岸',
    keywords: ['海', '海岸', '海滨', '沙滩', '岛', '盐田', '河口', '海湾'],
  },
  {
    key: 'farmland',
    label: '农田',
    keywords: ['田', '稻', '农', '村', '圩', '坝', '茶'],
  },
  {
    key: 'urban',
    label: '城市',
    keywords: ['公园', '校园', '小区', '广场', '城市', '绿道', '博物馆'],
  },
];

module.exports = { HABITAT_FILTERS };
