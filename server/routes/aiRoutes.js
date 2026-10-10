const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const {
  identifyBird,
  getAIStatus,
  identifyBatch,
  draftRecordFromText,
  upload,
} = require('../controllers/aiController');
const {
  listConversations,
  createConversation,
  getConversation,
  deleteConversation,
  postMessage,
  postMessageStream,
  appendIdentifyResult,
} = require('../controllers/aiConversationController');

// 所有路由都需要认证
router.use(protect);

// 获取AI服务状态
router.get('/status', getAIStatus);

// 对话历史
router.get('/conversations', listConversations);
router.post('/conversations', createConversation);
router.get('/conversations/:id', getConversation);
router.delete('/conversations/:id', deleteConversation);
// stream 路由须写在 messages 之前（同前缀时 Express 按注册顺序匹配）
router.post('/conversations/:id/messages/stream', postMessageStream);
router.post('/conversations/:id/messages', postMessage);
router.post('/conversations/:id/identify-result', appendIdentifyResult);

// 单张图片识别
router.post('/identify', upload.single('image'), identifyBird);

// 批量识别
router.post('/identify/batch', upload.array('images', 10), identifyBatch);

// 文字整理为记录草稿（不写入数据库）
router.post('/draft', draftRecordFromText);

module.exports = router;
