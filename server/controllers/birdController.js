const Bird = require('../models/birdModel');
const Record = require('../models/recordModel');
const User = require('../models/userModel');
const { pinyin } = require('pinyin-pro');

// @desc    获取所有鸟类或按条件搜索
// @route   GET /api/birds
// @access  Public
const getBirds = async (req, res) => {
  try {
    const { 
      search, 
      category, 
      order,
      family,
      conservationStatus,
      iucnProtectionLevel,
      chinaProtectionLevel,
      limit = 10, 
      page = 1 
    } = req.query;
    
    // 构建查询条件
    const query = {};
    
    // 搜索功能 - 支持模糊搜索和拼音匹配
    if (search) {
      // 使用正则表达式进行模糊搜索，支持中文和英文
      const searchRegex = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      
      // 构建搜索条件数组
      let searchConditions = [];
      
      // 添加拼音匹配
      try {
        // 检查搜索词是否为纯英文（可能是拼音首字母）
        const isEnglishOnly = /^[a-zA-Z]+$/.test(search);
        
        if (isEnglishOnly) {
          // 如果是纯英文，优先搜索中文名称的拼音（包括首字母缩写）
          const searchPinyinInitialsRegex = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
          
          // 尝试将不带空格的搜索词转换为带空格的格式进行匹配
          // 例如: "yanque" -> "yan que"
          let spacedSearch = '';
          if (search.length > 1) {
            // 简单的启发式方法：每2-3个字符后添加空格
            spacedSearch = search.replace(/(.{2,3})/g, '$1 ').trim();
          }
          const spacedSearchRegex = new RegExp(spacedSearch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
          
          // 专门针对中文名称的拼音搜索，不包含学名
          searchConditions = [
            { namePinyinInitials: searchPinyinInitialsRegex },
            { namePinyin: spacedSearchRegex }
          ];
          
          // 只有当搜索词较长时才包含学名搜索（避免拼音首字母干扰学名）
          if (search.length > 2) {
            searchConditions.push({ scientificName: searchRegex });
          }
        } else {
          // 如果是中文，进行拼音转换，同时包含名称搜索
          const searchPinyin = pinyin(search, { toneType: 'none', type: 'string' });
          const searchPinyinRegex = new RegExp(searchPinyin.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
          
          // 生成拼音首字母
          const searchPinyinInitials = searchPinyin.split(' ').map(word => word.charAt(0)).join('');
          const searchPinyinInitialsRegex = new RegExp(searchPinyinInitials.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
          
          // 生成不带空格的拼音用于搜索
          const searchPinyinNoSpace = searchPinyin.replace(/\s+/g, '');
          const searchPinyinNoSpaceRegex = new RegExp(searchPinyinNoSpace.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
          
          // 中文搜索包含名称、拼音（带空格和不带空格）和拼音首字母
          searchConditions = [
            { name: searchRegex },
            { scientificName: searchRegex },
            { namePinyin: searchPinyinRegex },
            { scientificNamePinyin: searchPinyinRegex },
            { namePinyin: searchPinyinNoSpaceRegex },
            { scientificNamePinyin: searchPinyinNoSpaceRegex },
            { namePinyinInitials: searchPinyinInitialsRegex },
            { scientificNamePinyinInitials: searchPinyinInitialsRegex }
          ];
        }
      } catch (error) {
        console.log('拼音转换失败，跳过拼音搜索:', error.message);
      }
      
      query.$or = searchConditions;
    }
    
    // 分类筛选（支持旧的category和新的order参数）
    if (category) {
      query.category = { $regex: category, $options: 'i' };
    }
    
    // 目筛选（新的order字段）
    if (order) {
      query.order = order;
    }
    
    // 科筛选
    if (family) {
      query.family = family;
    }
    
    // 保护状态筛选
    if (conservationStatus) {
      query.conservationStatus = conservationStatus;
    }
    
    // IUCN保护等级筛选
    if (iucnProtectionLevel) {
      query.iucnProtectionLevel = iucnProtectionLevel;
    }
    
    // 中国保护等级筛选
    if (chinaProtectionLevel) {
      query.chinaProtectionLevel = chinaProtectionLevel;
    }
    
    // 分页
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    // 使用聚合管道优化查询性能
    const pipeline = [
      { $match: query },
      {
        $lookup: {
          from: 'users',
          localField: 'createdBy',
          foreignField: '_id',
          as: 'createdBy',
          pipeline: [{ $project: { name: 1, email: 1 } }]
        }
      },
      {
        $addFields: {
          createdBy: { $arrayElemAt: ['$createdBy', 0] }
        }
      }
    ];
    
    // 如果有搜索条件，优先显示精确匹配的结果
    if (search) {
      pipeline.push({
        $addFields: {
          // 计算相关性分数：精确匹配名称得最高分
          relevanceScore: {
            $cond: [
              { $regexMatch: { input: "$name", regex: new RegExp(`^${search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') } },
              100,
              {
                $cond: [
                  { $regexMatch: { input: "$name", regex: new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') } },
                  90,
                  80
                ]
              }
            ]
          }
        }
      });
      pipeline.push({ $sort: { relevanceScore: -1, createdAt: -1 } });
    } else {
      // 没有搜索条件时，先获取所有鸟类，然后按最近观察记录时间排序
      const birds = await Bird.aggregate(pipeline);
      
      // 获取每个鸟类的最近观察记录时间
      const birdIds = birds.map(bird => bird._id);
      const recentRecords = await Record.aggregate([
        {
          $match: {
            'birds.birdId': { $in: birdIds },
            status: { $in: ['approved', 'pending'] }
          }
        },
        {
          $unwind: '$birds'
        },
        {
          $match: {
            'birds.birdId': { $in: birdIds }
          }
        },
        {
          $group: {
            _id: '$birds.birdId',
            lastObserved: { $max: '$date' },
            recordCount: { $sum: 1 }
          }
        }
      ]);
      
      // 创建最近观察时间的映射
      const lastObservedMap = new Map();
      recentRecords.forEach(record => {
        lastObservedMap.set(record._id.toString(), {
          lastObserved: record.lastObserved,
          recordCount: record.recordCount
        });
      });
      
      // 为每个鸟类添加最近观察时间信息
      birds.forEach(bird => {
        const birdId = bird._id.toString();
        const recordInfo = lastObservedMap.get(birdId);
        if (recordInfo) {
          bird.lastObserved = recordInfo.lastObserved;
          bird.recordCount = recordInfo.recordCount;
        } else {
          bird.lastObserved = null;
          bird.recordCount = 0;
        }
      });
      
      // 优化的排序逻辑：有照片+有记录的鸟类优先
      birds.sort((a, b) => {
        // 计算每个鸟类的优先级分数
        const getPriorityScore = (bird) => {
          let score = 0;
          
          // 有照片加分（爱鸟网照片额外加分）
          if (bird.images && bird.images.length > 0) {
            score += 100;
            
            // 爱鸟网照片额外加分
            const hasBirdfansImage = bird.images.some(img => 
              img.url && img.url.includes('_birdfans_')
            );
            if (hasBirdfansImage) {
              score += 50;
            }
          }
          
          // 有观察记录加分
          if (bird.lastObserved) {
            score += 80;
            
            // 记录数量越多加分越多（最多加20分）
            const recordBonus = Math.min(bird.recordCount * 2, 20);
            score += recordBonus;
          }
          
          // 保护等级加分（国家一级最高，国家二级次之）
          if (bird.chinaProtectionLevel === '国家一级') {
            score += 30;
          } else if (bird.chinaProtectionLevel === '国家二级') {
            score += 20;
          } else if (bird.chinaProtectionLevel === '三有') {
            score += 10;
          }
          
          return score;
        };
        
        const scoreA = getPriorityScore(a);
        const scoreB = getPriorityScore(b);
        
        // 按优先级分数排序（高分在前）
        if (scoreA !== scoreB) {
          return scoreB - scoreA;
        }
        
        // 分数相同时，按最近观察时间排序
        if (a.lastObserved && b.lastObserved) {
          return new Date(b.lastObserved) - new Date(a.lastObserved);
        }
        
        // 都没有记录时，按创建时间倒序
        return new Date(b.createdAt) - new Date(a.createdAt);
      });
      
      // 应用分页
      const paginatedBirds = birds.slice(skip, skip + parseInt(limit));
      
      // 获取总数
      const totalBirds = await Bird.countDocuments(query);
      
      res.status(200).json({
        success: true,
        data: paginatedBirds,
        total: totalBirds,
        page: parseInt(page),
        pages: Math.ceil(totalBirds / parseInt(limit)),
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(totalBirds / parseInt(limit)),
          totalItems: totalBirds,
          itemsPerPage: parseInt(limit)
        }
      });
      
      return;
    }
    
    pipeline.push({ $skip: skip });
    pipeline.push({ $limit: parseInt(limit) });

    const birds = await Bird.aggregate(pipeline);
    
    // 获取总数 - 使用更高效的countDocuments
    const total = await Bird.countDocuments(query);
    
    res.status(200).json({
      success: true,
      count: birds.length,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / parseInt(limit)),
      data: birds,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '服务器错误',
      error: error.message,
    });
  }
};

// @desc    获取单个鸟类详情
// @route   GET /api/birds/:id
// @access  Public
const getBirdById = async (req, res) => {
  try {
    const bird = await Bird.findById(req.params.id)
      .populate('images.photographer', 'name avatar')
      .populate('sightings.observer', 'name avatar');
    
    if (!bird) {
      return res.status(404).json({
        success: false,
        message: '未找到该鸟类记录',
      });
    }
    
    
    res.status(200).json({
      success: true,
      data: bird,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '服务器错误',
      error: error.message,
    });
  }
};

// @desc    创建新鸟类记录
// @route   POST /api/birds
// @access  Private
const createBird = async (req, res) => {
  try {
    // 添加创建者信息
    const birdData = {
      ...req.body,
      createdBy: req.user._id
    };
    
    const bird = await Bird.create(birdData);
    
    // 将新创建的鸟类添加到用户的贡献列表中
    await User.findByIdAndUpdate(
      req.user._id,
      { $push: { contributions: bird._id } }
    );
    
    res.status(201).json({
      success: true,
      data: bird,
      message: '鸟类记录创建成功'
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: '创建鸟类记录失败',
      error: error.message,
    });
  }
};

// @desc    更新鸟类信息
// @route   PUT /api/birds/:id
// @access  Private
const updateBird = async (req, res) => {
  try {
    const bird = await Bird.findById(req.params.id);
    
    if (!bird) {
      return res.status(404).json({
        success: false,
        message: '未找到该鸟类记录',
      });
    }
    
    const updatedBird = await Bird.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );
    
    res.status(200).json({
      success: true,
      data: updatedBird,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: '更新鸟类记录失败',
      error: error.message,
    });
  }
};

// @desc    删除鸟类记录
// @route   DELETE /api/birds/:id
// @access  Private
const deleteBird = async (req, res) => {
  try {
    const bird = await Bird.findById(req.params.id);
    
    if (!bird) {
      return res.status(404).json({
        success: false,
        message: '未找到该鸟类记录',
      });
    }
    
    await Bird.findByIdAndDelete(req.params.id);
    
    res.status(200).json({
      success: true,
      message: '鸟类记录已删除',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '服务器错误',
      error: error.message,
    });
  }
};

// @desc    添加鸟类目击记录
// @route   POST /api/birds/:id/sightings
// @access  Private
const addBirdSighting = async (req, res) => {
  try {
    console.log('添加观察记录请求:', {
      birdId: req.params.id,
      body: req.body,
      user: req.user
    });
    
    const bird = await Bird.findById(req.params.id);
    
    if (!bird) {
      console.log('鸟类记录未找到:', req.params.id);
      return res.status(404).json({
        success: false,
        message: '未找到该鸟类记录',
      });
    }
    
    // 构建观察记录数据
    const sightingData = {
      location: {
        type: 'Point',
        coordinates: [
          parseFloat(req.body.location.coordinates[0]) || 0,
          parseFloat(req.body.location.coordinates[1]) || 0
        ],
        name: req.body.location.name
      },
      date: new Date(req.body.date),
      observer: req.user._id,
      notes: req.body.notes,
      weather: req.body.weather || '',
      behavior: req.body.behavior || '',
      images: req.body.images || [],
      status: 'pending', // 添加审核状态
      submittedAt: new Date(),
      isTemporary: true // 标记为临时记录，需要审核
    };
    
    // 注意：图片已经在添加观察记录前上传到图片栏，这里不需要重复添加
    // 观察记录中的图片只用于在观察记录中显示
    
    bird.sightings.push(sightingData);
    await bird.save();
    
    // 重新查询并populate用户信息
    const updatedBird = await Bird.findById(req.params.id)
      .populate('images.photographer', 'name avatar')
      .populate('sightings.observer', 'name avatar');
    
    res.status(201).json({
      success: true,
      message: '观察记录已提交，等待管理员审核',
      data: updatedBird
    });
  } catch (error) {
    console.error('添加观察记录失败:', error);
    res.status(400).json({
      success: false,
      message: '添加目击记录失败',
      error: error.message,
    });
  }
};

// @desc    添加鸟类图片
// @route   POST /api/birds/:id/images
// @access  Private
const addBirdImage = async (req, res) => {
  try {
    console.log('添加鸟类图片请求:', {
      birdId: req.params.id,
      user: req.user ? req.user._id : '无用户信息',
      hasFile: !!req.file,
      fileInfo: req.file ? {
        originalname: req.file.originalname,
        mimetype: req.file.mimetype,
        size: req.file.size
      } : '无文件',
      contentType: req.headers['content-type']
    });

    const bird = await Bird.findById(req.params.id);
    
    if (!bird) {
      return res.status(404).json({
        success: false,
        message: '未找到该鸟类记录',
      });
    }
    
    // 处理文件上传
    let imageData = {
      url: '',
      caption: req.body.caption || '',
      location: req.body.location || '',
      date: req.body.date ? new Date(req.body.date) : new Date(),
      photographer: req.user._id
    };
    
    // 如果有上传的文件
    if (req.file) {
      // 验证文件类型
      const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
      if (!allowedTypes.includes(req.file.mimetype)) {
        return res.status(400).json({
          success: false,
          message: '不支持的文件类型，请上传 JPG、PNG、GIF 或 WEBP 格式的图片',
        });
      }
      
      // 验证文件大小 (5MB)
      const maxSize = 5 * 1024 * 1024;
      if (req.file.size > maxSize) {
        return res.status(400).json({
          success: false,
          message: '文件大小不能超过 5MB',
        });
      }
      
      // 生成安全的文件名
      const fileExtension = req.file.originalname.split('.').pop();
      const fileName = `${bird._id}_${Date.now()}.${fileExtension}`;
      const filePath = `/images/birds/${fileName}`;
      
      // 保存文件到public目录
      const fs = require('fs');
      const path = require('path');
      const uploadDir = path.join(process.cwd(), 'public/images/birds');
      
      // 确保目录存在
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }
      
      const fullPath = path.join(uploadDir, fileName);
      fs.writeFileSync(fullPath, req.file.buffer);
      
      imageData.url = filePath;
    } else if (req.body.url) {
      // 如果没有文件但有URL，直接使用URL
      imageData.url = req.body.url;
    } else {
      return res.status(400).json({
        success: false,
        message: '请提供图片文件或URL',
      });
    }
    
    bird.images.push(imageData);
    await bird.save();
    
    res.status(201).json({
      success: true,
      data: bird,
      message: '图片添加成功'
    });
  } catch (error) {
    console.error('添加图片失败 - 详细错误:', {
      message: error.message,
      stack: error.stack,
      birdId: req.params.id,
      userId: req.user ? req.user._id : '无用户信息',
      hasFile: !!req.file
    });
    
    res.status(500).json({
      success: false,
      message: '添加图片失败',
      error: error.message,
    });
  }
};

// @desc    检查鸟类是否重复
// @route   POST /api/birds/check-duplicate
// @access  Private
const checkDuplicate = async (req, res) => {
  try {
    const { name, scientificName, names } = req.body;
    
    // 支持单个名称和批量名称检查
    if (!name && !scientificName && !names) {
      return res.status(400).json({
        success: false,
        message: '请提供鸟类名称或学名',
      });
    }

    // 处理批量名称检查
    if (names && Array.isArray(names)) {
      const allDuplicates = {};
      
      for (const birdName of names) {
        if (birdName && birdName.trim()) {
          const query = { name: { $regex: birdName.trim(), $options: 'i' } };
          const similarBirds = await Bird.find(query)
            .select('name scientificName description habitat distribution category order family genus species')
            .populate('createdBy', 'name')
            .limit(5);

          if (similarBirds.length > 0) {
            allDuplicates[birdName] = similarBirds.map(bird => ({
              _id: bird._id,
              name: bird.name,
              scientificName: bird.scientificName,
              description: bird.description,
              habitat: bird.habitat,
              distribution: bird.distribution,
              category: bird.category,
              createdBy: bird.createdBy
            }));
          }
        }
      }

      return res.status(200).json({
        success: true,
        data: {
          duplicates: allDuplicates,
          totalChecked: names.length,
          foundDuplicates: Object.keys(allDuplicates).length
        }
      });
    }

    // 单个名称检查（保持向后兼容）
    const query = {};
    if (name) {
      query.name = { $regex: name.trim(), $options: 'i' };
    }
    if (scientificName) {
      query.scientificName = { $regex: scientificName.trim(), $options: 'i' };
    }

    // 查找相似的鸟类
    const similarBirds = await Bird.find(query)
      .select('name scientificName description habitat distribution category order family genus species')
      .populate('createdBy', 'name')
      .limit(10);

    // 计算相似度
    const results = similarBirds.map(bird => {
      let similarity = 0;
      let matchReasons = [];

      // 名称相似度检查
      if (name && bird.name) {
        const nameSimilarity = calculateSimilarity(name.toLowerCase(), bird.name.toLowerCase());
        if (nameSimilarity > 0.7) {
          similarity += nameSimilarity * 0.6;
          matchReasons.push(`名称相似度: ${Math.round(nameSimilarity * 100)}%`);
        }
      }

      // 学名相似度检查
      if (scientificName && bird.scientificName) {
        const scientificSimilarity = calculateSimilarity(scientificName.toLowerCase(), bird.scientificName.toLowerCase());
        if (scientificSimilarity > 0.8) {
          similarity += scientificSimilarity * 0.4;
          matchReasons.push(`学名相似度: ${Math.round(scientificSimilarity * 100)}%`);
        }
      }

      return {
        ...bird.toObject(),
        similarity: Math.round(similarity * 100),
        matchReasons
      };
    }).filter(bird => bird.similarity > 50).sort((a, b) => b.similarity - a.similarity);

    res.status(200).json({
      success: true,
      data: {
        hasDuplicates: results.length > 0,
        duplicates: results,
        totalFound: results.length
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '查重检查失败',
      error: error.message,
    });
  }
};

// 计算字符串相似度的函数
const calculateSimilarity = (str1, str2) => {
  const longer = str1.length > str2.length ? str1 : str2;
  const shorter = str1.length > str2.length ? str2 : str1;
  
  if (longer.length === 0) {
    return 1.0;
  }
  
  const distance = levenshteinDistance(longer, shorter);
  return (longer.length - distance) / longer.length;
};

// 计算编辑距离
const levenshteinDistance = (str1, str2) => {
  const matrix = [];
  
  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }
  
  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }
  
  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  
  return matrix[str2.length][str1.length];
};

// @desc    更新鸟类图片信息
// @route   PUT /api/birds/:id/images/:imageIndex
// @access  Private
const updateBirdImage = async (req, res) => {
  try {
    const bird = await Bird.findById(req.params.id);
    
    if (!bird) {
      return res.status(404).json({
        success: false,
        message: '未找到该鸟类记录',
      });
    }
    
    const imageIndex = parseInt(req.params.imageIndex);
    if (imageIndex < 0 || imageIndex >= bird.images.length) {
      return res.status(400).json({
        success: false,
        message: '无效的图片索引',
      });
    }
    
    // 更新图片信息
    bird.images[imageIndex] = {
      ...bird.images[imageIndex],
      caption: req.body.caption !== undefined ? req.body.caption : bird.images[imageIndex].caption,
      location: req.body.location !== undefined ? req.body.location : bird.images[imageIndex].location,
      date: req.body.date ? new Date(req.body.date) : bird.images[imageIndex].date,
      url: req.body.url || bird.images[imageIndex].url, // 确保URL字段存在
    };
    
    await bird.save();
    
    res.status(200).json({
      success: true,
      data: bird,
      message: '图片信息更新成功'
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: '更新图片信息失败',
      error: error.message,
    });
  }
};

// @desc    删除鸟类图片
// @route   DELETE /api/birds/:id/images/:imageIndex
// @access  Private
const deleteBirdImage = async (req, res) => {
  try {
    console.log('删除图片请求:', {
      birdId: req.params.id,
      imageIndex: req.params.imageIndex,
      userId: req.user ? req.user.id : '未认证'
    });

    const bird = await Bird.findById(req.params.id);
    
    if (!bird) {
      console.log('鸟类记录不存在:', req.params.id);
      return res.status(404).json({
        success: false,
        message: '未找到该鸟类记录',
      });
    }
    
    const imageIndex = parseInt(req.params.imageIndex);
    if (imageIndex < 0 || imageIndex >= bird.images.length) {
      console.log('无效的图片索引:', imageIndex, '图片总数:', bird.images.length);
      return res.status(400).json({
        success: false,
        message: '无效的图片索引',
      });
    }
    
    // 检查用户权限 - 只有图片的上传者或管理员可以删除
    const imageToDelete = bird.images[imageIndex];
    const userId = req.user.id;
    
    console.log('图片信息:', {
      photographer: imageToDelete.photographer,
      userId: userId,
      photographerString: imageToDelete.photographer ? imageToDelete.photographer.toString() : 'null'
    });
    
    if (imageToDelete.photographer && imageToDelete.photographer.toString() !== userId) {
      console.log('权限检查失败: 用户无权删除此图片');
      return res.status(403).json({
        success: false,
        message: '您没有权限删除此图片',
      });
    }
    
    // 删除图片
    bird.images.splice(imageIndex, 1);
    await bird.save();
    
    console.log('图片删除成功');
    res.status(200).json({
      success: true,
      data: bird,
      message: '图片删除成功'
    });
  } catch (error) {
    console.error('删除图片错误:', error);
    res.status(400).json({
      success: false,
      message: '删除图片失败',
      error: error.message,
    });
  }
};

// @desc    更新鸟类观察记录
// @route   PUT /api/birds/:id/sightings/:sightingIndex
// @access  Private
const updateBirdSighting = async (req, res) => {
  try {
    const bird = await Bird.findById(req.params.id);
    
    if (!bird) {
      return res.status(404).json({
        success: false,
        message: '未找到该鸟类记录',
      });
    }
    
    const sightingIndex = parseInt(req.params.sightingIndex);
    if (sightingIndex < 0 || sightingIndex >= bird.sightings.length) {
      return res.status(400).json({
        success: false,
        message: '无效的观察记录索引',
      });
    }
    
    // 更新观察记录
    bird.sightings[sightingIndex] = {
      ...bird.sightings[sightingIndex],
      location: {
        type: 'Point',
        coordinates: req.body.location.coordinates || bird.sightings[sightingIndex].location.coordinates,
        name: req.body.location.name || bird.sightings[sightingIndex].location.name
      },
      date: req.body.date ? new Date(req.body.date) : bird.sightings[sightingIndex].date,
      notes: req.body.notes || bird.sightings[sightingIndex].notes,
    };
    
    await bird.save();
    
    res.status(200).json({
      success: true,
      data: bird,
      message: '观察记录更新成功'
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: '更新观察记录失败',
      error: error.message,
    });
  }
};

// @desc    删除鸟类观察记录
// @route   DELETE /api/birds/:id/sightings/:sightingIndex
// @access  Private
const deleteBirdSighting = async (req, res) => {
  try {
    console.log('删除观察记录请求:', {
      birdId: req.params.id,
      sightingIndex: req.params.sightingIndex,
      userId: req.user ? req.user.id : '未认证'
    });

    const bird = await Bird.findById(req.params.id);
    
    if (!bird) {
      console.log('鸟类记录不存在:', req.params.id);
      return res.status(404).json({
        success: false,
        message: '未找到该鸟类记录',
      });
    }
    
    const sightingIndex = parseInt(req.params.sightingIndex);
    if (sightingIndex < 0 || sightingIndex >= bird.sightings.length) {
      console.log('无效的观察记录索引:', sightingIndex, '记录总数:', bird.sightings.length);
      return res.status(400).json({
        success: false,
        message: '无效的观察记录索引',
      });
    }
    
    // 检查用户权限 - 只有观察记录的创建者可以删除
    const sightingToDelete = bird.sightings[sightingIndex];
    const userId = req.user.id;
    
    console.log('观察记录信息:', {
      observer: sightingToDelete.observer,
      userId: userId,
      observerString: sightingToDelete.observer ? sightingToDelete.observer.toString() : 'null'
    });
    
    if (sightingToDelete.observer && sightingToDelete.observer.toString() !== userId) {
      console.log('权限检查失败: 用户无权删除此观察记录');
      return res.status(403).json({
        success: false,
        message: '您没有权限删除此观察记录',
      });
    }
    
    // 删除观察记录
    bird.sightings.splice(sightingIndex, 1);
    await bird.save();
    
    console.log('观察记录删除成功');
    res.status(200).json({
      success: true,
      data: bird,
      message: '观察记录删除成功'
    });
  } catch (error) {
    console.error('删除观察记录错误:', error);
    res.status(400).json({
      success: false,
      message: '删除观察记录失败',
      error: error.message,
    });
  }
};

// @desc    申请添加新鸟类
// @route   POST /api/birds/request-new
// @access  Private
const requestNewBird = async (req, res) => {
  try {
    const { name, scientificName, description, habitat, distribution, category, conservationStatus, chinaProtectionLevel } = req.body;

    // 验证必填字段
    if (!name) {
      return res.status(400).json({
        success: false,
        message: '鸟类名称不能为空'
      });
    }

    // 检查是否已存在相同名称的鸟类
    const existingBird = await Bird.findOne({ name: name });
    if (existingBird) {
      return res.status(400).json({
        success: false,
        message: '该鸟类已存在于数据库中'
      });
    }

    // 创建新鸟类申请记录
    const newBirdRequest = {
      name,
      scientificName: scientificName || '待确认',
      description: description || '用户申请添加的新鸟类',
      habitat: habitat || '待确认',
      distribution: distribution || '待确认',
      category: category || '待确认',
      conservationStatus: conservationStatus || '未评估',
      chinaProtectionLevel: chinaProtectionLevel || '未评估',
      status: 'pending', // pending, approved, rejected
      requestedBy: req.user._id,
      requestedAt: new Date(),
      isTemporary: true
    };

    // 这里可以保存到数据库或者发送通知给管理员
    // 为了简化，我们直接创建临时鸟类记录
    const newBird = new Bird(newBirdRequest);
    await newBird.save();

    res.status(201).json({
      success: true,
      message: '新鸟类申请已提交，等待管理员审核',
      data: {
        birdId: newBird._id,
        name: newBird.name,
        status: 'pending'
      }
    });

  } catch (error) {
    console.error('申请新鸟类失败:', error);
    res.status(500).json({
      success: false,
      message: '服务器错误',
      error: error.message
    });
  }
};

module.exports = {
  getBirds,
  getBirdById,
  createBird,
  updateBird,
  deleteBird,
  addBirdSighting,
  addBirdImage,
  updateBirdImage,
  deleteBirdImage,
  updateBirdSighting,
  deleteBirdSighting,
  checkDuplicate,
  requestNewBird
};