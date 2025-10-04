import { useState, useRef } from 'react';
import styles from '../styles/AvatarUpload.module.css';

export default function AvatarUpload({ currentAvatar, onAvatarChange }) {
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const fileInputRef = useRef(null);

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    console.log('文件选择事件:', file);
    if (file) {
      console.log('文件信息:', {
        name: file.name,
        size: file.size,
        type: file.type
      });
      setSelectedFile(file);
      // 创建预览
      const reader = new FileReader();
      reader.onload = (e) => {
        setPreview(e.target.result);
      };
      reader.readAsDataURL(file);
    } else {
      console.log('没有选择文件');
    }
  };

  const handleUpload = async () => {
    console.log('开始上传，selectedFile:', selectedFile);
    if (!selectedFile) {
      console.log('没有选择文件，显示警告');
      alert('请选择头像文件');
      return;
    }

    setUploading(true);
    try {
      const token = localStorage.getItem('token');
      console.log('Token:', token ? '存在' : '不存在');
      const formData = new FormData();
      formData.append('avatar', selectedFile);
      console.log('FormData已创建，准备发送请求');

      // 直接访问后端API，绕过Next.js代理
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002'}/api/users/avatar`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        body: formData,
      });

      const data = await response.json();

      if (data.success) {
        onAvatarChange(data.data.avatar);
        setPreview(null);
        setSelectedFile(null);
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
        alert('头像上传成功！');
      } else {
        alert(data.message || '头像上传失败');
      }
    } catch (error) {
      console.error('头像上传失败:', error);
      alert('头像上传失败，请重试');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className={styles.avatarUpload}>
      <div className={styles.avatarPreview}>
        {preview ? (
          <img src={preview} alt="头像预览" className={styles.previewImage} />
        ) : currentAvatar && currentAvatar !== 'default-avatar.jpg' ? (
          <img 
            src={currentAvatar.startsWith('/images/avatars/') ? currentAvatar : `/images/avatars/${currentAvatar}`}
            alt="当前头像" 
            className={styles.currentImage}
            onError={(e) => {
              console.log('头像加载失败:', e.target.src);
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
    </div>
  );
}
