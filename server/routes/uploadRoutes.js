const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const {
  uploadSingleImage,
  validateUploadedFiles,
  handleUploadError,
} = require('../middleware/fileUploadSecurity');

// 通用图片上传（走统一 MIME/扩展名白名单与安全文件名）
router.post(
  '/image',
  protect,
  (req, res, next) => {
    uploadSingleImage(req, res, (err) => {
      if (err) return handleUploadError(err, req, res, next);
      return next();
    });
  },
  async (req, res, next) => {
    // validateUploadedFiles 期望 req.files 数组
    if (req.file && !req.files) {
      req.files = [req.file];
    }
    return validateUploadedFiles(req, res, next);
  },
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: '没有上传文件',
        });
      }

      res.status(200).json({
        success: true,
        message: '图片上传成功',
        data: {
          filename: req.file.filename,
          originalName: req.file.originalname,
          size: req.file.size,
          url: `/uploads/active/${req.file.filename}`,
        },
      });
    } catch (error) {
      console.error('图片上传失败:', error);
      res.status(500).json({
        success: false,
        message: '图片上传失败',
      });
    }
  }
);

module.exports = router;
