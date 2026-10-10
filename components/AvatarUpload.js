import { useState, useRef } from 'react';
import Image from 'next/image';
import { api } from '../utils/api';
import styles from '../styles/AvatarUpload.module.css';

export default function AvatarUpload({ currentAvatar, onAvatarChange }) {
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('success');
  const fileInputRef = useRef(null);

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setSelectedFile(file);
      // 创建预览
      const reader = new FileReader();
      reader.onload = (e) => {
        setPreview(e.target.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleUpload = async () => {
    setMessage('');
    if (!selectedFile) {
      setMessageType('error');
      setMessage('请选择头像文件');
      return;
    }

    setUploading(true);
    try {
      const data = await api.users.uploadAvatar(selectedFile);

      if (data.success) {
        onAvatarChange(data.data.avatar);
        setPreview(null);
        setSelectedFile(null);
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
        setMessageType('success');
        setMessage('头像上传成功');
      } else {
        setMessageType('error');
        setMessage(data.message || '头像上传失败');
      }
    } catch (error) {
      console.error('头像上传失败:', error);
      setMessageType('error');
      setMessage('头像上传失败，请重试');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className={styles.avatarUpload}>
      <div className={styles.avatarPreview}>
        {preview ? (
          <Image
            src={preview}
            alt="头像预览"
            width={160}
            height={160}
            className={styles.previewImage}
            unoptimized
          />
        ) : currentAvatar && currentAvatar !== 'default-avatar.jpg' ? (
          <Image 
            src={currentAvatar.startsWith('/images/avatars/') ? currentAvatar : `/images/avatars/${currentAvatar}`}
            alt="当前头像" 
            width={160}
            height={160}
            className={styles.currentImage}
            unoptimized
            onError={(e) => {
              e.target.style.display = 'none';
            }}
          />
        ) : (
          <div className={styles.defaultAvatar}>
            <span>👤</span>
          </div>
        )}
      </div>
      
      <div className={styles.uploadControls}>
        <input
          ref={fileInputRef}
          type="file"
          id="avatar-input"
          accept="image/*"
          onChange={handleFileChange}
          className={styles.fileInput}
        />
        <label htmlFor="avatar-input" className={styles.fileLabel}>
          选择头像
        </label>
        
        {preview && (
          <button 
            onClick={handleUpload} 
            disabled={uploading}
            className={styles.uploadButton}
          >
            {uploading ? '上传中...' : '上传头像'}
          </button>
        )}
      </div>
      
      <p className={styles.uploadTip}>
        支持 JPG、PNG 格式，文件大小不超过 2MB
      </p>
      {message && (
        <p className={`${styles.uploadTip} ${messageType === 'error' ? styles.error : styles.success}`}>
          {message}
        </p>
      )}
    </div>
  );
}
