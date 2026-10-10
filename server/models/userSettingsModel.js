const mongoose = require('mongoose');

const userSettingsSchema = mongoose.Schema(
  {
    // 用户ID
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true,
    },
    
    // 主题设置（浅色 / 深色）
    theme: {
      type: String,
      enum: ['light', 'dark', 'auto'],
      default: 'light',
    },

    // 界面风格皮肤（与 theme 明暗分开）
    uiStyle: {
      type: String,
      enum: ['wetland', 'forest', 'ink'],
      default: 'wetland',
    },
    
    // 语言设置
    language: {
      type: String,
      enum: ['zh-CN', 'en'],
      default: 'zh-CN',
    },
    
    // 日期格式
    dateFormat: {
      type: String,
      enum: ['YYYY-MM-DD', 'MM/DD/YYYY', 'DD/MM/YYYY'],
      default: 'YYYY-MM-DD',
    },
    
    // 单位设置
    units: {
      temperature: {
        type: String,
        enum: ['celsius', 'fahrenheit'],
        default: 'celsius',
      },
      distance: {
        type: String,
        enum: ['metric', 'imperial'],
        default: 'metric',
      },
    },
    
    // 通知偏好
    notifications: {
      goals: {
        type: Boolean,
        default: true,
      },
      backups: {
        type: Boolean,
        default: true,
      },
      reports: {
        type: Boolean,
        default: true,
      },
      newRecords: {
        type: Boolean,
        default: false,
      },
      weeklySummary: {
        type: Boolean,
        default: false,
      },
    },
    
    // 显示偏好
    display: {
      itemsPerPage: {
        type: Number,
        default: 20,
        min: 10,
        max: 100,
      },
      showThumbnails: {
        type: Boolean,
        default: true,
      },
      compactMode: {
        type: Boolean,
        default: false,
      },
    },
    
    // 隐私设置
    privacy: {
      showEmail: {
        type: Boolean,
        default: false,
      },
      showLocation: {
        type: Boolean,
        default: true,
      },
      allowDataExport: {
        type: Boolean,
        default: true,
      },
    },

    // 个人便签
    notepad: {
      content: {
        type: String,
        default: '',
        maxlength: 50000,
      },
      notes: [
        {
          id: { type: String, required: true },
          title: { type: String, default: '未命名便签', maxlength: 120 },
          content: { type: String, default: '', maxlength: 50000 },
          pinned: { type: Boolean, default: false },
          comments: [
            {
              id: { type: String, required: true },
              quote: { type: String, default: '', maxlength: 500 },
              start: { type: Number, default: 0 },
              end: { type: Number, default: 0 },
              body: { type: String, default: '', maxlength: 2000 },
              createdAt: { type: Date, default: Date.now },
            },
          ],
          createdAt: { type: Date, default: Date.now },
          updatedAt: { type: Date, default: Date.now },
        },
      ],
      activeNoteId: {
        type: String,
        default: '',
      },
      updatedAt: {
        type: Date,
        default: null,
      },
    },

    localBirdPhotoRoot: {
      type: String,
      default: '',
      maxlength: 500,
    },
  },
  {
    timestamps: true,
  }
);

// 创建索引
userSettingsSchema.index({ userId: 1 });

// 避免重复编译模型
const UserSettings = mongoose.models.UserSettings || mongoose.model('UserSettings', userSettingsSchema);

module.exports = UserSettings;
