const identificationService = require('../services/ai/identificationService');
const multer = require('multer');
const { sendControllerError } = require('../middleware/controllerError');
const { devError } = require('../utils/devLogger');
const AI_IMAGE_MAX_SIZE = 2 * 1024 * 1024; // 2MB

// 配置multer用于图片上传
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: AI_IMAGE_MAX_SIZE,
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/bmp'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      const error = new Error('不支持的图片格式，支持: PNG、JPG、JPEG、BMP');
      error.statusCode = 400;
      error.code = 'UNSUPPORTED_IMAGE_FORMAT';
      cb(error, false);
    }
  },
});

// @desc    识别鸟类
// @route   POST /api/ai/identify
// @access  Private
const identifyBird = async (req, res) => {
  try {
    if (!req.file) {
      const missingFileError = new Error('请上传图片');
      missingFileError.statusCode = 400;
      missingFileError.code = 'MISSING_IMAGE_FILE';
      return sendControllerError(res, missingFileError, {
        defaultMessage: '请上传图片',
        defaultCode: 'MISSING_IMAGE_FILE',
        fallbackStatus: 400,
      });
    }

    const { provider, description } = req.body;

    // 调用识别服务
    const result = await identificationService.identify(req.file.buffer, {
      provider: provider || undefined,
      filename: req.file.originalname,
      contentType: req.file.mimetype,
      userDescription: description || '',
    });

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    devError('AI识别失败:', error);
    return sendControllerError(res, error, {
      defaultMessage: 'AI识别失败',
      defaultCode: 'AI_OPERATION_FAILED',
    });
  }
};

// @desc    获取AI服务状态
// @route   GET /api/ai/status
// @access  Private
const getAIStatus = async (req, res) => {
  try {
    const status = identificationService.getStatus();
    res.json({
      success: true,
      data: status,
    });
  } catch (error) {
    devError('获取AI状态失败:', error);
    return sendControllerError(res, error, {
      defaultMessage: '获取AI状态失败',
      defaultCode: 'AI_OPERATION_FAILED',
    });
  }
};

// @desc    批量识别（多张图片）
// @route   POST /api/ai/identify/batch
// @access  Private
const identifyBatch = async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      const missingFilesError = new Error('请上传至少一张图片');
      missingFilesError.statusCode = 400;
      missingFilesError.code = 'MISSING_IMAGE_FILES';
      return sendControllerError(res, missingFilesError, {
        defaultMessage: '请上传至少一张图片',
        defaultCode: 'MISSING_IMAGE_FILES',
        fallbackStatus: 400,
      });
    }

    const { provider, description } = req.body;
    const results = [];

    // 并发识别所有图片
    const promises = req.files.map(file =>
      identificationService.identify(file.buffer, {
        provider: provider || undefined,
        filename: file.originalname,
        contentType: file.mimetype,
        userDescription: description || '',
      }).catch(error => ({
        success: false,
        filename: file.originalname,
        error: error?.message || '识别失败',
        code: error?.code || 'AI_OPERATION_FAILED',
      }))
    );

    const identificationResults = await Promise.all(promises);

    res.json({
      success: true,
      data: {
        total: req.files.length,
        results: identificationResults,
      },
    });
  } catch (error) {
    devError('批量识别失败:', error);
    return sendControllerError(res, error, {
      defaultMessage: '批量识别失败',
      defaultCode: 'AI_OPERATION_FAILED',
    });
  }
};

const DRAFT_TEXT_MAX = 4000;

// @desc    把自由文本整理成观鸟记录草稿
// @route   POST /api/ai/draft
// @access  Private
const draftRecordFromText = async (req, res) => {
  try {
    const text = String(req.body?.text || '').trim();
    if (!text) {
      const error = new Error('请粘贴观鸟笔记');
      error.statusCode = 400;
      error.code = 'MISSING_DRAFT_TEXT';
      return sendControllerError(res, error, {
        defaultMessage: '请粘贴观鸟笔记',
        defaultCode: 'MISSING_DRAFT_TEXT',
        fallbackStatus: 400,
      });
    }
    if (text.length > DRAFT_TEXT_MAX) {
      const error = new Error(`笔记请控制在 ${DRAFT_TEXT_MAX} 字以内`);
      error.statusCode = 400;
      error.code = 'DRAFT_TEXT_TOO_LONG';
      return sendControllerError(res, error, {
        defaultMessage: `笔记请控制在 ${DRAFT_TEXT_MAX} 字以内`,
        defaultCode: 'DRAFT_TEXT_TOO_LONG',
        fallbackStatus: 400,
      });
    }

    const data = await identificationService.draftFromText(text);
    return res.json({ success: true, data });
  } catch (error) {
    devError('生成记录草稿失败:', error);
    return sendControllerError(res, error, {
      defaultMessage: '生成草稿失败',
      defaultCode: 'AI_DRAFT_FAILED',
    });
  }
};

module.exports = {
  identifyBird,
  getAIStatus,
  identifyBatch,
  draftRecordFromText,
  upload, // 导出upload中间件供路由使用
};
