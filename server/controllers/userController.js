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
const { getJwtSecret } = require('../config/jwtSecret');
const { sendControllerError } = require('../middleware/controllerError');
const { devError, devLog } = require('../utils/devLogger');
const Record = require('../models/recordModel');
const PersonalChecklist = require('../models/personalChecklistModel');

const sendUserError = (res, error, message = '服务器错误') =>
  sendControllerError(res, error, {
    defaultMessage: message,
    defaultCode: 'USER_OPERATION_FAILED',
    fallbackStatus: 500,
  });

const sendUserClientError = (res, status, message, code) => {
  const error = new Error(message);
  error.statusCode = status;
  error.code = code;
  return sendControllerError(res, error, {
    defaultMessage: message,
    defaultCode: code,
    fallbackStatus: status,
  });
};

const {
  isRegistrationEnabled,
  isAutoLoginEnabled,
  getDefaultUsername,
  isLocalLoopbackRequest,
} = require('../config/appMode');

const registerUser = async (req, res) => {
  try {
    if (!isRegistrationEnabled()) {
      return sendUserClientError(
        res,
        403,
        '当前为单机自用模式，已关闭注册。请使用本机已有账号登录（默认可在个人设置中改密码）。',
        'REGISTRATION_DISABLED'
      );
    }

    const { name, email, password } = req.body;
    
    // 检查邮箱是否已存在
    const emailExists = await User.findOne({ email });
    if (emailExists) {
      return sendUserClientError(res, 400, '该邮箱已被注册', 'EMAIL_ALREADY_REGISTERED');
    }
    
    // 检查用户名是否已存在
    const nameExists = await User.findOne({ name });
    if (nameExists) {
      return sendUserClientError(res, 400, '该用户名已被使用', 'USERNAME_ALREADY_EXISTS');
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
    
    const token = jwt.sign({ id: user._id }, getJwtSecret(), {
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
    devError('用户注册失败:', error);
    return sendUserError(res, error, '服务器错误');
  }
};

// @desc    用户登录
// @route   POST /api/users/login
// @access  Public
const loginUser = async (req, res) => {
  try {
    const { password } = req.body;
    const usernameOrEmail = (
      req.body.usernameOrEmail ||
      req.body.username ||
      req.body.email ||
      req.body.identifier ||
      ''
    ).toString().trim();

    if (!usernameOrEmail || !password) {
      return sendUserClientError(res, 400, '请提供用户名/邮箱和密码', 'MISSING_LOGIN_CREDENTIALS');
    }
    
    // 判断是用户名还是邮箱
    const isEmail = usernameOrEmail.includes('@');
    const user = isEmail
      ? await User.findOne({ email: usernameOrEmail }).select('+password')
      : await User.findOne({ name: usernameOrEmail }).select('+password');
    
    if (!user) {
      // 统一错误文案，避免用户枚举；仍做一次假比较以近似等时
      await bcrypt.compare(password, '$2a$10$abcdefghijklmnopqrstuuABCDEFGHIJKLMNOPQRSTUVWXYZ012345');
      return sendUserClientError(res, 401, '用户名或密码错误', 'INVALID_CREDENTIALS');
    }

    // 历史数据兼容：若用户缺少密码哈希，避免 bcrypt 抛错导致 500
    if (!user.password || typeof user.password !== 'string') {
      return sendUserClientError(res, 401, '用户名或密码错误', 'INVALID_CREDENTIALS');
    }
    
    // 验证密码
    let isMatch = false;
    try {
      isMatch = await bcrypt.compare(password, user.password);
    } catch (compareError) {
      return sendUserClientError(res, 401, '用户名或密码错误', 'INVALID_CREDENTIALS');
    }
    if (!isMatch) {
      return sendUserClientError(res, 401, '用户名或密码错误', 'INVALID_CREDENTIALS');
    }
    
    const token = jwt.sign({ id: user._id }, getJwtSecret(), {
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
    devError('用户登录失败:', error);
    return sendUserError(res, error, '服务器错误');
  }
};

// @desc    本机自动登录（仅 SINGLE_USER_MODE + AUTO_LOGIN + 回环地址）
/** 单机自动登录：默认账号无数据时，落到实际持有记录/清单的账号 */
const resolveLocalSessionUser = async () => {
  const defaultName = getDefaultUsername();
  let user = await User.findOne({ name: defaultName });
  if (!user) {
    user = await User.findOne({ role: 'admin' }).sort({ createdAt: 1 });
  }
  if (!user) return null;

  const defaultRecordCount = await Record.countDocuments({ observer: user._id });
  const defaultChecklist = await PersonalChecklist.findOne({ userId: user._id })
    .select('observedBirds')
    .lean();
  const defaultChecklistCount = Array.isArray(defaultChecklist?.observedBirds)
    ? defaultChecklist.observedBirds.length
    : 0;
  if (defaultRecordCount > 0 || defaultChecklistCount > 0) {
    return user;
  }

  const [topObserver] = await Record.aggregate([
    { $group: { _id: '$observer', n: { $sum: 1 } } },
    { $sort: { n: -1 } },
    { $limit: 1 },
  ]);
  if (topObserver?._id) {
    const dataUser = await User.findById(topObserver._id);
    if (dataUser) {
      devLog('本机自动登录：默认账号无观察数据，改用持有记录的账号', {
        defaultUser: user.name,
        dataUser: dataUser.name,
        records: topObserver.n,
      });
      return dataUser;
    }
  }

  const [topChecklist] = await PersonalChecklist.aggregate([
    {
      $project: {
        userId: 1,
        n: { $size: { $ifNull: ['$observedBirds', []] } },
      },
    },
    { $match: { n: { $gt: 0 } } },
    { $sort: { n: -1 } },
    { $limit: 1 },
  ]);
  if (topChecklist?.userId) {
    const dataUser = await User.findById(topChecklist.userId);
    if (dataUser) {
      devLog('本机自动登录：默认账号无观察数据，改用持有清单的账号', {
        defaultUser: user.name,
        dataUser: dataUser.name,
        checklist: topChecklist.n,
      });
      return dataUser;
    }
  }

  return user;
};

// @route   POST /api/users/local-session
// @access  Localhost only
const createLocalSession = async (req, res) => {
  try {
    if (!isAutoLoginEnabled()) {
      return sendUserClientError(res, 403, '本机自动登录未开启', 'AUTO_LOGIN_DISABLED');
    }
    if (!isLocalLoopbackRequest(req)) {
      return sendUserClientError(res, 403, '仅允许本机访问自动登录', 'LOCAL_ONLY');
    }

    const user = await resolveLocalSessionUser();
    if (!user) {
      return sendUserClientError(
        res,
        404,
        '本机管理员尚未就绪，请确认后端已启动；也可在设置中修改默认账号密码',
        'NO_ADMIN'
      );
    }

    const token = jwt.sign({ id: user._id }, getJwtSecret(), {
      expiresIn: '30d',
    });

    res.status(200).json({
      success: true,
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        avatar: user.avatar,
      },
      message: '本机自动登录成功',
    });
  } catch (error) {
    devError('本机自动登录失败:', error);
    return sendUserError(res, error, '服务器错误');
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
      return sendUserClientError(res, 404, '未找到用户', 'USER_NOT_FOUND');
    }
    
    res.status(200).json({
      success: true,
      data: {
        id: user._id,
        _id: user._id, // 保持向后兼容
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
    devError('获取用户资料失败:', error);
    return sendUserError(res, error, '服务器错误');
  }
};

// @desc    更新用户个人资料
// @route   PUT /api/users/profile
// @access  Private
const updateUserProfile = async (req, res) => {
  try {
    // 修改密码时需要带出 password 字段
    const needPassword = !!req.body.password;
    const user = await User.findById(req.user._id).select(needPassword ? '+password' : '');
    
    if (!user) {
      return sendUserClientError(res, 404, '未找到用户', 'USER_NOT_FOUND');
    }
    
    user.name = req.body.name || user.name;
    user.email = req.body.email || user.email;
    user.bio = req.body.bio !== undefined ? req.body.bio : user.bio;
    user.location = req.body.location !== undefined ? req.body.location : user.location;
    user.website = req.body.website !== undefined ? req.body.website : user.website;
    
    if (req.body.password) {
      const currentPassword = req.body.currentPassword;
      if (!currentPassword) {
        return sendUserClientError(res, 400, '请提供当前密码', 'MISSING_CURRENT_PASSWORD');
      }
      const isMatch = await bcrypt.compare(currentPassword, user.password);
      if (!isMatch) {
        return sendUserClientError(res, 400, '当前密码错误', 'INVALID_CURRENT_PASSWORD');
      }
      if (req.body.password.length < 6 || req.body.password.length > 128) {
        return sendUserClientError(res, 400, '新密码长度必须在6-128字符之间', 'PASSWORD_TOO_SHORT');
      }
      if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(req.body.password)) {
        return sendUserClientError(
          res,
          400,
          '新密码必须包含至少一个小写字母、一个大写字母和一个数字',
          'PASSWORD_TOO_WEAK'
        );
      }
      const salt = await bcrypt.genSalt(10);
      user.password = await bcrypt.hash(req.body.password, salt);
    }
    
    const updatedUser = await user.save();
    
    res.status(200).json({
      success: true,
      data: {
        id: updatedUser._id,
        _id: updatedUser._id, // 保持向后兼容
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
    devError('更新用户资料失败:', error);
    return sendUserError(res, error, '服务器错误');
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
      return sendUserClientError(res, 404, '未找到用户', 'USER_NOT_FOUND');
    }
    
    res.status(200).json({
      success: true,
      count: user.contributions.length,
      data: user.contributions,
    });
  } catch (error) {
    devError('获取用户贡献失败:', error);
    return sendUserError(res, error, '服务器错误');
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
      return sendUserClientError(res, 404, '未找到用户', 'USER_NOT_FOUND');
    }
    
    res.status(200).json({
      success: true,
      count: user.favorites.length,
      data: user.favorites,
    });
  } catch (error) {
    devError('获取用户收藏失败:', error);
    return sendUserError(res, error, '服务器错误');
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
      return sendUserClientError(res, 404, '未找到用户', 'USER_NOT_FOUND');
    }
    
    // 检查是否已经收藏
    if (user.favorites.includes(birdId)) {
      return sendUserClientError(res, 400, '已经收藏过该鸟类', 'BIRD_ALREADY_FAVORITED');
    }
    
    user.favorites.push(birdId);
    await user.save();
    
    res.status(200).json({
      success: true,
      message: '成功添加到收藏',
      data: user.favorites,
    });
  } catch (error) {
    devError('添加收藏失败:', error);
    return sendUserError(res, error, '服务器错误');
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
    devError('获取用户观鸟记录失败:', error);
    return sendUserError(res, error, '服务器错误');
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
      return sendUserClientError(res, 404, '未找到用户', 'USER_NOT_FOUND');
    }
    
    // 检查是否已经收藏
    if (!user.favorites.includes(birdId)) {
      return sendUserClientError(res, 400, '未收藏该鸟类', 'BIRD_NOT_FAVORITED');
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
    devError('移除收藏失败:', error);
    return sendUserError(res, error, '服务器错误');
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
    devLog('头像上传请求:', {
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
      return sendUserClientError(res, 404, '未找到用户', 'USER_NOT_FOUND');
    }
    
    // 处理文件上传
    if (req.file) {
      const fs = require('fs');
      const path = require('path');
      const AVATAR_MIME_EXT = {
        'image/jpeg': '.jpg',
        'image/jpg': '.jpg',
        'image/png': '.png',
        'image/gif': '.gif',
        'image/webp': '.webp',
      };
      const ext = AVATAR_MIME_EXT[req.file.mimetype];
      if (!ext) {
        return sendUserClientError(res, 400, '仅支持 JPG/PNG/GIF/WebP 头像', 'INVALID_AVATAR_TYPE');
      }

      // 禁止使用 originalname，避免路径穿越与编码污染
      const fileName = `user_${user._id}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}${ext}`;
      const filePath = `/images/avatars/${fileName}`;
      const uploadRoot = path.resolve(process.cwd(), 'public', 'images', 'avatars');

      if (!fs.existsSync(uploadRoot)) {
        fs.mkdirSync(uploadRoot, { recursive: true });
      }

      const fullPath = path.resolve(uploadRoot, fileName);
      if (!fullPath.startsWith(`${uploadRoot}${path.sep}`)) {
        return sendUserClientError(res, 400, '非法头像路径', 'INVALID_AVATAR_PATH');
      }
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
      return sendUserClientError(res, 400, '请提供头像文件', 'MISSING_AVATAR_FILE');
    }
  } catch (error) {
    devError('头像上传失败:', error);
    return sendUserError(res, error, '头像上传失败');
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

    devLog('用户观鸟记录查询结果:');
    devLog('- 总记录数:', userSightings.length);
    devLog('- 已通过:', userSightings.filter(s => s.status === 'approved').length);
    devLog('- 待审核:', userSightings.filter(s => s.status === 'pending').length);
    devLog('- 已拒绝:', userSightings.filter(s => s.status === 'rejected').length);

    res.status(200).json({
      success: true,
      data: userSightings
    });

  } catch (error) {
    devLog('获取用户待审核观鸟记录失败:', error);
    return sendUserError(res, error, '服务器错误');
  }
};

module.exports = {
  registerUser,
  loginUser,
  createLocalSession,
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