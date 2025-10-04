const mongoose = require('mongoose');

const recordSchema = mongoose.Schema(
  {
    // 观鸟记录基本信息
    title: {
      type: String,
      default: '',
    },
    description: {
      type: String,
      default: '',
    },
    
    // 观察地点
    location: {
      name: {
        type: String,
        required: [true, '请输入观察地点'],
      },
      coordinates: {
        type: {
          type: String,
          enum: ['Point'],
          default: 'Point',
        },
        coordinates: {
          type: [Number], // [经度, 纬度]
          default: [120.1551, 30.2741], // 默认杭州坐标
        },
      },
      address: {
        province: String,
        city: String,
        district: String,
        detail: String,
      },
    },
    
    // 观察时间
    date: {
      type: Date,
      required: [true, '请输入观察日期'],
    },
    
    // 观察者
    observer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    
    // 观察到的鸟类列表
    birds: [
      {
        birdId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Bird',
          required: true,
        },
        // 该鸟类在此次观察中的具体信息
        notes: {
          type: String,
          default: '',
        },
        count: {
          type: Number,
          default: 1,
        },
        images: [
          {
            url: {
              type: String,
              required: true,
            },
            caption: {
              type: String,
              default: '',
            },
            uploadedAt: {
              type: Date,
              default: Date.now,
            },
          },
        ],
      },
    ],
    
    // 观察环境信息
    weather: {
      type: String,
      default: '',
    },
    temperature: {
      type: Number,
    },
    humidity: {
      type: Number,
    },
    wind: {
      type: String,
    },
    
    // 观察记录图片
    images: [
      {
        url: {
          type: String,
          required: true,
        },
        caption: {
          type: String,
          default: '',
        },
        uploadedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    
    // 观察备注
    notes: {
      type: String,
      default: '',
    },
    
    // 审核状态
    status: {
      type: String,
      enum: ['draft', 'pending', 'approved', 'rejected'],
      default: 'draft',
    },
    
    // 审核信息
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    reviewedAt: {
      type: Date,
    },
    reviewNotes: {
      type: String,
    },
    
    // 统计信息
    stats: {
      totalBirds: {
        type: Number,
        default: 0,
      },
      totalImages: {
        type: Number,
        default: 0,
      },
    },
    
    // 标签
    tags: [
      {
        type: String,
      },
    ],
    
    // 是否公开
    isPublic: {
      type: Boolean,
      default: true,
    },
    
    // 是否置顶
    isPinned: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

// 创建索引
recordSchema.index({ date: -1 });
recordSchema.index({ 'location.name': 1 });
recordSchema.index({ observer: 1, date: -1 });
recordSchema.index({ status: 1 });
recordSchema.index({ 'birds.birdId': 1 });
recordSchema.index({ tags: 1 });

// 地理位置索引
recordSchema.index({ 'location.coordinates.coordinates': '2dsphere' });

// 虚拟字段：鸟类数量
recordSchema.virtual('birdCount').get(function() {
  return this.birds ? this.birds.length : 0;
});

// 虚拟字段：图片数量
recordSchema.virtual('imageCount').get(function() {
  let count = this.images ? this.images.length : 0;
  if (this.birds) {
    this.birds.forEach(bird => {
      count += bird.images ? bird.images.length : 0;
    });
  }
  return count;
});

// 中间件：保存前更新统计信息
recordSchema.pre('save', function(next) {
  // 更新鸟类总数
  this.stats.totalBirds = this.birds ? this.birds.length : 0;
  
  // 更新图片总数
  let imageCount = this.images ? this.images.length : 0;
  if (this.birds) {
    this.birds.forEach(bird => {
      imageCount += bird.images ? bird.images.length : 0;
    });
  }
  this.stats.totalImages = imageCount;
  
  next();
});

// 避免重复编译模型
const Record = mongoose.models.Record || mongoose.model('Record', recordSchema);

module.exports = Record;
