const mongoose = require('mongoose');

const birdSchema = mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, '请输入鸟类名称'],
      index: true,
      unique: true,
    },
    scientificName: {
      type: String,
      required: [true, '请输入鸟类学名'],
      index: true, // 添加索引
    },
    englishName: {
      type: String,
      default: '',
      index: true,
    },
    taxonomyCode: {
      type: String,
      default: '',
      index: true,
    },
    namePinyin: {
      type: String,
      default: '',
      index: true, // 添加索引
    },
    scientificNamePinyin: {
      type: String,
      default: '',
      index: true, // 添加索引
    },
    namePinyinInitials: {
      type: String,
      default: '',
      index: true, // 添加索引
    },
    scientificNamePinyinInitials: {
      type: String,
      default: '',
      index: true, // 添加索引
    },
    description: {
      type: String,
      required: [true, '请输入鸟类描述'],
    },
    habitat: {
      type: String,
      required: [true, '请输入鸟类栖息地'],
    },
    distribution: {
      type: String,
      required: [true, '请输入鸟类分布区域'],
    },
    conservationStatus: {
      type: String,
      default: '未评估',
    },
    chinaProtectionLevel: {
      type: String,
      enum: ['国家一级', '国家二级', '三有', '省级保护', '未列入'],
      default: '未列入',
    },
    iucnProtectionLevel: {
      type: String,
      enum: ['无危(LC)', '近危(NT)', '易危(VU)', '濒危(EN)', '极危(CR)', '野外灭绝(EW)', '灭绝(EX)', '数据缺乏(DD)', '未评估(NE)'],
      default: '未评估(NE)',
    },
    images: [
      {
        url: {
          type: String,
          required: true,
        },
        caption: {
          type: String,
        },
        location: {
          type: String,
        },
        date: {
          type: Date,
        },
        photographer: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
        },
        order: {
          type: Number,
          default: 0,
        },
        // 固定标签：雄性/雌性/幼鸟/繁殖羽/飞翔 等
        tags: {
          type: [String],
          default: [],
        },
        source: {
          type: String,
          default: '',
        },
        sourceHash: {
          type: String,
          default: '',
        },
        sourceFileName: {
          type: String,
          default: '',
        },
        sourceBytes: {
          type: Number,
          default: 0,
        },
      },
    ],
    calls: [
      {
        url: {
          type: String,
          required: true,
        },
        caption: {
          type: String,
        },
        location: {
          type: String,
        },
        date: {
          type: Date,
        },
        recorder: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
        },
        order: {
          type: Number,
          default: 0,
        },
        tags: {
          type: [String],
          default: [],
        },
        mimeType: {
          type: String,
          default: '',
        },
        durationSec: {
          type: Number,
        },
      },
    ],
    sightings: [
      {
        location: {
          // 关联到Location模型
          locationId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Location',
          },
          // 保留原有字段以兼容旧数据
          type: {
            type: String,
            enum: ['Point'],
            default: 'Point',
          },
          coordinates: {
            type: [Number], // [经度, 纬度]
          },
          name: {
            type: String,
            required: true,
          },
        },
        date: {
          type: Date,
          required: true,
        },
        observer: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
        },
        notes: {
          type: String,
        },
        weather: {
          type: String,
        },
        behavior: {
          type: String,
        },
        images: [
          {
            url: {
              type: String,
            },
            caption: {
              type: String,
            },
          },
        ],
        // 提交时间
        submittedAt: {
          type: Date,
          default: Date.now
        }
      },
    ],
    category: {
      type: String,
      required: [true, '请选择鸟类分类'],
      index: true, // 添加索引
    },
    // 分类学信息
    order: {
      type: String,
      index: true, // 添加索引
    },
    family: {
      type: String,
      index: true, // 添加索引
    },
    genus: {
      type: String,
      index: true, // 添加索引
    },
    species: {
      type: String,
      index: true, // 添加索引
    },
    tags: [
      {
        type: String,
      },
    ],
    // 中文别名（名录异名、旧称），用于导入匹配与搜索
    nameAliases: [
      {
        type: String,
        trim: true,
      },
    ],
    nameAliasPinyin: {
      type: [String],
      default: [],
    },
    nameAliasPinyinInitials: {
      type: [String],
      default: [],
      index: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    // 用户申请入库的临时档案（待管理员补全）
    isTemporary: {
      type: Boolean,
      default: false,
      index: true,
    },
    requestedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    requestStatus: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
    },
    // 形态特征
    size: {
      type: String,
    },
    weight: {
      type: String,
    },
    wingspan: {
      type: String,
    },
    plumage: {
      type: String,
    },
    bill: {
      type: String,
    },
    legs: {
      type: String,
    },
    // 行为习性
    behavior: {
      type: String,
    },
    diet: {
      type: String,
    },
    migration: {
      type: String,
    },
    // 繁殖信息
    breedingSeason: {
      type: String,
    },
    nestType: {
      type: String,
    },
    clutchSize: {
      type: String,
    },
    // 识别要点
    identificationTips: {
      type: String,
    },
    similarSpecies: {
      type: String,
    },
    // 参考资料
    references: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

// 创建索引以支持搜索功能
birdSchema.index({ name: 'text', scientificName: 'text', description: 'text', tags: 'text' });
birdSchema.index({ nameAliases: 1 });

// 添加复合索引优化查询性能
birdSchema.index({ category: 1, createdAt: -1 });
birdSchema.index({ conservationStatus: 1, createdAt: -1 });
birdSchema.index({ nameAliasPinyinInitials: 1 });
birdSchema.index({ nameAliasPinyin: 1 });
birdSchema.index({ namePinyinInitials: 1, scientificNamePinyinInitials: 1 });

// 添加地理位置索引
birdSchema.index({ 'distribution.coordinates': '2dsphere' });

// 避免重复编译模型
const Bird = mongoose.models.Bird || mongoose.model('Bird', birdSchema);
module.exports = Bird;
module.exports.default = Bird;