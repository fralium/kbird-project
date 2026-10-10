const mongoose = require('mongoose');

const AI_MODES = ['general', 'identify', 'spots', 'knowledge'];

const aiMessageSchema = new mongoose.Schema(
  {
    role: {
      type: String,
      enum: ['user', 'assistant', 'system'],
      required: true,
    },
    content: {
      type: String,
      required: true,
      trim: true,
      maxlength: 20000,
    },
    kind: {
      type: String,
      enum: ['text', 'identify_result'],
      default: 'text',
    },
    meta: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
  },
  { _id: true, timestamps: { createdAt: true, updatedAt: false } }
);

const aiConversationSchema = new mongoose.Schema(
  {
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    mode: {
      type: String,
      enum: AI_MODES,
      default: 'general',
      index: true,
    },
    title: {
      type: String,
      default: '新对话',
      trim: true,
      maxlength: 120,
    },
    messages: {
      type: [aiMessageSchema],
      default: [],
    },
    lastMessageAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  { timestamps: true }
);

aiConversationSchema.index({ owner: 1, lastMessageAt: -1 });

module.exports = mongoose.model('AiConversation', aiConversationSchema);
module.exports.AI_MODES = AI_MODES;
