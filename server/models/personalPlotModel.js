const mongoose = require('mongoose');

const PLOT_SOURCES = ['cbrc', 'manual', 'other'];

const plotEntrySchema = new mongoose.Schema(
  {
    date: { type: Date, required: true },
    observer: { type: String, default: '', trim: true, maxlength: 120 },
    source: {
      type: String,
      enum: PLOT_SOURCES,
      default: 'manual',
    },
    reportId: { type: String, default: '', trim: true, maxlength: 80 },
    locationText: { type: String, default: '', trim: true, maxlength: 300 },
    externalKey: { type: String, default: '', trim: true, maxlength: 300 },
    note: { type: String, default: '', trim: true, maxlength: 1000 },
  },
  { _id: true }
);

const plotSpeciesSchema = new mongoose.Schema(
  {
    birdId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Bird',
      default: null,
      index: true,
    },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    scientificName: { type: String, default: '', trim: true, maxlength: 200 },
    order: { type: String, default: '', trim: true },
    family: { type: String, default: '', trim: true },
    firstSeenAt: { type: Date, default: null },
    lastSeenAt: { type: Date, default: null },
    times: { type: Number, default: 0, min: 0 },
    observers: { type: [String], default: [] },
    sources: {
      type: [{ type: String, enum: PLOT_SOURCES }],
      default: [],
    },
    notes: { type: String, default: '', trim: true, maxlength: 2000 },
    entries: { type: [plotEntrySchema], default: [] },
  },
  { _id: true }
);

/** 鸟类记录中心「报告列表」行（地点/时间/记录人），靠报告编号与鸟种明细关联 */
const plotReportSchema = new mongoose.Schema(
  {
    reportId: { type: String, required: true, trim: true, maxlength: 80 },
    startAt: { type: Date, default: null },
    endAt: { type: Date, default: null },
    timeRaw: { type: String, default: '', trim: true, maxlength: 120 },
    observer: { type: String, default: '', trim: true, maxlength: 120 },
    locationText: { type: String, default: '', trim: true, maxlength: 300 },
    /** Optional catalog pin for this report only (overrides plot.locationId on report detail). */
    locationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Location',
      default: null,
    },
    speciesCountHint: { type: Number, default: 0, min: 0 },
    publicStatus: { type: String, default: '', trim: true, maxlength: 40 },
    birdsImported: { type: Number, default: 0, min: 0 },
    importedAt: { type: Date, default: null },
  },
  { _id: true }
);

const personalPlotSchema = new mongoose.Schema(
  {
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: [true, '请填写自留地名称'],
      trim: true,
      maxlength: 120,
    },
    province: { type: String, default: '', trim: true, maxlength: 80 },
    city: { type: String, default: '', trim: true, maxlength: 80 },
    district: { type: String, default: '', trim: true, maxlength: 80 },
    spot: { type: String, default: '', trim: true, maxlength: 120 },
    locationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Location',
      default: null,
    },
    notes: { type: String, default: '', trim: true, maxlength: 5000 },
    reports: { type: [plotReportSchema], default: [] },
    species: { type: [plotSpeciesSchema], default: [] },
    statsCache: {
      speciesCount: { type: Number, default: 0 },
      entryCount: { type: Number, default: 0 },
      reportCount: { type: Number, default: 0 },
      reportsWithBirds: { type: Number, default: 0 },
      updatedAt: { type: Date, default: Date.now },
    },
  },
  { timestamps: true }
);

personalPlotSchema.index({ owner: 1, updatedAt: -1 });

module.exports = mongoose.model('PersonalPlot', personalPlotSchema);
module.exports.PLOT_SOURCES = PLOT_SOURCES;
