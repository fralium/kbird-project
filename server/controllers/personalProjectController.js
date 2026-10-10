const fs = require('fs');
const path = require('path');
const multer = require('multer');
const Project = require('../models/projectModel');
const { sendControllerError } = require('../middleware/controllerError');
const { getProjectsUploadsRoot, getUploadsRoot } = require('../config/dataPaths');
const { isPathInside } = require('../utils/safeUploadPath');

function resolveProjectFileAbs(relativePath) {
  const rel = String(relativePath || '').replace(/\\/g, '/');
  if (!rel) return null;
  const underUploads = rel.startsWith('uploads/') ? rel.slice('uploads/'.length) : rel;
  return path.resolve(getUploadsRoot(), underUploads);
}

const ALLOWED_PROJECT_FILE_MIME = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain',
  'text/markdown',
  'text/csv',
  'application/zip',
  'application/x-zip-compressed',
]);

const PROJECT_FILE_SIZE_LIMIT = 25 * 1024 * 1024;

const makeId = (prefix) =>
  `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

const normalizeTags = (tags) => {
  if (!Array.isArray(tags)) return [];
  return [...new Set(tags.map((item) => String(item || '').trim()).filter(Boolean))].slice(0, 30);
};

const parseDate = (value) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const normalizeUploadFileName = (name) => {
  const raw = String(name || '').trim();
  if (!raw) return '';
  try {
    const decoded = Buffer.from(raw, 'latin1').toString('utf8').trim();
    if (!decoded || decoded.includes('�')) return raw;
    const rawHasCjk = /[\u4e00-\u9fff]/.test(raw);
    const decodedHasCjk = /[\u4e00-\u9fff]/.test(decoded);
    const rawLikelyMojibake = /[ÃÅÆÇÐÑÒÓÔÕÖ×ØÙÚÛÜÝÞßàáâãäåæçèéêëìíîïðñòóôõöøùúûüýþÿ]/.test(raw);
    if (!rawHasCjk && (decodedHasCjk || rawLikelyMojibake)) {
      return decoded;
    }
    return raw;
  } catch (_) {
    return raw;
  }
};

const sanitizeExternalLinkUrl = (rawUrl) => {
  const raw = String(rawUrl || '').trim();
  if (!raw) return '';
  let parsed;
  try {
    parsed = new URL(raw);
  } catch {
    return '';
  }
  if (!['http:', 'https:'].includes(parsed.protocol)) return '';
  return parsed.toString();
};

const sanitizeProjectPayload = (body = {}) => {
  const payload = {};
  if (typeof body.title === 'string') payload.title = body.title.trim().slice(0, 180);
  if (typeof body.summary === 'string') payload.summary = body.summary.trim().slice(0, 5000);
  if (typeof body.status === 'string') payload.status = body.status;
  if (typeof body.locationScope === 'string') payload.locationScope = body.locationScope.trim().slice(0, 500);
  if (typeof body.reportDraft === 'string') payload.reportDraft = body.reportDraft.slice(0, 200000);
  if (Array.isArray(body.linkedRecordIds)) payload.linkedRecordIds = body.linkedRecordIds;
  if (body.dateRange && typeof body.dateRange === 'object') {
    payload.dateRange = {
      start: parseDate(body.dateRange.start),
      end: parseDate(body.dateRange.end),
    };
  }
  payload.tags = normalizeTags(body.tags);
  return payload;
};

const projectUploadStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const userId = req.user?.id || 'anonymous';
    const targetDir = path.join(getProjectsUploadsRoot(), String(userId));
    fs.mkdir(targetDir, { recursive: true }, (err) => cb(err, targetDir));
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase();
    cb(null, `${Date.now()}_${Math.random().toString(36).slice(2, 8)}${ext}`);
  },
});

const projectUpload = multer({
  storage: projectUploadStorage,
  limits: { fileSize: PROJECT_FILE_SIZE_LIMIT, files: 1 },
  fileFilter: (req, file, cb) => {
    if (!ALLOWED_PROJECT_FILE_MIME.has(file.mimetype)) {
      return cb(new Error('不支持的文件类型'));
    }
    cb(null, true);
  },
}).single('file');

const withUpload = (req, res) =>
  new Promise((resolve, reject) => {
    projectUpload(req, res, (err) => {
      if (err) return reject(err);
      resolve();
    });
  });

const listProjects = async (req, res) => {
  try {
    const projects = await Project.find({ ownerId: req.user.id })
      .sort({ updatedAt: -1 })
      .select('-assets.content');
    return res.json({ success: true, data: projects });
  } catch (error) {
    return sendControllerError(res, error, {
      defaultMessage: '获取项目列表失败',
      defaultCode: 'PROJECT_OPERATION_FAILED',
    });
  }
};

const createProject = async (req, res) => {
  try {
    const payload = sanitizeProjectPayload(req.body);
    if (!payload.title) {
      return res.status(400).json({ success: false, message: '项目标题不能为空' });
    }
    const project = await Project.create({
      ownerId: req.user.id,
      title: payload.title,
      summary: payload.summary || '',
      status: payload.status || 'planning',
      locationScope: payload.locationScope || '',
      dateRange: payload.dateRange || { start: null, end: null },
      tags: payload.tags || [],
      linkedRecordIds: payload.linkedRecordIds || [],
      reportDraft: payload.reportDraft || '',
      folders: [],
      assets: [],
    });
    return res.status(201).json({ success: true, data: project, message: '项目创建成功' });
  } catch (error) {
    return sendControllerError(res, error, {
      defaultMessage: '创建项目失败',
      defaultCode: 'PROJECT_OPERATION_FAILED',
    });
  }
};

const getProjectById = async (req, res) => {
  try {
    const project = await Project.findOne({ _id: req.params.id, ownerId: req.user.id });
    if (!project) {
      return res.status(404).json({ success: false, message: '项目不存在' });
    }
    return res.json({ success: true, data: project });
  } catch (error) {
    return sendControllerError(res, error, {
      defaultMessage: '获取项目失败',
      defaultCode: 'PROJECT_OPERATION_FAILED',
    });
  }
};

const updateProject = async (req, res) => {
  try {
    const project = await Project.findOne({ _id: req.params.id, ownerId: req.user.id });
    if (!project) {
      return res.status(404).json({ success: false, message: '项目不存在' });
    }

    const payload = sanitizeProjectPayload(req.body);
    Object.keys(payload).forEach((key) => {
      if (key === 'tags' && payload.tags) {
        project.tags = payload.tags;
        return;
      }
      project[key] = payload[key];
    });
    await project.save();
    return res.json({ success: true, data: project, message: '项目更新成功' });
  } catch (error) {
    return sendControllerError(res, error, {
      defaultMessage: '更新项目失败',
      defaultCode: 'PROJECT_OPERATION_FAILED',
    });
  }
};

const deleteProject = async (req, res) => {
  try {
    const project = await Project.findOneAndDelete({ _id: req.params.id, ownerId: req.user.id });
    if (!project) {
      return res.status(404).json({ success: false, message: '项目不存在' });
    }

    // 清理项目文件，避免删库留盘
    const uploadsRoot = path.resolve(getProjectsUploadsRoot());
    for (const asset of project.assets || []) {
      if (!asset?.file?.relativePath) continue;
      const absPath = resolveProjectFileAbs(asset.file.relativePath);
      if (absPath && isPathInside(uploadsRoot, absPath) && fs.existsSync(absPath)) {
        try {
          fs.unlinkSync(absPath);
        } catch (_) {
          // ignore cleanup failure
        }
      }
    }

    return res.json({ success: true, message: '项目已删除' });
  } catch (error) {
    return sendControllerError(res, error, {
      defaultMessage: '删除项目失败',
      defaultCode: 'PROJECT_OPERATION_FAILED',
    });
  }
};

const createFolder = async (req, res) => {
  try {
    const project = await Project.findOne({ _id: req.params.id, ownerId: req.user.id });
    if (!project) return res.status(404).json({ success: false, message: '项目不存在' });

    const name = String(req.body?.name || '').trim().slice(0, 120);
    if (!name) return res.status(400).json({ success: false, message: '目录名称不能为空' });
    const parentId = String(req.body?.parentId || '');

    const folder = {
      id: makeId('folder'),
      name,
      parentId,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    project.folders.push(folder);
    await project.save();
    return res.status(201).json({ success: true, data: folder, message: '目录创建成功' });
  } catch (error) {
    return sendControllerError(res, error, {
      defaultMessage: '创建目录失败',
      defaultCode: 'PROJECT_OPERATION_FAILED',
    });
  }
};

const updateFolder = async (req, res) => {
  try {
    const project = await Project.findOne({ _id: req.params.id, ownerId: req.user.id });
    if (!project) return res.status(404).json({ success: false, message: '项目不存在' });
    const folder = project.folders.find((item) => item.id === req.params.folderId);
    if (!folder) return res.status(404).json({ success: false, message: '目录不存在' });

    if (typeof req.body?.name === 'string') folder.name = req.body.name.trim().slice(0, 120);
    if (typeof req.body?.parentId === 'string') folder.parentId = req.body.parentId;
    folder.updatedAt = new Date();

    await project.save();
    return res.json({ success: true, data: folder, message: '目录更新成功' });
  } catch (error) {
    return sendControllerError(res, error, {
      defaultMessage: '更新目录失败',
      defaultCode: 'PROJECT_OPERATION_FAILED',
    });
  }
};

const deleteFolder = async (req, res) => {
  try {
    const project = await Project.findOne({ _id: req.params.id, ownerId: req.user.id });
    if (!project) return res.status(404).json({ success: false, message: '项目不存在' });
    const exists = project.folders.some((item) => item.id === req.params.folderId);
    if (!exists) return res.status(404).json({ success: false, message: '目录不存在' });

    project.folders = project.folders.filter((item) => item.id !== req.params.folderId);
    project.assets.forEach((asset) => {
      if (asset.folderId === req.params.folderId) {
        asset.folderId = '';
        asset.updatedAt = new Date();
      }
    });
    await project.save();
    return res.json({ success: true, message: '目录已删除' });
  } catch (error) {
    return sendControllerError(res, error, {
      defaultMessage: '删除目录失败',
      defaultCode: 'PROJECT_OPERATION_FAILED',
    });
  }
};

const createAsset = async (req, res) => {
  try {
    const project = await Project.findOne({ _id: req.params.id, ownerId: req.user.id });
    if (!project) return res.status(404).json({ success: false, message: '项目不存在' });

    const type = String(req.body?.type || '').trim();
    const title = String(req.body?.title || '').trim().slice(0, 180);
    const folderId = String(req.body?.folderId || '');
    if (!['note', 'link'].includes(type)) {
      return res.status(400).json({ success: false, message: '仅支持创建文字或链接资料' });
    }
    if (!title) return res.status(400).json({ success: false, message: '资料标题不能为空' });
    if (folderId && !project.folders.some((item) => item.id === folderId)) {
      return res.status(400).json({ success: false, message: '目录不存在' });
    }

    let linkUrl = '';
    if (type === 'link') {
      linkUrl = sanitizeExternalLinkUrl(req.body?.url);
      if (!linkUrl) {
        return res.status(400).json({ success: false, message: '链接必须是 http/https 地址' });
      }
    }

    const asset = {
      id: makeId('asset'),
      type,
      title,
      content: type === 'note' ? String(req.body?.content || '').slice(0, 200000) : '',
      url: linkUrl,
      folderId,
      tags: normalizeTags(req.body?.tags),
      file: {},
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    project.assets.unshift(asset);
    await project.save();
    return res.status(201).json({ success: true, data: asset, message: '资料创建成功' });
  } catch (error) {
    return sendControllerError(res, error, {
      defaultMessage: '创建资料失败',
      defaultCode: 'PROJECT_OPERATION_FAILED',
    });
  }
};

const updateAsset = async (req, res) => {
  try {
    const project = await Project.findOne({ _id: req.params.id, ownerId: req.user.id });
    if (!project) return res.status(404).json({ success: false, message: '项目不存在' });
    const asset = project.assets.find((item) => item.id === req.params.assetId);
    if (!asset) return res.status(404).json({ success: false, message: '资料不存在' });

    if (typeof req.body?.title === 'string') asset.title = req.body.title.trim().slice(0, 180);
    if (typeof req.body?.content === 'string') asset.content = req.body.content.slice(0, 200000);
    if (typeof req.body?.url === 'string') {
      if (asset.type === 'link') {
        const safeUrl = sanitizeExternalLinkUrl(req.body.url);
        if (!safeUrl) {
          return res.status(400).json({ success: false, message: '链接必须是 http/https 地址' });
        }
        asset.url = safeUrl;
      } else {
        asset.url = '';
      }
    }
    if (typeof req.body?.folderId === 'string') asset.folderId = req.body.folderId;
    if (Array.isArray(req.body?.tags)) asset.tags = normalizeTags(req.body.tags);
    asset.updatedAt = new Date();
    await project.save();
    return res.json({ success: true, data: asset, message: '资料更新成功' });
  } catch (error) {
    return sendControllerError(res, error, {
      defaultMessage: '更新资料失败',
      defaultCode: 'PROJECT_OPERATION_FAILED',
    });
  }
};

const deleteAsset = async (req, res) => {
  try {
    const project = await Project.findOne({ _id: req.params.id, ownerId: req.user.id });
    if (!project) return res.status(404).json({ success: false, message: '项目不存在' });
    const asset = project.assets.find((item) => item.id === req.params.assetId);
    if (!asset) return res.status(404).json({ success: false, message: '资料不存在' });

    if (asset.file?.relativePath) {
      const uploadsRoot = path.resolve(getProjectsUploadsRoot());
      const absPath = resolveProjectFileAbs(asset.file.relativePath);
      if (absPath && isPathInside(uploadsRoot, absPath) && fs.existsSync(absPath)) {
        fs.unlinkSync(absPath);
      }
    }

    project.assets = project.assets.filter((item) => item.id !== req.params.assetId);
    await project.save();
    return res.json({ success: true, message: '资料已删除' });
  } catch (error) {
    return sendControllerError(res, error, {
      defaultMessage: '删除资料失败',
      defaultCode: 'PROJECT_OPERATION_FAILED',
    });
  }
};

const downloadAssetFile = async (req, res) => {
  try {
    const project = await Project.findOne({ _id: req.params.id, ownerId: req.user.id });
    if (!project) return res.status(404).json({ success: false, message: '项目不存在' });
    const asset = project.assets.find((item) => item.id === req.params.assetId);
    if (!asset) return res.status(404).json({ success: false, message: '资料不存在' });
    if (!asset.file?.relativePath || !asset.file?.storedName) {
      return res.status(404).json({ success: false, message: '该资料没有可下载文件' });
    }

    const uploadsRoot = path.resolve(getProjectsUploadsRoot());
    const absPath = resolveProjectFileAbs(asset.file.relativePath);
    if (!absPath || !isPathInside(uploadsRoot, absPath)) {
      return res.status(400).json({ success: false, message: '非法文件路径' });
    }
    if (!fs.existsSync(absPath)) {
      return res.status(404).json({ success: false, message: '文件不存在或已被删除' });
    }

    const downloadName = normalizeUploadFileName(asset.file.originalName) || asset.file.storedName;
    res.setHeader('Content-Type', asset.file.mimeType || 'application/octet-stream');
    res.setHeader(
      'Content-Disposition',
      `inline; filename*=UTF-8''${encodeURIComponent(downloadName)}`
    );
    return res.sendFile(absPath);
  } catch (error) {
    return sendControllerError(res, error, {
      defaultMessage: '下载资料失败',
      defaultCode: 'PROJECT_OPERATION_FAILED',
    });
  }
};

const uploadAsset = async (req, res) => {
  try {
    await withUpload(req, res);
    const project = await Project.findOne({ _id: req.params.id, ownerId: req.user.id });
    if (!project) {
      if (req.file?.path) {
        try {
          fs.unlinkSync(req.file.path);
        } catch (_) {
          // ignore cleanup failure
        }
      }
      return res.status(404).json({ success: false, message: '项目不存在' });
    }
    if (!req.file) return res.status(400).json({ success: false, message: '未检测到上传文件' });

    const folderId = String(req.body?.folderId || '');
    if (folderId && !project.folders.some((item) => item.id === folderId)) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (_) {
        // ignore cleanup failure
      }
      return res.status(400).json({ success: false, message: '目录不存在' });
    }

    const normalizedOriginalName = normalizeUploadFileName(req.file.originalname);
    const titleInput = String(req.body?.title || '').trim();
    const title = titleInput || normalizedOriginalName;
    const assetType = req.file.mimetype.startsWith('image/') ? 'image' : 'file';
    const relPath = path
      .join('uploads', 'projects', String(req.user.id), req.file.filename)
      .replace(/\\/g, '/');

    const asset = {
      id: makeId('asset'),
      type: assetType,
      title: title.slice(0, 180),
      content: '',
      url: '',
      folderId,
      tags: normalizeTags(
        typeof req.body?.tags === 'string' ? req.body.tags.split(',') : req.body?.tags
      ),
      file: {
        originalName: normalizedOriginalName || req.file.originalname,
        storedName: req.file.filename,
        relativePath: relPath,
        mimeType: req.file.mimetype,
        size: req.file.size,
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    project.assets.unshift(asset);
    await project.save();
    return res.status(201).json({ success: true, data: asset, message: '文件上传成功' });
  } catch (error) {
    return sendControllerError(res, error, {
      defaultMessage: '上传资料失败',
      defaultCode: 'PROJECT_OPERATION_FAILED',
    });
  }
};

module.exports = {
  listProjects,
  createProject,
  getProjectById,
  updateProject,
  deleteProject,
  createFolder,
  updateFolder,
  deleteFolder,
  createAsset,
  updateAsset,
  deleteAsset,
  downloadAssetFile,
  uploadAsset,
};
