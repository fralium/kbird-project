import { useState } from 'react';
import LocationAutocomplete from './LocationAutocomplete';
import styles from '../styles/SingleBirdForm.module.css';

export default function SingleBirdForm({ bird, onSubmit, onCancel }) {
  const [formData, setFormData] = useState({
    location: { name: '', coordinates: [0, 0] },
    date: new Date().toISOString().split('T')[0],
    notes: '',
    weather: '',
    temperature: '',
    humidity: '',
    wind: '',
    birdNotes: '',
    count: 1,
    images: []
  });

  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  // 处理图片上传
  const handleImageUpload = (files) => {
    const newImages = Array.from(files).map(file => ({
      file: file,
      url: URL.createObjectURL(file),
      caption: file.name.split('.')[0]
    }));

    setFormData(prev => ({
      ...prev,
      images: [...prev.images, ...newImages]
    }));
  };

  // 删除图片
  const removeImage = (index) => {
    setFormData(prev => ({
      ...prev,
      images: prev.images.filter((_, i) => i !== index)
    }));
  };

  // 表单验证
  const validateForm = () => {
    const newErrors = {};

    if (!formData.location?.name || !formData.location.name.trim()) {
      newErrors.location = '请选择观察地点';
    }

    if (!formData.date) {
      newErrors.date = '请选择观察日期';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // 提交表单
  const handleSubmit = async (e) => {
    e.preventDefault();
    console.log('SingleBirdForm提交表单，当前formData:', formData);
    
    if (!validateForm()) {
      console.log('表单验证失败');
      return;
    }

    setSubmitting(true);
    try {
      // 准备提交数据
      const submitData = {
        ...formData,
        birdId: bird._id,
        images: formData.images.map(img => ({
          file: img.file,
          caption: img.caption
        }))
      };

      console.log('准备提交的数据:', submitData);
      console.log('调用onSubmit函数');
      await onSubmit(submitData);
      console.log('onSubmit调用完成');
    } catch (error) {
      console.error('SingleBirdForm提交失败:', error);
      console.error('错误堆栈:', error.stack);
    } finally {
      setSubmitting(false);
    }
  };

  // 更新表单数据
  const updateFormData = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h3 className={styles.title}>添加观察记录</h3>
        <div className={styles.birdInfo}>
          <span className={styles.birdName}>{bird.name}</span>
          {bird.scientificName && (
            <span className={styles.scientificName}>{bird.scientificName}</span>
          )}
        </div>
      </div>

      <form onSubmit={handleSubmit} className={styles.form}>
        {/* 观察地点 */}
        <div className={styles.formGroup}>
          <label className={styles.label}>
            观察地点 <span className={styles.required}>*</span>
          </label>
          <LocationAutocomplete
            value={formData.location}
            onChange={(location) => updateFormData('location', location)}
            placeholder="搜索或输入观察地点..."
          />
          {errors.location && (
            <div className={styles.error}>{errors.location}</div>
          )}
        </div>

        {/* 观察日期 */}
        <div className={styles.formGroup}>
          <label className={styles.label}>
            观察日期 <span className={styles.required}>*</span>
          </label>
          <input
            type="date"
            value={formData.date}
            onChange={(e) => updateFormData('date', e.target.value)}
            className={styles.input}
          />
          {errors.date && (
            <div className={styles.error}>{errors.date}</div>
          )}
        </div>

        {/* 天气信息 */}
        <div className={styles.weatherRow}>
          <div className={styles.formGroup}>
            <label className={styles.label}>天气</label>
            <input
              type="text"
              value={formData.weather}
              onChange={(e) => updateFormData('weather', e.target.value)}
              placeholder="如：晴天、多云等"
              className={styles.input}
            />
          </div>
          
          <div className={styles.formGroup}>
            <label className={styles.label}>温度(℃)</label>
            <input
              type="number"
              value={formData.temperature}
              onChange={(e) => updateFormData('temperature', e.target.value)}
              placeholder="25"
              className={styles.input}
            />
          </div>
        </div>

        <div className={styles.weatherRow}>
          <div className={styles.formGroup}>
            <label className={styles.label}>湿度(%)</label>
            <input
              type="number"
              value={formData.humidity}
              onChange={(e) => updateFormData('humidity', e.target.value)}
              placeholder="60"
              className={styles.input}
            />
          </div>
          
          <div className={styles.formGroup}>
            <label className={styles.label}>风力</label>
            <input
              type="text"
              value={formData.wind}
              onChange={(e) => updateFormData('wind', e.target.value)}
              placeholder="如：微风、3-4级风等"
              className={styles.input}
            />
          </div>
        </div>

        {/* 数量 */}
        <div className={styles.formGroup}>
          <label className={styles.label}>观察数量</label>
          <input
            type="number"
            min="1"
            value={formData.count}
            onChange={(e) => updateFormData('count', parseInt(e.target.value) || 1)}
            className={styles.input}
          />
        </div>

        {/* 鸟类备注 */}
        <div className={styles.formGroup}>
          <label className={styles.label}>鸟类备注</label>
          <textarea
            value={formData.birdNotes}
            onChange={(e) => updateFormData('birdNotes', e.target.value)}
            placeholder="描述您观察到的这种鸟类的情况..."
            className={styles.textarea}
            rows={3}
          />
        </div>

        {/* 整体观察记录 */}
        <div className={styles.formGroup}>
          <label className={styles.label}>观察记录</label>
          <textarea
            value={formData.notes}
            onChange={(e) => updateFormData('notes', e.target.value)}
            placeholder="描述本次观察的整体情况..."
            className={styles.textarea}
            rows={3}
          />
        </div>

        {/* 照片上传 */}
        <div className={styles.formGroup}>
          <label className={styles.label}>观察照片</label>
          <input
            type="file"
            multiple
            accept="image/*"
            onChange={(e) => handleImageUpload(e.target.files)}
            className={styles.fileInput}
          />
          
          {formData.images.length > 0 && (
            <div className={styles.imagePreview}>
              {formData.images.map((image, index) => (
                <div key={index} className={styles.imageItem}>
                  <img src={image.url} alt={image.caption} />
                  <div className={styles.imageInfo}>
                    <span className={styles.imageCaption}>{image.caption}</span>
                    <button
                      type="button"
                      onClick={() => removeImage(index)}
                      className={styles.removeImageButton}
                    >
                      删除
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 表单操作按钮 */}
        <div className={styles.formActions}>
          <button
            type="button"
            onClick={onCancel}
            className={styles.cancelButton}
            disabled={submitting}
          >
            取消
          </button>
          <button
            type="submit"
            className={styles.submitButton}
            disabled={submitting}
          >
            {submitting ? '提交中...' : '添加记录'}
          </button>
        </div>
      </form>
    </div>
  );
}
