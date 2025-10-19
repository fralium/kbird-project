const { body, param, query, validationResult } = require('express-validator');

// 通用验证结果处理中间件
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: '输入验证失败',
      errors: errors.array().map(error => ({
        field: error.param,
        message: error.msg,
        value: error.value
      }))
    });
  }
  next();
};

// 鸟类数据验证规则
const validateBird = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('鸟类名称不能为空')
    .isLength({ min: 1, max: 100 })
    .withMessage('鸟类名称长度必须在1-100字符之间')
    .matches(/^[\u4e00-\u9fa5a-zA-Z\s\-\.]+$/)
    .withMessage('鸟类名称只能包含中文、英文、空格、连字符和点号'),
  
  body('scientificName')
    .trim()
    .notEmpty()
    .withMessage('学名不能为空')
    .isLength({ min: 1, max: 200 })
    .withMessage('学名长度必须在1-200字符之间')
    .matches(/^[A-Za-z\s\-\.]+$/)
    .withMessage('学名只能包含英文字母、空格、连字符和点号'),
  
  body('description')
    .optional()
    .trim()
    .isLength({ max: 2000 })
    .withMessage('描述长度不能超过2000字符'),
  
  body('habitat')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('栖息地描述长度不能超过500字符'),
  
  body('distribution')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('分布区域描述长度不能超过500字符'),
  
  body('category')
    .trim()
    .notEmpty()
    .withMessage('分类信息不能为空')
    .isLength({ max: 200 })
    .withMessage('分类信息长度不能超过200字符'),
  
  body('conservationStatus')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('保护状态长度不能超过100字符'),
  
  body('tags')
    .optional()
    .isArray()
    .withMessage('标签必须是数组格式'),
  
  body('tags.*')
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage('每个标签长度不能超过50字符'),
  
  handleValidationErrors
];

// 用户注册验证规则
const validateUserRegistration = [
  body('username')
    .trim()
    .notEmpty()
    .withMessage('用户名不能为空')
    .isLength({ min: 3, max: 20 })
    .withMessage('用户名长度必须在3-20字符之间')
    .matches(/^[a-zA-Z0-9_]+$/)
    .withMessage('用户名只能包含字母、数字和下划线'),
  
  body('email')
    .trim()
    .notEmpty()
    .withMessage('邮箱不能为空')
    .isEmail()
    .withMessage('请输入有效的邮箱地址')
    .normalizeEmail(),
  
  body('password')
    .trim()
    .notEmpty()
    .withMessage('密码不能为空')
    .isLength({ min: 6, max: 128 })
    .withMessage('密码长度必须在6-128字符之间')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('密码必须包含至少一个小写字母、一个大写字母和一个数字'),
  
  handleValidationErrors
];

// 用户登录验证规则
const validateUserLogin = [
  body('email')
    .trim()
    .notEmpty()
    .withMessage('邮箱不能为空')
    .isEmail()
    .withMessage('请输入有效的邮箱地址')
    .normalizeEmail(),
  
  body('password')
    .trim()
    .notEmpty()
    .withMessage('密码不能为空'),
  
  handleValidationErrors
];

// 观鸟记录验证规则
const validateSighting = [
  body('location.name')
    .trim()
    .notEmpty()
    .withMessage('地点名称不能为空')
    .isLength({ max: 200 })
    .withMessage('地点名称长度不能超过200字符'),
  
  body('location.coordinates')
    .isArray({ min: 2, max: 2 })
    .withMessage('坐标必须是包含2个数字的数组'),
  
  body('location.coordinates.*')
    .isNumeric()
    .withMessage('坐标必须是数字')
    .isFloat({ min: -180, max: 180 })
    .withMessage('经度必须在-180到180之间')
    .isFloat({ min: -90, max: 90 })
    .withMessage('纬度必须在-90到90之间'),
  
  body('date')
    .optional()
    .isISO8601()
    .withMessage('日期格式无效'),
  
  body('notes')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('观察记录长度不能超过1000字符'),
  
  body('weather')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('天气信息长度不能超过100字符'),
  
  body('behavior')
    .optional()
    .trim()
    .isLength({ max: 200 })
    .withMessage('行为描述长度不能超过200字符'),
  
  handleValidationErrors
];

// ID参数验证
const validateObjectId = [
  param('id')
    .isMongoId()
    .withMessage('无效的ID格式'),
  
  handleValidationErrors
];

// 分页查询验证
const validatePagination = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('页码必须是大于0的整数'),
  
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('每页数量必须在1-100之间'),
  
  query('search')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('搜索关键词长度不能超过100字符'),
  
  handleValidationErrors
];

module.exports = {
  validateBird,
  validateUserRegistration,
  validateUserLogin,
  validateSighting,
  validateObjectId,
  validatePagination,
  handleValidationErrors
};





