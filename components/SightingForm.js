import { useState, useEffect } from 'react';
import Image from 'next/image';
import LocationAutocomplete from './LocationAutocomplete';
import { todayLocalDateKey } from '@/utils/localDate';
import styles from '@/styles/SightingForm.module.css';

export default function SightingForm({ onSubmit, onCancel }) {
  const [formData, setFormData] = useState({
    location: {
      name: '',
      coordinates: [0, 0]
    },
    date: todayLocalDateKey(),
    notes: '',
    images: []
  });

  const [imageFiles, setImageFiles] = useState([]);
  const [error, setError] = useState('');

  // 清理对象URL，防止内存泄漏
  useEffect(() => {
    return () => {
      formData.images.forEach(image => {
        if (image.url && image.url.startsWith('blob:')) {
          URL.revokeObjectURL(image.url);
        }
      });
    };
  }, [formData.images]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    if (name === 'locationName') {
      setFormData(prev => ({
        ...prev,
        location: {
          ...prev.location,
          name: value
        }
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: value
      }));
    }
  };

  const handleImageChange = (e) => {
    const files = Array.from(e.target.files);
    setError('');
    
    // 检查文件大小
    const maxSize = 10 * 1024 * 1024; // 10MB
    const oversizedFiles = files.filter(file => file.size > maxSize);
    
    if (oversizedFiles.length > 0) {
      setError(`以下文件过大，请选择小于10MB的图片文件：${oversizedFiles.map(f => f.name).join('、')}`);
      e.target.value = ''; // 清空文件输入
      return;
    }
    
    setImageFiles(files);
    
    // 创建图片预览
    const imagePreviews = files.map(file => ({
      url: URL.createObjectURL(file),
      caption: file.name.split('.')[0]
    }));
    
    setFormData(prev => ({
      ...prev,
      images: imagePreviews
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');
    
    if (!formData.location?.name || !formData.location.name.trim()) {
      setError('请输入观察地点');
      return;
    }
    
    if (!formData.notes.trim()) {
      setError('请输入观察记录');
      return;
    }

    // 将图片文件也传递给父组件
    const submitData = {
      ...formData,
      imageFiles: imageFiles
    };

    onSubmit(submitData);
  };

  return (
    <div className={styles.sightingForm}>
      <h3>添加观察记录</h3>
      {error && <div className={styles.errorMessage}>{error}</div>}
      <form onSubmit={handleSubmit}>
        <div className={styles.formGroup}>
          <label htmlFor="locationName">观察地点 *</label>
          <LocationAutocomplete
            value={formData.location}
            onChange={(locationData) => setFormData(prev => ({
              ...prev,
              location: locationData
            }))}
            placeholder="搜索或选择观鸟地点..."
            required={true}
          />
        </div>

        <div className={styles.formGroup}>
          <label htmlFor="date">观察日期 *</label>
          <input
            type="date"
            id="date"
            name="date"
            value={formData.date}
            onChange={handleInputChange}
            required
          />
        </div>

        <div className={styles.formGroup}>
          <label htmlFor="notes">观察记录 *</label>
          <textarea
            id="notes"
            name="notes"
            value={formData.notes}
            onChange={handleInputChange}
            placeholder="请详细描述您的观察情况..."
            rows="4"
            required
          />
        </div>

        <div className={styles.formGroup}>
          <label htmlFor="images">观察照片</label>
          <input
            type="file"
            id="images"
            name="images"
            accept="image/*"
            multiple
            onChange={handleImageChange}
          />
          {formData.images.length > 0 && (
            <div className={styles.imagePreviews}>
              {formData.images.map((image, index) => (
                <div key={index} className={styles.imagePreview}>
                  <Image
                    src={image.url}
                    alt={image.caption}
                    width={220}
                    height={140}
                    unoptimized
                  />
                  <span>{image.caption}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className={styles.formActions}>
          <button type="button" onClick={onCancel} className={styles.cancelButton}>
            取消
          </button>
          <button type="submit" className={styles.submitButton}>
            添加记录
          </button>
        </div>
      </form>
    </div>
  );
}


