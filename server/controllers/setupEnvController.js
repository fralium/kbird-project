const { sendControllerError } = require('../middleware/controllerError');
const { isLocalLoopbackRequest } = require('../config/appMode');
const {
  getMaskedSetupView,
  buildUpdatesFromGuiPayload,
  upsertEnvKeys,
  parseMongoUri,
} = require('../utils/envFile');

function requireLocalAdmin(req, res) {
  if (!isLocalLoopbackRequest(req)) {
    res.status(403).json({
      success: false,
      message: '服务与密钥仅允许在本机（127.0.0.1）修改',
    });
    return false;
  }
  if (!req.user || req.user.role !== 'admin') {
    res.status(403).json({
      success: false,
      message: '仅管理员可修改服务与密钥',
    });
    return false;
  }
  return true;
}

// @desc    读取本机 .env 配置（密钥仅掩码）
// @route   GET /api/personal/setup-env
// @access  Private (admin + localhost)
exports.getSetupEnv = async (req, res) => {
  try {
    if (!requireLocalAdmin(req, res)) return;
    const data = getMaskedSetupView();
    return res.json({ success: true, data });
  } catch (error) {
    return sendControllerError(res, error, {
      defaultMessage: '读取本机配置失败',
      defaultCode: 'SETUP_ENV_READ_FAILED',
      status: 500,
    });
  }
};

// @desc    写入本机 .env（白名单键）
// @route   PUT /api/personal/setup-env
// @access  Private (admin + localhost)
exports.updateSetupEnv = async (req, res) => {
  try {
    if (!requireLocalAdmin(req, res)) return;

    const { updates, current } = buildUpdatesFromGuiPayload(req.body || {}, { forInit: false });
    if (!Object.keys(updates).length) {
      return res.json({
        success: true,
        message: '没有需要更新的字段',
        restartRequired: false,
        data: getMaskedSetupView(),
        envWritten: [],
      });
    }

    const beforeMongo = parseMongoUri(current.MONGODB_URI || process.env.MONGODB_URI || '');
    const result = upsertEnvKeys(updates);
    const afterMap = { ...current, ...updates };
    const afterMongo = parseMongoUri(afterMap.MONGODB_URI || '');
    const dbChanged =
      beforeMongo.dbName !== afterMongo.dbName ||
      beforeMongo.host !== afterMongo.host ||
      String(beforeMongo.port) !== String(afterMongo.port);

    return res.json({
      success: true,
      message: dbChanged
        ? '已写入 .env。数据库连接已变更，请关闭并重新运行 KBird-Start.bat 后生效。'
        : '已写入 .env。请重启 KBird-Start.bat 后地图/AI/端口等配置才会生效。',
      restartRequired: true,
      dbChanged,
      envWritten: result.written || [],
      data: getMaskedSetupView(),
    });
  } catch (error) {
    if (error && /数据库名称|端口无效/.test(String(error.message || ''))) {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }
    return sendControllerError(res, error, {
      defaultMessage: '写入本机配置失败',
      defaultCode: 'SETUP_ENV_WRITE_FAILED',
      status: 500,
    });
  }
};
