const mongoose = require('mongoose');

const locationSchema = mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, '请输入地点名称'],
      unique: true,
      trim: true,
    },
    description: {
      type: String,
      default: '',
    },
    // 地理坐标
    coordinates: {
      type: {
        type: String,
        enum: ['Point'],
        default: 'Point',
      },
      coordinates: {
        type: [Number], // [经度, 纬度]
        required: true,
      },
    },
    // 地址信息
    address: {
      province: {
        type: String,
        default: '',
      },
      city: {
        type: String,
        default: '',
      },
      district: {
        type: String,
        default: '',
      },
      street: {
        type: String,
        default: '',
      },
    },
    // 地点类型
    type: {
      type: String,
      enum: ['公园', '自然保护区', '湿地', '森林', '山区', '城市', '乡村', '海岸', '湖泊', '河流', '其他'],
      default: '其他',
    },
    // 环境特征
    environment: {
      habitat: [String], // 栖息地类型
      vegetation: [String], // 植被类型
      waterSource: {
        type: String,
        enum: ['有水源', '无水源', '季节性水源'],
        default: '无水源',
      },
      accessibility: {
        type: String,
        enum: ['容易到达', '需要步行', '需要爬山', '需要特殊装备', '限制进入'],
        default: '容易到达',
      },
    },
    // 观鸟信息
    birding: {
      bestSeason: [String], // 最佳观鸟季节
      commonSpecies: [String], // 常见鸟类
      rareSpecies: [String], // 稀有鸟类
      difficulty: {
        type: String,
        enum: ['初级', '中级', '高级'],
        default: '初级',
      },
    },
    // 设施信息
    facilities: {
      parking: {
        type: Boolean,
        default: false,
      },
      restroom: {
        type: Boolean,
        default: false,
      },
      shelter: {
        type: Boolean,
        default: false,
      },
      observationPlatform: {
        type: Boolean,
        default: false,
      },
      informationBoard: {
        type: Boolean,
        default: false,
      },
    },
    // 图片
    images: [
      {
        url: {
          type: String,
          required: true,
        },
        caption: {
          type: String,
        },
        photographer: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
        },
        uploadedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    // 统计信息
    stats: {
      totalSightings: {
        type: Number,
        default: 0,
      },
      uniqueSpecies: {
        type: Number,
        default: 0,
      },
      lastVisited: {
        type: Date,
      },
    },
    // 创建者
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    // 状态
    status: {
      type: String,
      enum: ['active', 'inactive', 'archived'],
      default: 'active',
    },
    // 标签
    tags: [String],
  },
  {
    timestamps: true,
  }
);

// 创建地理空间索引
locationSchema.index({ coordinates: '2dsphere' });

// 创建文本搜索索引
locationSchema.index({ 
  name: 'text', 
  description: 'text', 
  'address.city': 'text',
  'address.district': 'text',
  tags: 'text' 
});

// 虚拟字段：完整地址
locationSchema.virtual('fullAddress').get(function() {
  const addr = this.address;
  return [addr.province, addr.city, addr.district, addr.street]
    .filter(Boolean)
    .join(' ');
});

// 虚拟字段：坐标字符串
locationSchema.virtual('coordinatesString').get(function() {
  if (this.coordinates && this.coordinates.coordinates) {
    const [lng, lat] = this.coordinates.coordinates;
    return `${lat}, ${lng}`;
  }
  return '';
});

// 确保虚拟字段在JSON输出中包含
locationSchema.set('toJSON', { virtuals: true });

// 避免重复编译模型
module.exports = mongoose.models.Location || mongoose.model('Location', locationSchema);
