/**
 * 浏览器端压缩图片，供 AI 识鸟等上传场景使用。
 * 手机原图常 >2MB；压缩到长边与体积上限后再传，避免 Multer LIMIT_FILE_SIZE。
 */

const DEFAULT_MAX_EDGE = 1920;
const DEFAULT_MAX_BYTES = 1.8 * 1024 * 1024;
const DEFAULT_QUALITY = 0.82;

function loadImageFromFile(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('图片读取失败'));
    };
    img.src = url;
  });
}

function canvasToBlob(canvas, type, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('图片压缩失败'));
          return;
        }
        resolve(blob);
      },
      type,
      quality
    );
  });
}

/**
 * @param {File} file
 * @param {{ maxEdge?: number, maxBytes?: number, quality?: number }} [options]
 * @returns {Promise<File>}
 */
export async function compressImageForUpload(file, options = {}) {
  if (!file || !(file instanceof Blob)) return file;

  const maxEdge = options.maxEdge || DEFAULT_MAX_EDGE;
  const maxBytes = options.maxBytes || DEFAULT_MAX_BYTES;
  let quality = options.quality || DEFAULT_QUALITY;

  // 已经很小且非超大尺寸时可直接用
  if (file.size <= maxBytes) {
    // 仍可能是超宽图；继续走压缩更稳
  }

  const img = await loadImageFromFile(file);
  let { width, height } = img;
  if (!width || !height) return file;

  const scale = Math.min(1, maxEdge / Math.max(width, height));
  width = Math.max(1, Math.round(width * scale));
  height = Math.max(1, Math.round(height * scale));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return file;
  ctx.drawImage(img, 0, 0, width, height);

  const outType = 'image/jpeg';
  let blob = await canvasToBlob(canvas, outType, quality);
  // 仍过大则逐步降质量
  while (blob.size > maxBytes && quality > 0.5) {
    quality -= 0.08;
    blob = await canvasToBlob(canvas, outType, quality);
  }

  const baseName = String(file.name || 'photo').replace(/\.[^.]+$/, '') || 'photo';
  return new File([blob], `${baseName}.jpg`, {
    type: outType,
    lastModified: Date.now(),
  });
}

export async function compressImagesForUpload(files, options = {}) {
  const list = Array.from(files || []);
  return Promise.all(list.map((f) => compressImageForUpload(f, options)));
}
