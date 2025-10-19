const mongoose = require('mongoose');

const reportSchema = mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, '请输入报告标题'],
      maxlength: [100, '标题不能超过100个字符']
    },
    type: {
      type: String,
      required: [true, '请选择报告类型'],
      enum: {
        values: ['bug', 'feature', 'content', 'user', 'other'],
        message: '无效的报告类型'
      }
    },
    content: {
      type: String,
      required: [true, '请输入报告内容'],
      maxlength: [1000, '内容不能超过1000个字符']
    },
    status: {
      type: String,
      enum: ['pending', 'in_progress', 'resolved', 'rejected'],
      default: 'pending'
    },
    priority: {
      type: String,
      enum: ['low', 'medium', 'high', 'urgent'],
      default: 'medium'
    },
    reporter: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    relatedBird: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Bird'
    },
    relatedSighting: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Bird.sightings'
    },
    relatedUser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    adminResponse: {
      type: String,
      maxlength: [500, '管理员回复不能超过500个字符']
    },
    handledBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    handledAt: {
      type: Date
    },
    attachments: [{
      filename: String,
      originalName: String,
      path: String,
      size: Number,
      mimetype: String
    }]
  },
  {
    timestamps: true
  }
);

// 避免重复编译模型
const Report = mongoose.models.Report || mongoose.model('Report', reportSchema);

module.exports = Report;
