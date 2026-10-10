const mongoose = require('mongoose');

const projectFolderSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    parentId: { type: String, default: '' },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const projectAssetSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    type: {
      type: String,
      enum: ['note', 'link', 'file', 'image'],
      required: true,
    },
    title: { type: String, required: true, trim: true, maxlength: 200 },
    content: { type: String, default: '', maxlength: 200000 },
    url: { type: String, default: '', maxlength: 2000 },
    folderId: { type: String, default: '' },
    tags: [{ type: String, trim: true, maxlength: 40 }],
    file: {
      originalName: { type: String, default: '' },
      storedName: { type: String, default: '' },
      relativePath: { type: String, default: '' },
      mimeType: { type: String, default: '' },
      size: { type: Number, default: 0 },
    },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const projectSchema = new mongoose.Schema(
  {
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    summary: {
      type: String,
      default: '',
      maxlength: 5000,
    },
    status: {
      type: String,
      enum: ['planning', 'collecting', 'analyzing', 'writing', 'done', 'archived'],
      default: 'planning',
      index: true,
    },
    locationScope: {
      type: String,
      default: '',
      maxlength: 500,
    },
    dateRange: {
      start: { type: Date, default: null },
      end: { type: Date, default: null },
    },
    tags: [{ type: String, trim: true, maxlength: 40 }],
    linkedRecordIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Record',
      },
    ],
    reportDraft: {
      type: String,
      default: '',
      maxlength: 200000,
    },
    folders: [projectFolderSchema],
    assets: [projectAssetSchema],
  },
  { timestamps: true }
);

projectSchema.index({ ownerId: 1, updatedAt: -1 });

const Project = mongoose.models.Project || mongoose.model('Project', projectSchema);

module.exports = Project;
