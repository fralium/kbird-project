import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import LocationAutocomplete from './LocationAutocomplete';
import BirdSearchAdder from './BirdSearchAdder';
import SmartBirdAdder from './SmartBirdAdder';
import ImportBirdAdder from './ImportBirdAdder';
import PopularLocations from './PopularLocations';
import { api } from '@/utils/api';
import { isLocationInCatalog } from '@/utils/locationNameMatch';
import { extractLngLatPair } from '@/utils/locationCoords';
import { todayLocalDateKey } from '@/utils/localDate';
import {
  BIRD_OBSERVATION_TAG_OPTIONS,
  normalizeBirdObservationTags,
} from '@/data/birdObservationTags';
import { useConfirmDialog } from './ConfirmDialog';
import styles from '@/styles/MultiBirdForm.module.css';

const normalizeBird = (bird = {}) => ({
  ...bird,
  count: Number.isFinite(Number(bird.count)) ? Number(bird.count) : 1,
  notes: bird.notes || '',
  behaviorTags: normalizeBirdObservationTags(bird.behaviorTags),
  images: Array.isArray(bird.images) ? bird.images : [],
});

const normalizeBirdList = (birds) =>
  Array.isArray(birds) ? birds.map((bird) => normalizeBird(bird)) : [];

export default function MultiBirdForm({ onSubmit, onCancel, initialData = {} }) {
  const { ask, dialog: confirmDialog } = useConfirmDialog();
  const [formData, setFormData] = useState({
    location: initialData.location || { name: '', coordinates: [0, 0] },
    date: initialData.date || todayLocalDateKey(),
    notes: initialData.notes || '',
    weather: initialData.weather || '',
    temperature: initialData.temperature || '',
    humidity: initialData.humidity || '',
    wind: initialData.wind || '',
    effort: {
      startTime: initialData.effort?.startTime || '',
      endTime: initialData.effort?.endTime || '',
      durationMinutes: initialData.effort?.durationMinutes || '',
      distanceKm: initialData.effort?.distanceKm || '',
      observersCount: initialData.effort?.observersCount || '',
      isCompleteChecklist: initialData.effort?.isCompleteChecklist || false,
      observationMethod: initialData.effort?.observationMethod || 'other',
    },
    birds: normalizeBirdList(initialData.birds)
  });

  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [existingLocationNames, setExistingLocationNames] = useState([]);
  const [locationNotInList, setLocationNotInList] = useState(false);
  const initialDataAppliedRef = useRef(false);

  useEffect(() => {
    if (initialDataAppliedRef.current) return;
    if (!initialData || Object.keys(initialData).length === 0) return;

    setFormData((prev) => ({
      ...prev,
      location: initialData.location || prev.location,
      date: initialData.date || prev.date,
      notes: initialData.notes || prev.notes,
      weather: initialData.weather || prev.weather,
      temperature: initialData.temperature || prev.temperature,
      humidity: initialData.humidity || prev.humidity,
      wind: initialData.wind || prev.wind,
      effort: {
        startTime: initialData.effort?.startTime || prev.effort.startTime,
        endTime: initialData.effort?.endTime || prev.effort.endTime,
        durationMinutes: initialData.effort?.durationMinutes || prev.effort.durationMinutes,
        distanceKm: initialData.effort?.distanceKm || prev.effort.distanceKm,
        observersCount: initialData.effort?.observersCount || prev.effort.observersCount,
        isCompleteChecklist: Boolean(
          initialData.effort?.isCompleteChecklist ?? prev.effort.isCompleteChecklist
        ),
        observationMethod: initialData.effort?.observationMethod || prev.effort.observationMethod,
      },
      birds: Array.isArray(initialData.birds) && initialData.birds.length > 0
        ? normalizeBirdList(initialData.birds)
        : prev.birds
    }));

    initialDataAppliedRef.current = true;
  }, [initialData]);

  // 添加鸟类（从搜索组件）
  const handleAddBirdFromSearch = (newBird) => {
    setFormData(prev => ({
      ...prev,
      birds: [...prev.birds, normalizeBird(newBird)]
    }));
  };

  // 删除鸟类
  const removeBird = async (index) => {
    const ok = await ask('从这条记录里去掉这只鸟？尚未保存的填写会一起去掉。');
    if (!ok) return;
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
        i === index ? normalizeBird({ ...bird, [field]: value }) : normalizeBird(bird)
      )
    }));
  };

  const toggleBirdBehaviorTag = (index, tagValue) => {
    setFormData((prev) => ({
      ...prev,
      birds: prev.birds.map((bird, i) => {
        if (i !== index) return normalizeBird(bird);
        const current = normalizeBirdObservationTags(bird.behaviorTags);
        const next = current.includes(tagValue)
          ? current.filter((item) => item !== tagValue)
          : [...current, tagValue];
        return normalizeBird({ ...bird, behaviorTags: next });
      }),
    }));
  };

  // 智能添加鸟类
  const handleSmartAddBirds = (newBirds) => {
    setFormData(prev => ({
      ...prev,
      birds: [...prev.birds, ...normalizeBirdList(newBirds)]
    }));
  };

  // 处理热门地点选择
  const handlePopularLocationSelect = (location) => {
    const coords = extractLngLatPair(location);
    setFormData((prev) => ({
      ...prev,
      location: {
        name: location.name,
        coordinates: coords || [0, 0],
        address: location.address || prev.location?.address || {},
      },
    }));
  };

  // 获取地点名录列表，用于校验当前填写的地点是否存在
  useEffect(() => {
    let cancelled = false;
    const fetchLocations = async () => {
      try {
        const pageSize = 100;
        let page = 1;
        let totalPages = 1;
        const names = [];
        while (page <= totalPages && page <= 200) {
          const res = await api.locations.getAll({
            page: String(page),
            limit: String(pageSize),
          });
          if (cancelled || !res?.success) break;
          const batch = Array.isArray(res.data) ? res.data : [];
          batch.forEach((loc) => {
            const n = (loc.name || '').trim();
            if (n) names.push(n);
          });
          const parsedPages = Number(res.pagination?.totalPages || res.pages || 1);
          totalPages = Number.isFinite(parsedPages) && parsedPages > 0 ? parsedPages : 1;
          if (batch.length === 0) break;
          page += 1;
        }
        if (!cancelled) setExistingLocationNames(names);
      } catch (e) {
        if (!cancelled) setExistingLocationNames([]);
      }
    };
    fetchLocations();
    return () => {
      cancelled = true;
    };
  }, []);

  // 判断当前填写的地点是否在地点名录中
  useEffect(() => {
    const name = (formData.location?.name || '').trim();
    if (!name) {
      setLocationNotInList(false);
      return;
    }
    const exists = isLocationInCatalog(name, existingLocationNames);
    setLocationNotInList(!exists);
  }, [formData.location?.name, existingLocationNames]);

  // 处理鸟类图片上传
  const handleBirdImageUpload = (birdIndex, files) => {
    if (!files || files.length === 0) return;
    const newImages = Array.from(files).map(file => ({
      file: file,
      url: URL.createObjectURL(file),
      caption: file.name.split('.')[0]
    }));

    setFormData((prev) => ({
      ...prev,
      birds: prev.birds.map((bird, i) => {
        if (i !== birdIndex) return normalizeBird(bird);
        const existingImages = Array.isArray(bird.images) ? bird.images : [];
        return normalizeBird({
          ...bird,
          images: [...existingImages, ...newImages],
        });
      }),
    }));
  };

  // 删除鸟类图片
  const removeBirdImage = async (birdIndex, imageIndex) => {
    const ok = await ask('去掉这张照片？');
    if (!ok) return;
    setFormData(prev => ({
      ...prev,
      birds: prev.birds.map((bird, i) => 
        i === birdIndex 
          ? normalizeBird({ ...bird, images: (bird.images || []).filter((_, idx) => idx !== imageIndex) })
          : normalizeBird(bird)
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
      const submitData = {
        ...formData,
        effort: {
          ...formData.effort,
          durationMinutes:
            formData.effort.durationMinutes === '' ? null : Number(formData.effort.durationMinutes),
          distanceKm: formData.effort.distanceKm === '' ? null : Number(formData.effort.distanceKm),
          observersCount:
            formData.effort.observersCount === '' ? null : Number(formData.effort.observersCount),
        },
        birds: formData.birds.map((bird) => {
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
            images: (bird.images || []).map(img => ({
              file: img.file,
              caption: img.caption
            }))
          };
        })
      };

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

  const updateEffortData = (field, value) => {
    setFormData((prev) => ({
      ...prev,
      effort: {
        ...prev.effort,
        [field]: value,
      },
    }));
  };

  return (
    <form onSubmit={handleSubmit} className={styles.form}>
      <section className={styles.formSection} aria-labelledby="mbf-when-where">
        <h3 id="mbf-when-where" className={styles.sectionTitle}>
          何时何地
        </h3>

        <div className={styles.formGroup}>
          <label className={styles.label}>
            观察地点 <span className={styles.required}>*</span>
          </label>
          <LocationAutocomplete
            value={formData.location}
            onChange={(location) => updateFormData('location', location)}
            placeholder="搜索或输入观察地点..."
          />
          {errors.location && <div className={styles.error}>{errors.location}</div>}
          {locationNotInList && formData.location?.name?.trim() && (
            <div className={styles.locationWarning} role="alert">
              <p className={styles.locationWarningText}>
                当前填写的地点「{formData.location.name.trim()}」不在地点词典中，地图可能无法正确显示位置。建议先创建地点后再选择，或从下拉列表选择已有地点。
              </p>
              <Link href="/locations" className={styles.locationWarningLink}>
                去创建地点
              </Link>
            </div>
          )}
          <PopularLocations
            onLocationSelect={handlePopularLocationSelect}
            selectedLocation={formData.location}
          />
        </div>

        <div className={`${styles.formGroup} ${styles.dateGroup}`}>
          <label className={styles.label}>
            观察日期 <span className={styles.required}>*</span>
          </label>
          <input
            type="date"
            value={formData.date}
            onChange={(e) => updateFormData('date', e.target.value)}
            className={styles.input}
          />
          {errors.date && <div className={styles.error}>{errors.date}</div>}
        </div>
      </section>

      <section className={styles.formSection} aria-labelledby="mbf-weather">
        <h3 id="mbf-weather" className={styles.sectionTitle}>
          天气环境
          <span className={styles.optionalTag}>可选</span>
        </h3>
        <div className={styles.weatherRow}>
          <div className={styles.formGroup}>
            <label className={styles.label}>天气</label>
            <input
              type="text"
              value={formData.weather}
              onChange={(e) => updateFormData('weather', e.target.value)}
              placeholder="晴 / 多云 / 小雨"
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
              placeholder="微风、3-4级"
              className={styles.input}
            />
          </div>
        </div>
      </section>

      <section className={styles.formSection} aria-labelledby="mbf-effort">
        <h3 id="mbf-effort" className={styles.sectionTitle}>
          观察努力
          <span className={styles.optionalTag}>可选</span>
        </h3>
        <div className={styles.weatherRow}>
          <div className={styles.formGroup}>
            <label className={styles.label}>开始时间</label>
            <input
              type="datetime-local"
              value={formData.effort.startTime}
              onChange={(e) => updateEffortData('startTime', e.target.value)}
              className={styles.input}
            />
          </div>
          <div className={styles.formGroup}>
            <label className={styles.label}>结束时间</label>
            <input
              type="datetime-local"
              value={formData.effort.endTime}
              onChange={(e) => updateEffortData('endTime', e.target.value)}
              className={styles.input}
            />
          </div>
          <div className={styles.formGroup}>
            <label className={styles.label}>观察时长(分钟)</label>
            <input
              type="number"
              min="0"
              value={formData.effort.durationMinutes}
              onChange={(e) => updateEffortData('durationMinutes', e.target.value)}
              placeholder="90"
              className={styles.input}
            />
          </div>
          <div className={styles.formGroup}>
            <label className={styles.label}>路线距离(km)</label>
            <input
              type="number"
              min="0"
              step="0.1"
              value={formData.effort.distanceKm}
              onChange={(e) => updateEffortData('distanceKm', e.target.value)}
              placeholder="3.5"
              className={styles.input}
            />
          </div>
        </div>
        <div className={styles.weatherRow}>
          <div className={styles.formGroup}>
            <label className={styles.label}>观察人数</label>
            <input
              type="number"
              min="1"
              value={formData.effort.observersCount}
              onChange={(e) => updateEffortData('observersCount', e.target.value)}
              placeholder="2"
              className={styles.input}
            />
          </div>
          <div className={styles.formGroup}>
            <label className={styles.label}>观察方式</label>
            <select
              value={formData.effort.observationMethod}
              onChange={(e) => updateEffortData('observationMethod', e.target.value)}
              className={styles.input}
            >
              <option value="other">其他</option>
              <option value="walk">步行</option>
              <option value="stationary">定点</option>
              <option value="car">车观</option>
            </select>
          </div>
          <div className={styles.formGroup}>
            <label className={styles.label}>完整清单</label>
            <select
              value={formData.effort.isCompleteChecklist ? 'yes' : 'no'}
              onChange={(e) => updateEffortData('isCompleteChecklist', e.target.value === 'yes')}
              className={styles.input}
            >
              <option value="no">否</option>
              <option value="yes">是</option>
            </select>
          </div>
        </div>
      </section>

      <section className={styles.formSection} aria-labelledby="mbf-notes">
        <h3 id="mbf-notes" className={styles.sectionTitle}>
          观察备注
          <span className={styles.optionalTag}>可选</span>
        </h3>
        <div className={styles.formGroup}>
          <label className={styles.srOnly} htmlFor="mbf-notes-input">
            观察备注
          </label>
          <textarea
            id="mbf-notes-input"
            value={formData.notes}
            onChange={(e) => updateFormData('notes', e.target.value)}
            placeholder="本次观察的整体情况…"
            className={styles.textarea}
            rows={3}
          />
        </div>
      </section>

      <section className={styles.formSection} aria-labelledby="mbf-birds">
        <div className={styles.sectionHeader}>
          <h3 id="mbf-birds" className={styles.sectionTitle}>
            鸟种清单
          </h3>
        </div>

        <div className={styles.birdSearchSection}>
          <BirdSearchAdder onAddBird={handleAddBirdFromSearch} existingBirds={formData.birds} />
        </div>

        <div className={styles.smartAddSection}>
          <SmartBirdAdder onAddBirds={handleSmartAddBirds} existingBirds={formData.birds} />
          <ImportBirdAdder onAddBirds={handleSmartAddBirds} existingBirds={formData.birds} />
        </div>

        {errors.birds && <div className={styles.error}>{errors.birds}</div>}

        {formData.birds.map((bird, index) => (
          <div key={index} className={styles.birdCard}>
            <div className={styles.birdHeader}>
              <h4 className={styles.birdTitle}>鸟种 {index + 1}</h4>
              {formData.birds.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeBird(index)}
                  className={styles.removeBirdButton}
                  title="删除此鸟种"
                >
                  ✕
                </button>
              )}
            </div>

            <div className={styles.birdForm}>
              <div className={styles.formGroup}>
                <label className={styles.label}>
                  鸟种 <span className={styles.required}>*</span>
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

              <div className={styles.birdMetaRow}>
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
              </div>

              <div className={styles.formGroup}>
                <label className={styles.label}>观察状态与行为</label>
                <div className={styles.behaviorTagRow} role="group" aria-label="观察状态与行为">
                  {BIRD_OBSERVATION_TAG_OPTIONS.map((opt) => {
                    const selected = normalizeBirdObservationTags(bird.behaviorTags).includes(
                      opt.value
                    );
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        title={opt.hint}
                        aria-pressed={selected}
                        onClick={() => toggleBirdBehaviorTag(index, opt.value)}
                        className={`${styles.behaviorChip} ${
                          selected ? styles.behaviorChipActive : ''
                        }`}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className={styles.formGroup}>
                <label className={styles.label}>备注</label>
                <textarea
                  value={bird.notes}
                  onChange={(e) => updateBird(index, 'notes', e.target.value)}
                  placeholder="此鸟种的观察细节…"
                  className={styles.textarea}
                  rows={2}
                />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.label}>照片</label>
                <input
                  type="file"
                  multiple
                  accept="image/*"
                  onChange={(e) => handleBirdImageUpload(index, e.target.files)}
                  className={styles.fileInput}
                />

                {(bird.images || []).length > 0 && (
                  <div className={styles.imagePreview}>
                    {(bird.images || []).map((image, imgIndex) => (
                      <div key={imgIndex} className={styles.imageItem}>
                        <Image
                          src={image.url}
                          alt={image.caption}
                          width={220}
                          height={140}
                          unoptimized
                        />
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
      </section>

      <div className={styles.formActions}>
        <button type="button" onClick={onCancel} className={styles.cancelButton} disabled={submitting}>
          取消
        </button>
        <button type="submit" className={styles.submitButton} disabled={submitting}>
          {submitting ? '提交中...' : '创建记录'}
        </button>
      </div>
      {confirmDialog}
    </form>
  );
}
