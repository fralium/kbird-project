const User = require('../models/userModel');
const Bird = require('../models/birdModel');
// 在实际项目中，需要添加bcrypt和jsonwebtoken包用于密码加密和生成token
// const bcrypt = require('bcryptjs');
// const jwt = require('jsonwebtoken');

// @desc    注册新用户
// @route   POST /api/users/register
// @access  Public
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const registerUser = async (req, res) => {
  try {
    const { name, email, password } = req.body;
    
    // 检查邮箱是否已存在
    const emailExists = await User.findOne({ email });
    if (emailExists) {
      return res.status(400).json({
        success: false,
        message: '该邮箱已被注册',
      });
    }
    
    // 检查用户名是否已存在
    const nameExists = await User.findOne({ name });
    if (nameExists) {
      return res.status(400).json({
        success: false,
        message: '该用户名已被使用',
      });
    }
    
    // 加密密码
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    
    // 创建用户
    const user = await User.create({
      name,
      email,
      password: hashedPassword,
      role: 'user', // 默认角色
      avatar: 'default-avatar.jpg' // 默认头像
    });
    
    const jwtSecret = process.env.JWT_SECRET || 'your_super_secret_jwt_key_here_change_in_production';
    
    // 生成JWT令牌
    const token = jwt.sign({ id: user._id }, jwtSecret, {
      expiresIn: '30d'
    });
    
    res.set('Content-Type', 'application/json');
    res.status(201).json({
      success: true,
      token,
      data: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        avatar: user.avatar,
      },
      message: '用户注册成功'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '服务器错误',
      error: error.message,
    });
  }
};

// @desc    用户登录
// @route   POST /api/users/login
// @access  Public
const loginUser = async (req, res) => {
  try {
    const { usernameOrEmail, password } = req.body;
    
    // 判断是用户名还是邮箱
    const isEmail = usernameOrEmail.includes('@');
    const user = isEmail
      ? await User.findOne({ email: usernameOrEmail }).select('+password')
      : await User.findOne({ name: usernameOrEmail }).select('+password');
    
    if (!user) {
      return res.status(401).json({
        success: false,
        message: isEmail ? '邮箱未注册' : '用户名不存在',
      });
    }
    
    // 验证密码
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: '密码错误',
      });
    }
    
    const jwtSecret = process.env.JWT_SECRET || 'your_super_secret_jwt_key_here_change_in_production';
    
    // 生成JWT令牌
    const token = jwt.sign({ id: user._id }, jwtSecret, {
      expiresIn: '30d'
    });
    
    res.status(200).json({
      success: true,
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        avatar: user.avatar
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '服务器错误',
      error: error.message,
    });
  }
};

// @desc    获取用户个人资料
// @route   GET /api/users/profile
// @access  Private
const getUserProfile = async (req, res) => {
  try {
    // 从认证中间件中获取用户ID
    const user = await User.findById(req.user._id);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: '未找到用户',
      });
    }
    
    res.status(200).json({
      success: true,
      data: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        avatar: user.avatar,
        bio: user.bio,
        location: user.location,
        website: user.website,
        createdAt: user.createdAt,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '服务器错误',
      error: error.message,
    });
  }
};

// @desc    更新用户个人资料
// @route   PUT /api/users/profile
// @access  Private
const updateUserProfile = async (req, res) => {
  try {
    // 从认证中间件中获取用户ID
    const user = await User.findById(req.user._id);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: '未找到用户',
      });
    }
    
    user.name = req.body.name || user.name;
    user.email = req.body.email || user.email;
    user.bio = req.body.bio || user.bio;
    user.location = req.body.location || user.location;
    user.website = req.body.website || user.website;
    
    if (req.body.password) {
      // 加密新密码
      const salt = await bcrypt.genSalt(10);
      user.password = await bcrypt.hash(req.body.password, salt);
    }
    
    const updatedUser = await user.save();
    
    res.status(200).json({
      success: true,
      data: {
        _id: updatedUser._id,
        name: updatedUser.name,
        email: updatedUser.email,
        role: updatedUser.role,
        avatar: updatedUser.avatar,
        bio: updatedUser.bio,
        location: updatedUser.location,
        website: updatedUser.website,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '服务器错误',
      error: error.message,
    });
  }
};

// @desc    获取用户贡献的鸟类记录
// @route   GET /api/users/contributions
// @access  Private
const getUserContributions = async (req, res) => {
  try {
    // 从认证中间件中获取用户ID
    const userId = req.user._id;
    
    const user = await User.findById(userId).populate('contributions');
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: '未找到用户',
      });
    }
    
    res.status(200).json({
      success: true,
      count: user.contributions.length,
      data: user.contributions,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '服务器错误',
      error: error.message,
    });
  }
};

// @desc    获取用户收藏的鸟类
// @route   GET /api/users/favorites
// @access  Private
const getUserFavorites = async (req, res) => {
  try {
    // 从认证中间件中获取用户ID
    const userId = req.user._id;
    
    const user = await User.findById(userId).populate('favorites');
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: '未找到用户',
      });
    }
    
    res.status(200).json({
      success: true,
      count: user.favorites.length,
      data: user.favorites,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '服务器错误',
      error: error.message,
    });
  }
};

// @desc    添加鸟类到收藏
// @route   POST /api/users/favorites/:id
// @access  Private
const addToFavorites = async (req, res) => {
  try {
    // 从认证中间件中获取用户ID
    const userId = req.user._id;
    const birdId = req.params.id;
    
    const user = await User.findById(userId);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: '未找到用户',
      });
    }
    
    // 检查是否已经收藏
    if (user.favorites.includes(birdId)) {
      return res.status(400).json({
        success: false,
        message: '已经收藏过该鸟类',
      });
    }
    
    user.favorites.push(birdId);
    await user.save();
    
    res.status(200).json({
      success: true,
      message: '成功添加到收藏',
      data: user.favorites,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '服务器错误',
      error: error.message,
    });
  }
};

// @desc    获取当前用户的观察记录
// @route   GET /api/users/sightings
// @access  Private
const getUserSightings = async (req, res) => {
  try {
    const userId = req.user._id;
    
    // 查询所有包含该用户观察记录的鸟类（包括所有状态）
    const birds = await Bird.find({ 'sightings.observer': userId })
      .populate('sightings.observer', 'name avatar')
      .populate('sightings.reviewedBy', 'name email')
      .select('name scientificName images sightings');

    const userSightings = [];
    birds.forEach(bird => {
      bird.sightings.forEach(sighting => {
        if (sighting.observer._id.toString() === userId.toString()) {
          userSightings.push({
            _id: sighting._id,
            bird: {
              _id: bird._id,
              name: bird.name,
              scientificName: bird.scientificName,
              images: bird.images
            },
            location: sighting.location,
            date: sighting.date,
            observer: sighting.observer,
            notes: sighting.notes,
            weather: sighting.weather,
            behavior: sighting.behavior,
            images: sighting.images,
            status: sighting.status || 'approved', // 默认为已批准（兼容旧数据）
            submittedAt: sighting.submittedAt,
            reviewedBy: sighting.reviewedBy,
            reviewedAt: sighting.reviewedAt,
            reviewNotes: sighting.reviewNotes
          });
        }
      });
    });

    // 按日期排序
    userSightings.sort((a, b) => new Date(b.date) - new Date(a.date));

    res.status(200).json({
      success: true,
      count: userSightings.length,
      data: userSightings,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '服务器错误',
      error: error.message,
    });
  }
};

// @desc    从收藏中移除鸟类
// @route   DELETE /api/users/favorites/:id
// @access  Private
const removeFromFavorites = async (req, res) => {
  try {
    // 从认证中间件中获取用户ID
    const userId = req.user._id;
    const birdId = req.params.id;
    
    const user = await User.findById(userId);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: '未找到用户',
      });
    }
    
    // 检查是否已经收藏
    if (!user.favorites.includes(birdId)) {
      return res.status(400).json({
        success: false,
        message: '未收藏该鸟类',
      });
    }
    
    user.favorites = user.favorites.filter(
      (favorite) => favorite.toString() !== birdId
    );
    await user.save();
    
    res.status(200).json({
      success: true,
      message: '成功从收藏中移除',
      data: user.favorites,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '服务器错误',
      error: error.message,
    });
  }
};

// 生成JWT Token (在实际项目中使用)
// const generateToken = (id) => {
//   return jwt.sign({ id }, jwtSecret, {
//     expiresIn: '30d',
//   });
// };

// @desc    上传用户头像
// @route   POST /api/users/avatar
// @access  Private
const uploadAvatar = async (req, res) => {
  try {
    console.log('头像上传请求:', {
      user: req.user ? req.user._id : '无用户信息',
      hasFile: !!req.file,
      fileInfo: req.file ? {
        originalname: req.file.originalname,
        mimetype: req.file.mimetype,
        size: req.file.size
      } : '无文件',
      contentType: req.headers['content-type']
    });

    const user = await User.findById(req.user._id);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: '未找到用户',
      });
    }
    
    // 处理文件上传
    if (req.file) {
      // 生成文件名
      const fileName = `user_${user._id}_${Date.now()}_${req.file.originalname}`;
      const filePath = `/images/avatars/${fileName}`;
      
      // 保存文件到public目录
      const fs = require('fs');
      const path = require('path');
      const uploadDir = path.join(process.cwd(), 'public/images/avatars');
      
      // 确保目录存在
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }
      
      const fullPath = path.join(uploadDir, fileName);
      fs.writeFileSync(fullPath, req.file.buffer);
      
      // 更新用户头像
      user.avatar = fileName;
      await user.save();
      
      res.status(200).json({
        success: true,
        data: {
          avatar: fileName,
          avatarUrl: filePath
        },
        message: '头像上传成功'
      });
    } else {
      return res.status(400).json({
        success: false,
        message: '请提供头像文件',
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '头像上传失败',
      error: error.message,
    });
  }
};

// @desc    获取用户的所有观鸟记录（包含所有状态）
// @route   GET /api/users/pending-sightings
// @access  Private
const getPendingSightings = async (req, res) => {
  try {
    // 查询该用户的所有观鸟记录（包括所有状态）
    const birdsWithPendingSightings = await Bird.find({
      'sightings.observer': req.user._id
    })
    .populate('sightings.observer', 'name email')
    .populate('sightings.reviewedBy', 'name email')
    .select('name scientificName sightings');

    // 提取该用户的观鸟记录
    const userSightings = [];
    birdsWithPendingSightings.forEach(bird => {
      bird.sightings.forEach((sighting) => {
        if (sighting.observer._id.toString() === req.user._id.toString()) {
          userSightings.push({
            _id: sighting._id,
            bird: {
              _id: bird._id,
              name: bird.name,
              scientificName: bird.scientificName
            },
            location: sighting.location,
            date: sighting.date,
            notes: sighting.notes,
            weather: sighting.weather,
            behavior: sighting.behavior,
            images: sighting.images,
            status: sighting.status || 'approved', // 旧数据默认为已批准
            submittedAt: sighting.submittedAt || sighting.date, // 如果没有提交时间，使用观察时间
            reviewedBy: sighting.reviewedBy,
            reviewedAt: sighting.reviewedAt,
            reviewNotes: sighting.reviewNotes
          });
        }
      });
    });

    // 按提交时间排序
    userSightings.sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt));

    console.log('用户观鸟记录查询结果:');
    console.log('- 总记录数:', userSightings.length);
    console.log('- 已通过:', userSightings.filter(s => s.status === 'approved').length);
    console.log('- 待审核:', userSightings.filter(s => s.status === 'pending').length);
    console.log('- 已拒绝:', userSightings.filter(s => s.status === 'rejected').length);

    res.status(200).json({
      success: true,
      data: userSightings
    });

  } catch (error) {
    console.error('获取用户待审核观鸟记录失败:', error);
    res.status(500).json({
      success: false,
      message: '服务器错误',
      error: error.message
    });
  }
};

module.exports = {
  registerUser,
  loginUser,
  getUserProfile,
  updateUserProfile,
  getUserContributions,
  getUserFavorites,
  getUserSightings,
  addToFavorites,
  removeFromFavorites,
  uploadAvatar,
  getPendingSightings,
};