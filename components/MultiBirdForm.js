import { useState, useEffect } from 'react';
import LocationAutocomplete from './LocationAutocomplete';
import BirdSearchAdder from './BirdSearchAdder';
import SmartBirdAdder from './SmartBirdAdder';
import styles from '../styles/MultiBirdForm.module.css';

export default function MultiBirdForm({ onSubmit, onCancel, initialData = {} }) {
  const [formData, setFormData] = useState({
    location: initialData.location || { name: '', coordinates: [0, 0] },
    date: initialData.date || new Date().toISOString().split('T')[0],
    notes: initialData.notes || '',
    weather: initialData.weather || '',
    temperature: initialData.temperature || '',
    humidity: initialData.humidity || '',
    wind: initialData.wind || '',
    birds: initialData.birds || []
  });

  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  // 添加鸟类（从搜索组件）
  const handleAddBirdFromSearch = (newBird) => {
    console.log('MultiBirdForm - 从搜索添加鸟类:', newBird);
    console.log('MultiBirdForm - newBird.bird对象:', newBird.bird);
    console.log('MultiBirdForm - newBird.bird._id:', newBird.bird?._id);
    setFormData(prev => ({
      ...prev,
      birds: [...prev.birds, newBird]
    }));
  };

  // 删除鸟类
  const removeBird = (index) => {
    setFormData(prev => ({
      ...prev,
      birds: prev.birds.filter((_, i) => i !== index)
    }));
  };

  // 更新鸟类信息
  const updateBird = (index, field, value) => {
    setFormData(prev => ({
      ...prev,
      birds: prev.birds.map((bird, i) => 
        i === index ? { ...bird, [field]: value } : bird
      )
    }));
  };

  // 智能添加鸟类
  const handleSmartAddBirds = (newBirds) => {
    console.log('收到智能添加的鸟类数据:', newBirds);
    setFormData(prev => ({
      ...prev,
      birds: [...prev.birds, ...newBirds]
    }));
  };

  // 添加调试：显示当前formData.birds的状态
  useEffect(() => {
    console.log('formData.birds 状态更新:', formData.birds);
  }, [formData.birds]);

  // 处理鸟类图片上传
  const handleBirdImageUpload = (birdIndex, files) => {
    const newImages = Array.from(files).map(file => ({
      file: file,
      url: URL.createObjectURL(file),
      caption: file.name.split('.')[0]
    }));

    updateBird(birdIndex, 'images', [
      ...formData.birds[birdIndex].images,
      ...newImages
    ]);
  };

  // 删除鸟类图片
  const removeBirdImage = (birdIndex, imageIndex) => {
    setFormData(prev => ({
      ...prev,
      birds: prev.birds.map((bird, i) => 
        i === birdIndex 
          ? { ...bird, images: bird.images.filter((_, idx) => idx !== imageIndex) }
          : bird
      )
    }));
  };

  // 表单验证
  const validateForm = () => {
    const newErrors = {};

    // 验证地点
    if (!formData.location?.name || !formData.location.name.trim()) {
      newErrors.location = '请选择观察地点';
    }

    // 验证日期
    if (!formData.date) {
      newErrors.date = '请选择观察日期';
    }

    // 验证鸟类
    if (formData.birds.length === 0) {
      newErrors.birds = '请至少添加一种鸟类';
    } else {
      formData.birds.forEach((bird, index) => {
        if (!bird.bird) {
          newErrors[`bird_${index}`] = '请选择鸟类';
        }
      });
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // 提交表单
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setSubmitting(true);
    try {
      // 准备提交数据
      console.log('MultiBirdForm - 提交前的formData.birds:', formData.birds);
      console.log('MultiBirdForm - formData.birds长度:', formData.birds.length);
      
      const submitData = {
        ...formData,
        birds: formData.birds.map((bird, index) => {
          console.log(`MultiBirdForm - 处理鸟类数据 ${index}:`, bird);
          console.log(`MultiBirdForm - 鸟类 ${index} bird对象:`, bird.bird);
          console.log(`MultiBirdForm - 鸟类 ${index} bird._id:`, bird.bird?._id);
          if (!bird.bird || !bird.bird._id) {
            console.error('MultiBirdForm - 鸟类数据不完整:', bird);
            throw new Error(`鸟类数据不完整: ${JSON.stringify(bird)}`);
          }
          
          return {
            ...bird,
            // 确保birdId字段正确设置
            birdId: bird.bird._id,
            // 移除bird对象，只保留birdId
            bird: undefined,
            // 移除临时URL，只保留文件对象
            images: bird.images.map(img => ({
              file: img.file,
              caption: img.caption
            }))
          };
        })
      };

      console.log('最终提交数据:', submitData);
      await onSubmit(submitData);
    } catch (error) {
      console.error('提交失败:', error);
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
    <form onSubmit={handleSubmit} className={styles.form}>
      <div className={styles.formSection}>
        <h3 className={styles.sectionTitle}>基本信息</h3>
        
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
              placeholder="如：晴天、多云、小雨等"
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

        {/* 观察记录 */}
        <div className={styles.formGroup}>
          <label className={styles.label}>观察记录</label>
          <textarea
            value={formData.notes}
            onChange={(e) => updateFormData('notes', e.target.value)}
            placeholder="请描述本次观察的整体情况..."
            className={styles.textarea}
            rows={3}
          />
        </div>
      </div>

      <div className={styles.formSection}>
        <div className={styles.sectionHeader}>
          <h3 className={styles.sectionTitle}>观察到的鸟类</h3>
        </div>

        {/* 鸟类搜索添加器 */}
        <div className={styles.birdSearchSection}>
          <BirdSearchAdder 
            onAddBird={handleAddBirdFromSearch}
            existingBirds={formData.birds}
          />
        </div>

        {/* 智能添加按钮 */}
        <div className={styles.smartAddSection}>
          <SmartBirdAdder 
            onAddBirds={handleSmartAddBirds}
            existingBirds={formData.birds}
          />
        </div>

        {errors.birds && (
          <div className={styles.error}>{errors.birds}</div>
        )}

        {formData.birds.map((bird, index) => (
          <div key={index} className={styles.birdCard}>
            <div className={styles.birdHeader}>
              <h4 className={styles.birdTitle}>
                鸟类 {index + 1}
              </h4>
              {formData.birds.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeBird(index)}
                  className={styles.removeBirdButton}
                  title="删除此鸟类"
                >
                  ✕
                </button>
              )}
            </div>

            <div className={styles.birdForm}>
              {/* 鸟类信息显示 */}
              <div className={styles.formGroup}>
                <label className={styles.label}>
                  鸟类 <span className={styles.required}>*</span>
                </label>
                <div className={styles.birdInfo}>
                  <div className={styles.birdName}>{bird.bird?.name}</div>
                  {bird.bird?.scientificName && (
                    <div className={styles.scientificName}>{bird.bird.scientificName}</div>
                  )}
                </div>
                {errors[`bird_${index}`] && (
                  <div className={styles.error}>{errors[`bird_${index}`]}</div>
                )}
              </div>

              {/* 数量 */}
              <div className={styles.formGroup}>
                <label className={styles.label}>数量</label>
                <input
                  type="number"
                  min="1"
                  value={bird.count}
                  onChange={(e) => updateBird(index, 'count', parseInt(e.target.value) || 1)}
                  className={styles.input}
                />
              </div>

              {/* 鸟类备注 */}
              <div className={styles.formGroup}>
                <label className={styles.label}>备注</label>
                <textarea
                  value={bird.notes}
                  onChange={(e) => updateBird(index, 'notes', e.target.value)}
                  placeholder="描述此鸟类的观察情况..."
                  className={styles.textarea}
                  rows={2}
                />
              </div>

              {/* 鸟类照片 */}
              <div className={styles.formGroup}>
                <label className={styles.label}>照片</label>
                <input
                  type="file"
                  multiple
                  accept="image/*"
                  onChange={(e) => handleBirdImageUpload(index, e.target.files)}
                  className={styles.fileInput}
                />
                
                {bird.images.length > 0 && (
                  <div className={styles.imagePreview}>
                    {bird.images.map((image, imgIndex) => (
                      <div key={imgIndex} className={styles.imageItem}>
                        <img src={image.url} alt={image.caption} />
                        <div className={styles.imageInfo}>
                          <span className={styles.imageCaption}>{image.caption}</span>
                          <button
                            type="button"
                            onClick={() => removeBirdImage(index, imgIndex)}
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
            </div>
          </div>
        ))}
      </div>

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
          {submitting ? '提交中...' : '创建记录'}
        </button>
      </div>
    </form>
  );
}


