import formidable from 'formidable';
import fs from 'fs';
import path from 'path';

// 禁用默认的body parser
export const config = {
  api: {
    bodyParser: false,
  },
};

// Next.js API代理路由 - 通用图片上传
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      message: '方法不允许'
    });
  }

  try {
    console.log('开始处理上传请求...');
    
    // 确保uploads目录存在
    const uploadDir = './uploads';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    
    // 使用formidable 3.x的新API
    const form = formidable({
      uploadDir: uploadDir,
      keepExtensions: true,
      maxFileSize: 10 * 1024 * 1024, // 10MB
      multiples: false,
      filter: function ({name, originalFilename, mimetype}) {
        console.log('文件过滤:', { name, originalFilename, mimetype });
        return mimetype && mimetype.includes('image');
      }
    });

    console.log('开始解析表单数据...');
    
    // 使用Promise包装form.parse
    const parseForm = () => new Promise((resolve, reject) => {
      form.parse(req, (err, fields, files) => {
        if (err) {
          reject(err);
        } else {
          resolve([fields, files]);
        }
      });
    });
    
    const [fields, files] = await parseForm();
    console.log('表单解析完成:', { fields, files });
    
    if (!files.image || !files.image[0]) {
      return res.status(400).json({
        success: false,
        message: '没有上传文件'
      });
    }

    const uploadedFile = files.image[0];
    
    // 生成安全的文件名
    const fileExtension = path.extname(uploadedFile.originalFilename || '');
    const fileName = `upload_${Date.now()}_${Math.round(Math.random() * 1E9)}${fileExtension}`;
    const newPath = path.join('./uploads', fileName);
    
    // 移动文件到新位置
    fs.renameSync(uploadedFile.filepath, newPath);
    
    // 返回文件信息
    res.status(200).json({
      success: true,
      message: '图片上传成功',
      data: {
        filename: fileName,
        originalName: uploadedFile.originalFilename,
        size: uploadedFile.size,
        url: `/uploads/${fileName}`
      }
    });
  } catch (error) {
    console.error('图片上传错误:', error);
    res.status(500).json({
      success: false,
      message: '服务器错误',
      error: error.message,
    });
  }
}
