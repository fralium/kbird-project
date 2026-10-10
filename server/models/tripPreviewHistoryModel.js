const mongoose = require('mongoose');

const speciesRowSchema = new mongoose.Schema(
  {
    code: { type: String, default: '' },
    name: { type: String, default: '' },
    scientificName: { type: String, default: '' },
    englishName: { type: String, default: '' },
    order: { type: String, default: '' },
    family: { type: String, default: '' },
    recordCount: { type: Number, default: 0 },
    chance: { type: String, default: 'longshot' },
    chanceLabel: { type: String, default: '' },
    birdId: { type: String, default: '' },
    catalogName: { type: String, default: '' },
    catalogScientificName: { type: String, default: '' },
    personalCount: { type: Number, default: 0 },
  },
  { _id: false }
);

const tripPreviewHistorySchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    comparedAt: { type: Date, default: Date.now },
    tripDate: { type: Date, default: null },
    locationLabel: { type: String, default: '', trim: true, maxlength: 120 },
    locationId: { type: String, default: '' },
    fileName: { type: String, default: '', trim: true, maxlength: 200 },
    summary: {
      listCount: { type: Number, default: 0 },
      newCount: { type: Number, default: 0 },
      seenCount: { type: Number, default: 0 },
      unmatchedCount: { type: Number, default: 0 },
      lifeListCount: { type: Number, default: 0 },
      likelyCount: { type: Number, default: 0 },
    },
    thresholds: {
      highCut: { type: Number, default: 0 },
      midCut: { type: Number, default: 0 },
    },
    newBirdIds: { type: [String], default: [] },
    newSpecies: { type: [speciesRowSchema], default: [] },
    seenSpecies: { type: [speciesRowSchema], default: [] },
    unmatched: { type: [speciesRowSchema], default: [] },
  },
  { timestamps: true }
);

tripPreviewHistorySchema.index({ userId: 1, comparedAt: -1 });

module.exports =
  mongoose.models.TripPreviewHistory ||
  mongoose.model('TripPreviewHistory', tripPreviewHistorySchema);
