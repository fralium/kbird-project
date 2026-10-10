// 数据验证工具
export const validators = {
  // 邮箱验证
  email: (value) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(value);
  },

  // 密码验证
  password: (value) => {
    // 至少8位，包含字母和数字
    const passwordRegex = /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d@$!%*#?&]{8,}$/;
    return passwordRegex.test(value);
  },

  // 用户名验证
  username: (value) => {
    // 3-20位字母数字下划线
    const usernameRegex = /^[a-zA-Z0-9_]{3,20}$/;
    return usernameRegex.test(value);
  },

  // 鸟类名称验证
  birdName: (value) => {
    // 中文名称，2-10个字符
    const birdNameRegex = /^[\u4e00-\u9fa5]{2,10}$/;
    return birdNameRegex.test(value);
  },

  // 地点名称验证
  locationName: (value) => {
    // 中文地点名称，2-20个字符
    const locationRegex = /^[\u4e00-\u9fa5]{2,20}$/;
    return locationRegex.test(value);
  },

  // 坐标验证
  coordinates: (lat, lng) => {
    const latNum = parseFloat(lat);
    const lngNum = parseFloat(lng);
    return latNum >= -90 && latNum <= 90 && lngNum >= -180 && lngNum <= 180;
  },

  // 日期验证
  date: (value) => {
    const date = new Date(value);
    return !isNaN(date.getTime()) && date <= new Date();
  },

  // 文件类型验证
  imageFile: (file) => {
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    return allowedTypes.includes(file.type);
  },

  // 文件大小验证
  fileSize: (file, maxSizeMB = 10) => {
    return file.size <= maxSizeMB * 1024 * 1024;
  }
};

// 验证规则配置
export const validationRules = {
  user: {
    email: { validator: validators.email, message: '请输入有效的邮箱地址' },
    password: { validator: validators.password, message: '密码至少8位，包含字母和数字' },
    username: { validator: validators.username, message: '用户名3-20位字母数字下划线' }
  },
  bird: {
    name: { validator: validators.birdName, message: '请输入有效的中文鸟类名称' },
    scientificName: { required: true, message: '请输入拉丁学名' }
  },
  location: {
    name: { validator: validators.locationName, message: '请输入有效的地点名称' },
    coordinates: { validator: validators.coordinates, message: '请输入有效的坐标' }
  },
  sighting: {
    date: { validator: validators.date, message: '请输入有效的观察日期' },
    location: { required: true, message: '请选择观察地点' },
    bird: { required: true, message: '请选择观察鸟类' }
  }
};

// 验证函数
export const validate = (data, rules) => {
  const errors = {};
  
  for (const [field, rule] of Object.entries(rules)) {
    const value = data[field];
    
    // 必填验证
    if (rule.required && (!value || value.toString().trim() === '')) {
      errors[field] = rule.message || `${field}是必填项`;
      continue;
    }
    
    // 自定义验证器
    if (rule.validator && value) {
      let isValid = true;
      
      if (typeof rule.validator === 'function') {
        isValid = rule.validator(value);
      } else if (Array.isArray(rule.validator)) {
        // 多个验证器
        isValid = rule.validator.every(validator => validator(value));
      }
      
      if (!isValid) {
        errors[field] = rule.message || `${field}格式不正确`;
      }
    }
  }
  
  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
};

// 清理和转义用户输入
export const sanitizeInput = (input) => {
  if (typeof input !== 'string') return input;
  
  return input
    .trim()
    .replace(/[<>]/g, '') // 移除潜在的HTML标签
    .replace(/javascript:/gi, '') // 移除javascript协议
    .replace(/on\w+=/gi, ''); // 移除事件处理器
};

// XSS防护
export const escapeHtml = (text) => {
  if (text === null || text === undefined) return '';
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  
  return String(text).replace(/[&<>"']/g, (m) => map[m]);
};

// CSRF Token生成
export const generateCSRFToken = () => {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
};

// 验证CSRF Token
export const validateCSRFToken = (token, sessionToken) => {
  return token && sessionToken && token === sessionToken;
};
