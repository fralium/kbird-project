const UserSettings = require('../models/userSettingsModel');
const { sendControllerError } = require('../middleware/controllerError');
const { devError } = require('../utils/devLogger');

// @desc    获取用户设置
// @route   GET /api/personal/settings
// @access  Private
const getSettings = async (req, res) => {
  try {
    const userId = req.user._id || req.user.id;

    let settings = await UserSettings.findOne({ userId });

    // 如果不存在，创建默认设置
    if (!settings) {
      settings = await UserSettings.create({ userId });
    }

    res.json({
      success: true,
      data: settings,
    });
  } catch (error) {
    devError('获取设置失败:', error);
    return sendControllerError(res, error, {
      defaultMessage: '获取设置失败',
      defaultCode: 'USER_SETTINGS_OPERATION_FAILED',
    });
  }
};

// @desc    更新用户设置
// @route   PUT /api/personal/settings
// @access  Private
const updateSettings = async (req, res) => {
  try {
    const userId = req.user._id || req.user.id;
    const updates = req.body;
    
    let settings = await UserSettings.findOne({ userId });
    
    if (!settings) {
      settings = await UserSettings.create({ userId });
    }
    
    // 更新设置
    if (updates.theme !== undefined) settings.theme = updates.theme;
    if (updates.uiStyle !== undefined) settings.uiStyle = updates.uiStyle;
    if (updates.language !== undefined) settings.language = updates.language;
    if (updates.dateFormat !== undefined) settings.dateFormat = updates.dateFormat;
    if (updates.units !== undefined) {
      if (updates.units.temperature !== undefined) {
        settings.units.temperature = updates.units.temperature;
      }
      if (updates.units.distance !== undefined) {
        settings.units.distance = updates.units.distance;
      }
    }
    if (updates.notifications !== undefined) {
      Object.keys(updates.notifications).forEach(key => {
        if (settings.notifications[key] !== undefined) {
          settings.notifications[key] = updates.notifications[key];
        }
      });
    }
    if (updates.display !== undefined) {
      Object.keys(updates.display).forEach(key => {
        if (settings.display[key] !== undefined) {
          settings.display[key] = updates.display[key];
        }
      });
    }
    if (updates.privacy !== undefined) {
      Object.keys(updates.privacy).forEach(key => {
        if (settings.privacy[key] !== undefined) {
          settings.privacy[key] = updates.privacy[key];
        }
      });
    }

    if (updates.notepad !== undefined && updates.notepad !== null) {
      if (!settings.notepad) {
        settings.notepad = { content: '', notes: [], activeNoteId: '', updatedAt: null };
      }

      const hasNotesPayload = Array.isArray(updates.notepad.notes);
      if (hasNotesPayload) {
        const nextNotes = updates.notepad.notes
          .slice(0, 200)
          .map((note, index) => {
            const safeId = typeof note?.id === 'string' && note.id.trim()
              ? note.id.trim()
              : `note-${Date.now()}-${index}`;
            const safeTitle = typeof note?.title === 'string' && note.title.trim()
              ? note.title.trim().slice(0, 120)
              : '未命名便签';
            const safeContent = typeof note?.content === 'string'
              ? note.content.slice(0, 50000)
              : '';
            const safeCreatedAt = note?.createdAt ? new Date(note.createdAt) : new Date();
            const safeUpdatedAt = note?.updatedAt ? new Date(note.updatedAt) : new Date();
            const safeComments = Array.isArray(note?.comments)
              ? note.comments.slice(0, 100).map((c, cIndex) => {
                  const cCreated = c?.createdAt ? new Date(c.createdAt) : new Date();
                  const start = Number(c?.start);
                  const end = Number(c?.end);
                  return {
                    id:
                      typeof c?.id === 'string' && c.id.trim()
                        ? c.id.trim()
                        : `cmt-${Date.now()}-${cIndex}`,
                    quote: typeof c?.quote === 'string' ? c.quote.slice(0, 500) : '',
                    start: Number.isFinite(start) && start >= 0 ? Math.floor(start) : 0,
                    end: Number.isFinite(end) && end >= 0 ? Math.floor(end) : 0,
                    body: typeof c?.body === 'string' ? c.body.slice(0, 2000) : '',
                    createdAt: Number.isNaN(cCreated.getTime()) ? new Date() : cCreated,
                  };
                })
              : [];
            return {
              id: safeId,
              title: safeTitle,
              content: safeContent,
              pinned: Boolean(note?.pinned),
              comments: safeComments,
              createdAt: Number.isNaN(safeCreatedAt.getTime()) ? new Date() : safeCreatedAt,
              updatedAt: Number.isNaN(safeUpdatedAt.getTime()) ? new Date() : safeUpdatedAt,
            };
          });

        settings.notepad.notes = nextNotes;
        // 允许空字符串表示「未打开任何便签」
        if (typeof updates.notepad.activeNoteId === 'string') {
          settings.notepad.activeNoteId = updates.notepad.activeNoteId;
        } else {
          settings.notepad.activeNoteId = '';
        }
        settings.notepad.content = '';
        settings.notepad.updatedAt = updates.notepad.updatedAt
          ? new Date(updates.notepad.updatedAt)
          : new Date();
      } else {
        const nextContent = typeof updates.notepad.content === 'string'
          ? updates.notepad.content
          : settings.notepad?.content || '';
        settings.notepad.content = nextContent;
        settings.notepad.updatedAt = updates.notepad.updatedAt
          ? new Date(updates.notepad.updatedAt)
          : new Date();
      }
    }

    if (updates.localBirdPhotoRoot !== undefined) {
      settings.localBirdPhotoRoot = String(updates.localBirdPhotoRoot || '').trim().slice(0, 500);
    }
    
    await settings.save();
    
    res.json({
      success: true,
      data: settings,
      message: '设置更新成功',
    });
  } catch (error) {
    devError('更新设置失败:', error);
    return sendControllerError(res, error, {
      defaultMessage: '更新设置失败',
      defaultCode: 'USER_SETTINGS_OPERATION_FAILED',
    });
  }
};

// @desc    重置用户设置
// @route   POST /api/personal/settings/reset
// @access  Private
const resetSettings = async (req, res) => {
  try {
    const userId = req.user._id || req.user.id;

    await UserSettings.findOneAndDelete({ userId });
    const settings = await UserSettings.create({ userId });
    
    res.json({
      success: true,
      data: settings,
      message: '设置已重置为默认值',
    });
  } catch (error) {
    devError('重置设置失败:', error);
    return sendControllerError(res, error, {
      defaultMessage: '重置设置失败',
      defaultCode: 'USER_SETTINGS_OPERATION_FAILED',
    });
  }
};

module.exports = {
  getSettings,
  updateSettings,
  resetSettings,
};
