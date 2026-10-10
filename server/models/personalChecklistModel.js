const mongoose = require('mongoose');

const observedBirdSchema = new mongoose.Schema(
  {
    birdId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Bird',
      required: true,
    },
    firstSeenDate: {
      type: Date,
      default: Date.now,
    },
    firstSeenLocation: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    totalObservations: {
      type: Number,
      default: 1,
    },
  },
  { _id: false }
);

const targetBirdSchema = new mongoose.Schema(
  {
    birdId: { type: mongoose.Schema.Types.ObjectId, ref: 'Bird' },
    notes: { type: String, default: '' },
    completed: { type: Boolean, default: false },
    completedDate: Date,
  },
  { _id: true }
);

const targetListSpeciesSchema = new mongoose.Schema(
  {
    birdId: { type: mongoose.Schema.Types.ObjectId, ref: 'Bird', required: true },
    notes: { type: String, default: '' },
    completed: { type: Boolean, default: false },
    completedDate: Date,
  },
  { _id: true }
);

const targetListSchema = new mongoose.Schema(
  {
    title: { type: String, default: '', trim: true },
    locationLabel: { type: String, default: '', trim: true },
    sourceHistoryId: { type: String, default: '' },
    createdAt: { type: Date, default: Date.now },
    species: { type: [targetListSpeciesSchema], default: [] },
  },
  { _id: true }
);

const targetLocationSchema = new mongoose.Schema(
  {
    locationName: { type: String, default: '' },
    notes: { type: String, default: '' },
    completed: { type: Boolean, default: false },
    completedDate: Date,
  },
  { _id: true }
);

const personalChecklistSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
    },
    observedBirds: {
      type: [observedBirdSchema],
      default: [],
    },
    goals: {
      year: { type: mongoose.Schema.Types.Mixed, default: {} },
      targetBirds: { type: [targetBirdSchema], default: [] },
      targetLists: { type: [targetListSchema], default: [] },
      targetLocations: { type: [targetLocationSchema], default: [] },
    },
    settings: {
      autoSync: { type: Boolean, default: true },
      sortBy: { type: String, default: 'firstSeenDate' },
    },
    statsCache: { type: mongoose.Schema.Types.Mixed, default: null },
  },
  { timestamps: true }
);

personalChecklistSchema.index({ userId: 1 });

module.exports =
  mongoose.models.PersonalChecklist ||
  mongoose.model('PersonalChecklist', personalChecklistSchema);
