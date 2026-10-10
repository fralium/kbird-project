const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const {
  previewImport,
  applyImport,
  importFromJson,
  importFromCbrcTable,
  previewCbrcTable,
  previewJsonImport,
} = require('../controllers/personalImportController');
const { validateImportPayload } = require('../middleware/validation');

router.use(protect);

/** 粘贴 CSV/JSON（content）走文本导入；备份 records[] 走 JSON 导入 */
const previewUnified = (req, res, next) => {
  const hasContent = typeof req.body?.content === 'string' && req.body.content.trim().length > 0;
  return hasContent ? previewImport(req, res, next) : previewJsonImport(req, res, next);
};

const applyUnified = (req, res, next) => {
  const hasContent = typeof req.body?.content === 'string' && req.body.content.trim().length > 0;
  return hasContent ? applyImport(req, res, next) : importFromJson(req, res, next);
};

// 统一接口（personal/data 页面：粘贴 content 或备份 records）
router.post('/preview', validateImportPayload, previewUnified);
router.post('/apply', validateImportPayload, applyUnified);

// 兼容旧接口
router.post('/json/preview', validateImportPayload, previewJsonImport);
router.post('/json', validateImportPayload, importFromJson);
router.post('/cbrc-table/preview', validateImportPayload, previewCbrcTable);
router.post('/cbrc-table', validateImportPayload, importFromCbrcTable);

module.exports = router;
