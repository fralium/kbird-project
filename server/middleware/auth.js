const jwt = require('jsonwebtoken');
const User = require('../models/userModel');

// 检查是否为开发环境
const isDevelopment = process.env.NODE_ENV === 'development';

// 保护路由中间件
const protect = async (req, res, next) => {
  let token;

  // 只在开发环境输出调试信息
  if (isDevelopment) {
    console.log('认证中间件 - 请求头:', req.headers.authorization ? '已提供' : '未提供');
    console.log('JWT_SECRET:', process.env.JWT_SECRET ? '已设置' : '未设置');
  }

  // 从请求头中获取token
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      // 获取token
      token = req.headers.authorization.split(' ')[1];
      
      // 只在开发环境输出token信息
      if (isDevelopment) {
        console.log('提取的token:', token.substring(0, 20) + '...');
      }

      // 验证token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

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
      if (isDevelopment) {
        console.error('JWT验证错误:', error.message);
      }
      
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
        message: `用户角色 ${req.user.role} 无权访问此资源`
      });
    }

    next();
  };
};

module.exports = { protect, authorize };

