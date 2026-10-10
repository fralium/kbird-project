import { useState, useRef } from 'react';
import Image from 'next/image';
import { api } from '../utils/api';
import { getReadableAiError } from '../utils/aiErrorMessages';
import { compressImagesForUpload } from '../utils/compressImageForUpload';
import styles from '../styles/AIImageUpload.module.css';

/** 压缩后的上传上限（与后端 multer 对齐）；选图时可更大，提交前会压缩 */
const AI_IMAGE_UPLOAD_MAX = 2 * 1024 * 1024; // 2MB
const AI_IMAGE_PICK_MAX = 20 * 1024 * 1024; // 20MB 原图上限

export default function AIImageUpload({ onIdentify, onError, multiple = false, resultContent = null }) {
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState(null);
  const [previews, setPreviews] = useState([]);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [description, setDescription] = useState('');
  const fileInputRef = useRef(null);
  const dragCounter = useRef(0);

  const handleFileSelect = async (files) => {
    const fileArray = Array.from(files || []);
    if (!fileArray.length) return;

    const invalidType = fileArray.find((file) => !String(file.type || '').startsWith('image/'));
    if (invalidType) {
      if (onError) onError('请选择图片文件（JPG / PNG / BMP）');
      return;
    }

    const oversizeOriginal = fileArray.find((file) => file.size > AI_IMAGE_PICK_MAX);
    if (oversizeOriginal) {
      if (onError) onError('单张原图不能超过 20MB，请换一张较小的照片');
      return;
    }

    try {
      const compressed = await compressImagesForUpload(fileArray, {
        maxBytes: AI_IMAGE_UPLOAD_MAX,
        maxEdge: 1920,
      });
      const stillTooBig = compressed.find((file) => file.size > AI_IMAGE_UPLOAD_MAX);
      if (stillTooBig) {
        if (onError) onError('图片压缩后仍超过 2MB，请裁剪或换一张照片');
        return;
      }
      setSelectedFiles(compressed);

      if (multiple) {
        setPreviews(compressed.map((file) => URL.createObjectURL(file)));
      } else {
        setPreview(URL.createObjectURL(compressed[0]));
      }
    } catch (err) {
      if (onError) onError(err?.message || '图片处理失败');
    }
  };

  const handleIdentify = async () => {
    if (selectedFiles.length === 0) {
      if (onError) {
        onError('请先上传图片');
      }
      return;
    }

    setUploading(true);
    
    try {
      if (!localStorage.getItem('token')) {
        throw new Error('请先登录');
      }
      const data = multiple
        ? await api.ai.identifyBatch({ images: selectedFiles, description })
        : await api.ai.identify({ image: selectedFiles[0], description });
      
      if (data.success) {
        if (onIdentify) {
          onIdentify(multiple ? data.data.results : data.data);
        }
      } else {
        throw new Error(data.message || '识别失败');
      }
    } catch (error) {
      console.error('AI识别失败:', error);
      if (onError) {
        onError(getReadableAiError(error?.code, error?.message));
      }
    } finally {
      setUploading(false);
    }
  };

  const handleReset = () => {
    setSelectedFiles([]);
    setPreview(null);
    setPreviews([]);
    setDescription('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleDrop = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (uploading) return;
    dragCounter.current = 0;

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      await handleFileSelect(files);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDragEnter = (e) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current++;
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current--;
    if (dragCounter.current === 0) {
      // 离开拖拽区域
    }
  };

  const handleClick = () => {
    if (uploading) return;
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e) => {
    if (uploading) return;
    const files = e.target.files;
    if (files && files.length > 0) {
      await handleFileSelect(files);
    }
  };

  return (
    <div className={styles.container}>
      <div
        className={`${styles.uploadArea} ${uploading ? styles.uploading : ''}`}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onClick={handleClick}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/jpg,image/png,image/bmp"
          multiple={multiple}
          onChange={handleFileChange}
          className={styles.fileInput}
        />
        
        <div className={styles.uploadContent}>
          <div className={styles.uploadIcon}>📷</div>
          <p className={styles.uploadText}>
            {multiple ? '拖拽多张图片或点击上传' : '拖拽图片或点击上传'}
          </p>
          <p className={styles.uploadHint}>
            支持 PNG、JPG、JPEG、BMP；手机大图会自动压缩后上传
          </p>
        </div>
      </div>

      {/* 预览 */}
      {preview && !multiple && (
        <div className={styles.preview}>
          <Image src={preview} alt="预览" width={720} height={480} unoptimized />
        </div>
      )}

      {previews.length > 0 && multiple && (
        <div className={styles.previews}>
          {previews.map((preview, index) => (
            <div key={index} className={styles.previewItem}>
              <Image
                src={preview}
                alt={`预览 ${index + 1}`}
                width={320}
                height={240}
                unoptimized
              />
            </div>
          ))}
        </div>
      )}

      {selectedFiles.length > 0 && (
        <div className={styles.actionPanel}>
          <label htmlFor="ai-description" className={styles.descriptionLabel}>
            补充描述（可选）
          </label>
          <textarea
            id="ai-description"
            className={styles.descriptionInput}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="例如：拍摄地点、时间、体型、羽色、喙形、行为（如停栖/飞行/觅食）"
            maxLength={300}
            rows={3}
            disabled={uploading}
          />

          <div className={styles.actionButtons}>
            <button
              type="button"
              className={styles.submitButton}
              onClick={handleIdentify}
              disabled={uploading || selectedFiles.length === 0}
            >
              {uploading ? '识别中...' : '提交识别'}
            </button>
            <button
              type="button"
              className={styles.resetButton}
              onClick={handleReset}
              disabled={uploading}
            >
              重新选择
            </button>
          </div>

          {uploading && (
            <div className={styles.identifyingStatus}>
              <div className={styles.spinner}></div>
              <span>AI识别中，请稍候...</span>
            </div>
          )}

          {resultContent && (
            <div className={styles.inlineResult}>
              {resultContent}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
