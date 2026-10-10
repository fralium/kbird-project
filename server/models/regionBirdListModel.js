const mongoose = require('mongoose');

const regionSpeciesSchema = new mongoose.Schema(
  {
    code: { type: String, default: '' },
    name: { type: String, required: true, index: true },
    scientificName: { type: String, default: '', index: true },
    englishName: { type: String, default: '' },
    order: { type: String, default: '', index: true },
    family: { type: String, default: '', index: true },
    recordCount: { type: Number, default: 0 },
    birdId: { type: mongoose.Schema.Types.ObjectId, ref: 'Bird', default: null },
  },
  { _id: false }
);

/** 被新版本取代时的历史条目（只存变更摘要，不存全表） */
const versionHistorySchema = new mongoose.Schema(
  {
    year: { type: Number },
    versionMonth: { type: Number, min: 1, max: 12 },
    speciesCount: { type: Number, default: 0 },
    originalFilename: { type: String, default: '' },
    publishedAt: { type: Date, default: Date.now },
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    /** 旧版 → 新版：新增 / 移除的物种行 */
    changes: {
      added: { type: [regionSpeciesSchema], default: [] },
      removed: { type: [regionSpeciesSchema], default: [] },
    },
    /** 发布后成为的新版本年月（便于展示「9月 → 10月」） */
    nextYear: { type: Number },
    nextVersionMonth: { type: Number, min: 1, max: 12 },
  },
  { _id: true }
);

const regionBirdListSchema = new mongoose.Schema(
  {
    regionName: {
      type: String,
      required: [true, '请填写地区名称'],
      trim: true,
      index: true,
    },
    /** 行政区：省 / 市 / 区县（区县可自由填写） */
    province: {
      type: String,
      default: '',
      trim: true,
      index: true,
    },
    city: {
      type: String,
      default: '',
      trim: true,
      index: true,
    },
    district: {
      type: String,
      default: '',
      trim: true,
    },
    /** 观鸟点（区以下，可关联地点名录） */
    spot: {
      type: String,
      default: '',
      trim: true,
      index: true,
    },
    locationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Location',
      default: null,
      index: true,
    },
    regionKey: {
      type: String,
      default: '',
      index: true,
    },
    title: {
      type: String,
      default: '',
      trim: true,
    },
    source: {
      type: String,
      default: '观鸟记录中心',
      trim: true,
    },
    year: {
      type: Number,
    },
    /** 版本月份 1–12，与 year 组成「2026年9月版本」 */
    versionMonth: {
      type: Number,
      min: 1,
      max: 12,
    },
    originalFilename: {
      type: String,
      default: '',
    },
    speciesCount: {
      type: Number,
      default: 0,
    },
    totalRecordCount: {
      type: Number,
      default: 0,
    },
    species: {
      type: [regionSpeciesSchema],
      default: [],
    },
    versionHistory: {
      type: [versionHistorySchema],
      default: [],
    },
    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  {
    timestamps: true,
  }
);

regionBirdListSchema.index(
  { province: 1, city: 1, district: 1, spot: 1 },
  { unique: true }
);
regionBirdListSchema.index({ regionName: 1, createdAt: -1 });

module.exports = mongoose.model('RegionBirdList', regionBirdListSchema);
