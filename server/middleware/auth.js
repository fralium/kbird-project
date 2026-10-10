const jwt = require('jsonwebtoken');
const User = require('../models/userModel');
const { getJwtSecret } = require('../config/jwtSecret');
const { devLog, devError } = require('../utils/devLogger');

// 保护路由中间件
const protect = async (req, res, next) => {
  let token;

  // 只在开发环境输出调试信息（不记录 token 内容）
  devLog('认证中间件 - 请求头:', req.headers.authorization ? '已提供' : '未提供');

  // 从请求头中获取token
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      // 获取token
      token = req.headers.authorization.split(' ')[1];

      // 验证token
      const decoded = jwt.verify(token, getJwtSecret(), { algorithms: ['HS256'] });

      // 获取用户信息（不包含密码）
      req.user = await User.findById(decoded.id).select('-password');

      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: '用户不存在，token无效'
        });
      }

      next();
    } catch (error) {
      // 只在开发环境输出详细错误信息
      devError('JWT验证错误:', error.message);
      
      return res.status(401).json({
        success: false,
        message: '未授权访问，token无效'
      });
    }
  }

  if (!token) {
    return res.status(401).json({
      success: false,
      message: '未授权访问，请提供token'
    });
  }
};

/** 有 token 则解析用户；无 token / 无效则继续匿名访问 */
const optionalAuth = async (req, res, next) => {
  try {
    const header = req.headers.authorization;
    if (header && header.startsWith('Bearer')) {
      const token = header.split(' ')[1];
      const decoded = jwt.verify(token, getJwtSecret(), { algorithms: ['HS256'] });
      req.user = await User.findById(decoded.id).select('-password');
    }
  } catch (error) {
    // 忽略无效 token，按未登录处理
  }
  next();
};

// 角色授权中间件
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: '用户未认证'
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: '无权访问此资源'
      });
    }

    next();
  };
};

module.exports = { protect, optionalAuth, authorize };

