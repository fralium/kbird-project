/**
 * 2023 三有名录仍用广义种，图鉴已拆种且用户确认继承三有。
 * 与「冲突拆分、不标三有」区分。
 */
const SANYOU_INHERIT_SPLITS = [
  { dbName: '喜山短翅鸫', listedAs: '蓝短翅鸫', listSci: 'Brachypteryx montana' },
  { dbName: '中华短翅鸫', listedAs: '蓝短翅鸫', listSci: 'Brachypteryx montana' },
  { dbName: '台湾短翅鸫', listedAs: '蓝短翅鸫', listSci: 'Brachypteryx montana' },
];

/**
 * 名录中文与图鉴（中国鸟类名录）中文不一致，按学名对应，两种都标三有。
 */
const SANYOU_GAZETTE_TO_DB = [
  { listName: '田鹨', listSci: 'Anthus richardi', dbName: '理氏鹨' },
  { listName: '东方田鹨', listSci: 'Anthus rufulus', dbName: '田鹨' },
  { listName: '点翅朱雀', listSci: 'Carpodacus rodopeplus', dbName: '喜山点翅朱雀' },
  { listName: '淡腹点翅朱雀', listSci: 'Carpodacus verreauxii', dbName: '点翅朱雀' },
];

module.exports = { SANYOU_INHERIT_SPLITS, SANYOU_GAZETTE_TO_DB };
