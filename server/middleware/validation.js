const { body, param, query, validationResult } = require('express-validator');

// 通用验证结果处理中间件
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: '输入验证失败',
      errors: errors.array().map(error => ({
        field: error.path || error.param,
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
  body('name')
    .optional({ values: 'falsy' })
    .trim()
    .isLength({ min: 2, max: 30 })
    .withMessage('用户名长度必须在2-30字符之间'),

  body('username')
    .optional({ values: 'falsy' })
    .trim()
    .isLength({ min: 2, max: 30 })
    .withMessage('用户名长度必须在2-30字符之间'),

  body()
    .custom((value) => {
      const username = value?.username;
      const name = value?.name;
      if (!username && !name) {
        throw new Error('用户名不能为空');
      }
      return true;
    }),
  
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
  body()
    .custom((value) => {
      const identifier =
        value?.usernameOrEmail ||
        value?.username ||
        value?.email ||
        value?.identifier;
      if (!identifier || !String(identifier).trim()) {
        throw new Error('请提供用户名或邮箱');
      }
      return true;
    }),
  
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
  
  body('location.coordinates')
    .custom((coordinates) => {
      if (!Array.isArray(coordinates) || coordinates.length !== 2) {
        throw new Error('坐标必须是 [经度, 纬度]');
      }
      const [lngRaw, latRaw] = coordinates;
      const lng = Number(lngRaw);
      const lat = Number(latRaw);
      if (!Number.isFinite(lng) || !Number.isFinite(lat)) {
        throw new Error('坐标必须是数字');
      }
      if (lng < -180 || lng > 180) {
        throw new Error('经度必须在-180到180之间');
      }
      if (lat < -90 || lat > 90) {
        throw new Error('纬度必须在-90到90之间');
      }
      return true;
    }),
  
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

const validateObjectIdParam = (paramName = 'id') => [
  param(paramName)
    .isMongoId()
    .withMessage(`无效的${paramName}格式`),
  handleValidationErrors,
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

const validateRecordPayload = [
  body('location.name')
    .trim()
    .notEmpty()
    .withMessage('地点名称不能为空')
    .isLength({ max: 200 })
    .withMessage('地点名称长度不能超过200字符'),
  body('date')
    .notEmpty()
    .withMessage('日期不能为空')
    .isISO8601()
    .withMessage('日期格式无效'),
  body('birds')
    .isArray({ min: 1 })
    .withMessage('至少需要一条鸟类记录'),
  body('birds.*.birdId')
    .notEmpty()
    .withMessage('birdId不能为空')
    .isMongoId()
    .withMessage('birdId格式无效'),
  body('birds.*.count')
    .optional()
    .isInt({ min: 1, max: 100000 })
    .withMessage('鸟类数量必须是1-100000的整数'),
  body('title')
    .optional()
    .trim()
    .isLength({ max: 300 })
    .withMessage('标题长度不能超过300字符'),
  body('notes')
    .optional()
    .trim()
    .isLength({ max: 5000 })
    .withMessage('备注长度不能超过5000字符'),
  handleValidationErrors,
];

const validateLocationPayload = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('地点名称不能为空')
    .isLength({ max: 200 })
    .withMessage('地点名称长度不能超过200字符'),
  body('coordinates')
    .optional()
    .custom((coordinates) => {
      if (coordinates == null) return true;
      const raw = coordinates?.coordinates ?? coordinates;
      if (!Array.isArray(raw) || raw.length < 2) {
        throw new Error('coordinates 必须是 [经度, 纬度]');
      }
      const lng = Number(raw[0]);
      const lat = Number(raw[1]);
      if (!Number.isFinite(lng) || !Number.isFinite(lat)) {
        throw new Error('coordinates 里的经纬度必须是数字');
      }
      return true;
    }),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 4000 })
    .withMessage('地点描述长度不能超过4000字符'),
  handleValidationErrors,
];

const validateSearchQuery = [
  query('q')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('搜索关键词长度不能超过100字符'),
  handleValidationErrors,
];

const validateHotSearchQuery = [
  query('limit')
    .optional()
    .isInt({ min: 1, max: 20 })
    .withMessage('limit 必须是 1-20 的整数'),
  handleValidationErrors,
];

const validateReportPayload = [
  body('title')
    .trim()
    .notEmpty()
    .withMessage('标题不能为空')
    .isLength({ max: 200 })
    .withMessage('标题长度不能超过200字符'),
  body('type')
    .trim()
    .notEmpty()
    .withMessage('类型不能为空')
    .isLength({ max: 50 })
    .withMessage('类型长度不能超过50字符'),
  body('content')
    .trim()
    .notEmpty()
    .withMessage('内容不能为空')
    .isLength({ max: 10000 })
    .withMessage('内容长度不能超过10000字符'),
  body('priority')
    .optional()
    .isIn(['low', 'medium', 'high', 'urgent'])
    .withMessage('priority 必须是 low/medium/high/urgent 之一'),
  handleValidationErrors,
];

const validateReportStatusPayload = [
  body('status')
    .trim()
    .notEmpty()
    .withMessage('状态不能为空')
    .isIn(['pending', 'in_progress', 'resolved', 'rejected'])
    .withMessage('状态值无效'),
  body('adminResponse')
    .optional()
    .trim()
    .isLength({ max: 5000 })
    .withMessage('管理员回复长度不能超过5000字符'),
  handleValidationErrors,
];

const validateYearMonthParams = [
  param('year')
    .optional()
    .isInt({ min: 1900, max: 2100 })
    .withMessage('year 必须是有效年份'),
  param('month')
    .optional()
    .isInt({ min: 1, max: 12 })
    .withMessage('month 必须是 1-12 的整数'),
  handleValidationErrors,
];

const validateDateRangeQuery = [
  query('startDate')
    .optional()
    .isISO8601()
    .withMessage('startDate 格式无效'),
  query('endDate')
    .optional()
    .isISO8601()
    .withMessage('endDate 格式无效'),
  handleValidationErrors,
];

const validateGoalCompletionParams = [
  param('type')
    .isIn(['bird', 'location'])
    .withMessage('type 必须是 bird 或 location'),
  param('id')
    .trim()
    .notEmpty()
    .withMessage('id 不能为空'),
  handleValidationErrors,
];

const validatePersonalStatsQuery = [
  query('year')
    .optional()
    .isInt({ min: 1900, max: 2100 })
    .withMessage('year 必须是有效年份'),
  query('month')
    .optional()
    .matches(/^\d{4}-\d{2}$/)
    .withMessage('month 格式应为 YYYY-MM'),
  handleValidationErrors,
];

const validateUserSettingsPayload = [
  body('theme')
    .optional()
    .isString()
    .isLength({ max: 50 })
    .withMessage('theme 长度不能超过50字符'),
  body('uiStyle')
    .optional()
    .isIn(['wetland', 'forest', 'ink'])
    .withMessage('uiStyle 必须是 wetland / forest / ink'),
  body('language')
    .optional()
    .isString()
    .isLength({ max: 20 })
    .withMessage('language 长度不能超过20字符'),
  body('dateFormat')
    .optional()
    .isString()
    .isLength({ max: 30 })
    .withMessage('dateFormat 长度不能超过30字符'),
  body('units')
    .optional()
    .isObject()
    .withMessage('units 必须是对象'),
  body('notifications')
    .optional()
    .isObject()
    .withMessage('notifications 必须是对象'),
  body('display')
    .optional()
    .isObject()
    .withMessage('display 必须是对象'),
  body('privacy')
    .optional()
    .isObject()
    .withMessage('privacy 必须是对象'),
  body('localBirdPhotoRoot')
    .optional()
    .isString()
    .isLength({ max: 500 })
    .withMessage('本机照片文件夹路径过长'),
  handleValidationErrors,
];

const validateImportPayload = [
  body('format')
    .optional()
    .isIn(['json', 'csv'])
    .withMessage('format 仅支持 json 或 csv'),
  body()
    .custom((value) => {
      const hasContent = typeof value?.content === 'string' && value.content.trim().length > 0;
      const hasRecords = Array.isArray(value?.records);
      const hasRows = Array.isArray(value?.rows) && value.rows.length > 0;
      if (!hasContent && !hasRecords && !hasRows) {
        throw new Error('请提供 content、records 或 rows');
      }
      return true;
    }),
  handleValidationErrors,
];

const validateNearbyLocationsQuery = [
  query('lat')
    .notEmpty()
    .withMessage('lat 不能为空')
    .isFloat({ min: -90, max: 90 })
    .withMessage('lat 必须在 -90 到 90 之间'),
  query('lng')
    .notEmpty()
    .withMessage('lng 不能为空')
    .isFloat({ min: -180, max: 180 })
    .withMessage('lng 必须在 -180 到 180 之间'),
  query('radius')
    .optional()
    .isFloat({ min: 0.1, max: 500 })
    .withMessage('radius 必须在 0.1 到 500 之间'),
  handleValidationErrors,
];

const validateLocationByNameQuery = [
  query('name')
    .trim()
    .notEmpty()
    .withMessage('name 不能为空')
    .isLength({ max: 200 })
    .withMessage('name 长度不能超过200字符'),
  handleValidationErrors,
];

const validateGoalsPayload = [
  body('year')
    .optional()
    .isObject()
    .withMessage('year 必须是对象'),
  body('year.targetSpecies')
    .optional()
    .isInt({ min: 0, max: 10000 })
    .withMessage('year.targetSpecies 必须是 0-10000 的整数'),
  body('targetBirds')
    .optional()
    .isArray({ max: 500 })
    .withMessage('targetBirds 必须是数组且长度不能超过500'),
  body('targetBirds.*.birdId')
    .optional()
    .isMongoId()
    .withMessage('targetBirds.birdId 格式无效'),
  body('targetBirds.*.notes')
    .optional()
    .isString()
    .isLength({ max: 1000 })
    .withMessage('targetBirds.notes 长度不能超过1000字符'),
  body('targetLocations')
    .optional()
    .isArray({ max: 500 })
    .withMessage('targetLocations 必须是数组且长度不能超过500'),
  body('targetLocations.*.locationName')
    .optional()
    .isString()
    .isLength({ min: 1, max: 200 })
    .withMessage('targetLocations.locationName 长度必须在1-200字符之间'),
  body('targetLocations.*.notes')
    .optional()
    .isString()
    .isLength({ max: 1000 })
    .withMessage('targetLocations.notes 长度不能超过1000字符'),
  handleValidationErrors,
];

module.exports = {
  validateBird,
  validateUserRegistration,
  validateUserLogin,
  validateSighting,
  validateObjectId,
  validateObjectIdParam,
  validatePagination,
  validateRecordPayload,
  validateLocationPayload,
  validateSearchQuery,
  validateHotSearchQuery,
  validateReportPayload,
  validateReportStatusPayload,
  validateYearMonthParams,
  validateDateRangeQuery,
  validateGoalCompletionParams,
  validatePersonalStatsQuery,
  validateUserSettingsPayload,
  validateImportPayload,
  validateNearbyLocationsQuery,
  validateLocationByNameQuery,
  validateGoalsPayload,
  handleValidationErrors
};





