'use client';
import { useState, useEffect } from 'react';
/* eslint-disable react-hooks/exhaustive-deps */
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import ErrorMessage from '@/components/ErrorMessage';
import LocationMapPicker from '@/components/LocationMapPicker';
import { useAuth } from '@/components/AuthProvider';
import AuthGate from '@/components/AuthGate';
import { api } from '@/utils/api';
import SimplePageHeader from '@/components/SimplePageHeader';
import { useConfirmDialog } from '@/components/ConfirmDialog';
import styles from '@/styles/LocationEdit.module.css';

const HABITAT_OPTIONS = ['湿地', '湖泊', '河流', '水库', '海岸', '滩涂', '森林', '灌丛', '草地', '农田', '城市绿地', '山地', '荒漠'];
const DISTURBANCE_OPTIONS = ['无', '低', '中等', '高', '极高'];
const BEST_BIRDING_TIME_OPTIONS = ['清晨（5:00-8:00）', '上午（8:00-11:00）', '傍晚（16:00-19:00）', '夜间', '全天', '春季', '夏季', '秋季', '冬季'];

const toScalar = (value, fallback = '') => {
  if (Array.isArray(value)) {
    return value.length > 0 ? String(value[0] ?? fallback) : fallback;
  }
  if (value == null) return fallback;
  return String(value);
};

function EditLocationPageContent() {
  const router = useRouter();
  const params = useParams();
  const id = params?.id;
  const { user, loading: authLoading } = useAuth();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const { ask, dialog: confirmDialog } = useConfirmDialog();

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    type: '公园',
    coordinates: {
      latitude: '',
      longitude: '',
    },
    address: {
      province: '',
      city: '',
      district: '',
      street: '',
    },
    environment: {
      habitat: [],
      vegetation: '',
      waterSource: '',
      disturbance: '',
    },
    birding: {
      bestTime: [],
      difficulty: '简单',
      accessibility: '容易到达',
      facilities: '',
    },
    facilities: {
      parking: false,
      restroom: false,
      observationDeck: false,
      trail: false,
      informationBoard: false,
    },
    tags: [],
  });

  const [tagInput, setTagInput] = useState('');

  useEffect(() => {
    if (!id || authLoading) return;
    fetchLocationData();
  }, [id, authLoading]);

  const fetchLocationData = async () => {
    try {
      const data = await api.locations.getById(id);
      if (data.success) {
        const location = data.data;

        let localUser = null;
        if (typeof window !== 'undefined') {
          try {
            localUser = JSON.parse(localStorage.getItem('user') || 'null');
          } catch {
            localUser = null;
          }
        }
        const createdById = location.createdBy?._id?.toString?.() ?? location.createdBy?.toString?.() ?? '';
        const currentUserId =
          user?.id?.toString?.() ??
          user?._id?.toString?.() ??
          localUser?.id?.toString?.() ??
          localUser?._id?.toString?.() ??
          '';
        const isCreator = !!createdById && !!currentUserId && createdById === currentUserId;
        const isAdmin = (user?.role || localUser?.role) === 'admin';
        const hasOwnerInfo = !!createdById;
        if (!isCreator && !isAdmin && hasOwnerInfo) {
          setError('您没有权限编辑此地点');
          setLoading(false);
          return;
        }

        setFormData({
          name: location.name || '',
          description: location.description || '',
          type: toScalar(location.type, '公园'),
          coordinates: {
            latitude: location.coordinates?.coordinates?.[1] || '',
            longitude: location.coordinates?.coordinates?.[0] || '',
          },
          address: {
            province: location.address?.province || '',
            city: location.address?.city || '',
            district: location.address?.district || '',
            street: location.address?.street || location.address?.detail || '',
          },
          environment: {
            habitat: Array.isArray(location.environment?.habitat)
              ? location.environment.habitat
              : location.environment?.habitat
                ? [location.environment.habitat]
                : [],
            vegetation: Array.isArray(location.environment?.vegetation)
              ? location.environment.vegetation.join('、')
              : toScalar(location.environment?.vegetation, ''),
            waterSource: toScalar(location.environment?.waterSource, ''),
            disturbance: toScalar(location.environment?.disturbance, ''),
          },
          birding: {
            bestTime: Array.isArray(location.birding?.bestTime)
              ? location.birding.bestTime
              : Array.isArray(location.birding?.bestSeason)
                ? location.birding.bestSeason
                : location.birding?.bestTime
                  ? [location.birding.bestTime]
                  : location.birding?.bestSeason
                    ? [location.birding.bestSeason]
                    : [],
            difficulty: toScalar(location.birding?.difficulty, '简单'),
            accessibility: (() => {
              const a = location.environment?.accessibility || location.birding?.accessibility || '容易到达';
              const normalized = toScalar(a, '容易到达');
              return normalized === '需要坐船' ? '需要特殊装备' : normalized;
            })(),
            facilities: Array.isArray(location.birding?.facilities)
              ? location.birding.facilities.join('、')
              : toScalar(location.birding?.facilities, ''),
          },
          facilities: {
            parking: location.facilities?.parking || false,
            restroom: location.facilities?.restroom || false,
            observationDeck: location.facilities?.observationDeck || false,
            trail: location.facilities?.trail || false,
            informationBoard: location.facilities?.informationBoard || false,
          },
          tags: location.tags || [],
        });
      } else {
        setError(data.message || '获取地点信息失败');
      }
    } catch (fetchError) {
      console.error('获取地点信息失败:', fetchError);
      setError('获取地点信息失败');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;

    if (name.includes('.')) {
      const [parent, child] = name.split('.');
      setFormData((prev) => ({
        ...prev,
        [parent]: {
          ...prev[parent],
          [child]: type === 'checkbox' ? checked : value,
        },
      }));
    } else {
      setFormData((prev) => ({
        ...prev,
        [name]: type === 'checkbox' ? checked : value,
      }));
    }
  };

  const handleTagAdd = () => {
    if (tagInput.trim() && !formData.tags.includes(tagInput.trim())) {
      setFormData((prev) => ({
        ...prev,
        tags: [...prev.tags, tagInput.trim()],
      }));
      setTagInput('');
    }
  };

  const handleTagRemove = (tagToRemove) => {
    setFormData((prev) => ({
      ...prev,
      tags: prev.tags.filter((tag) => tag !== tagToRemove),
    }));
  };

  const handleBestTimeChange = (e) => {
    const selectedValues = Array.from(e.target.selectedOptions || []).map((option) => option.value);
    setFormData((prev) => ({
      ...prev,
      birding: {
        ...prev.birding,
        bestTime: selectedValues,
      },
    }));
  };

  const handleHabitatChange = (e) => {
    const selectedValues = Array.from(e.target.selectedOptions || []).map((option) => option.value);
    setFormData((prev) => ({
      ...prev,
      environment: {
        ...prev.environment,
        habitat: selectedValues,
      },
    }));
  };

  const handleDeleteLocation = async () => {
    if (deleting || saving) return;
    const ok = await ask({
      message: `确定删除地点「${formData.name || ''}」？删除后不能恢复。`,
    });
    if (!ok) return;
    setDeleting(true);
    setError(null);
    setSuccess(null);
    try {
      const data = await api.locations.delete(id);
      if (data.success) {
        router.push('/locations');
        return;
      }
      setError(data.message || '删除失败');
    } catch (deleteError) {
      console.error('删除地点失败:', deleteError);
      setError('删除失败，请重试');
    } finally {
      setDeleting(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const lng = parseFloat(formData.coordinates.longitude);
      const lat = parseFloat(formData.coordinates.latitude);
      if (!Number.isFinite(lng) || !Number.isFinite(lat) || (lng === 0 && lat === 0)) {
        setError('请设置有效的经纬度坐标（可在地图上选点）');
        setSaving(false);
        return;
      }

      const locationData = {
        ...formData,
        coordinates: {
          type: 'Point',
          coordinates: [lng, lat],
        },
      };

      const data = await api.locations.update(id, locationData);
      if (data.success) {
        setSuccess('地点信息更新成功！');
        setTimeout(() => {
          router.push(`/locations/${id}`);
        }, 1500);
      } else {
        setError(data.message || '更新地点信息失败');
      }
    } catch (submitError) {
      console.error('更新地点信息失败:', submitError);
      setError('更新地点信息失败');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className={styles.container}>
        <Navbar />
        <div className={styles.loading}>
          <div className={styles.spinner}></div>
          <p>正在加载地点信息...</p>
        </div>
        <Footer />
      </div>
    );
  }

  if (error && !formData.name) {
    return (
      <div className={styles.container}>
        <Navbar />
        <div className={styles.error}>
          <h1>无法加载地点信息</h1>
          <p>{error}</p>
          <Link href="/locations" className={styles.backButton}>
            ← 返回地点词典
          </Link>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <Navbar />

      <div className={styles.content}>
        <SimplePageHeader
          title="编辑地点"
          description="更新地点资料"
          descriptionVariant="caption"
        />

        {error && <ErrorMessage error={error} onClose={() => setError(null)} />}
        {success && <ErrorMessage error={success} type="success" onClose={() => setSuccess(null)} />}

        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.section}>
            <h2>基本信息</h2>
            <div className={styles.formGrid}>
              <div className={styles.formGroup}>
                <label htmlFor="name">地点名称 *</label>
                <input
                  type="text"
                  id="name"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  required
                  placeholder="请输入地点名称"
                />
              </div>

              <div className={styles.formGroup}>
                <label htmlFor="type">地点类型</label>
                <select id="type" name="type" value={formData.type} onChange={handleChange}>
                  <option value="公园">公园</option>
                  <option value="自然保护区">自然保护区</option>
                  <option value="湿地">湿地</option>
                  <option value="森林">森林</option>
                  <option value="山区">山区</option>
                  <option value="城市">城市</option>
                  <option value="乡村">乡村</option>
                  <option value="海岸">海岸</option>
                  <option value="湖泊">湖泊</option>
                  <option value="河流">河流</option>
                  <option value="其他">其他</option>
                </select>
              </div>
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="description">地点描述</label>
              <textarea
                id="description"
                name="description"
                value={formData.description}
                onChange={handleChange}
                rows="4"
                placeholder="请描述这个地点的特色、观鸟环境等"
              />
            </div>
          </div>

          <div className={styles.section}>
            <h2>地理位置</h2>
            <p style={{ marginBottom: 12, fontSize: 14, color: 'var(--text-muted)'}}>
              使用下方地图：<strong>搜索地名</strong>可自动填坐标，或<strong>在地图上点击/拖拽标记</strong>设置精确位置。经纬度会同步到下方输入框。
            </p>
            <LocationMapPicker
              latitude={formData.coordinates.latitude}
              longitude={formData.coordinates.longitude}
              onCoordinatesChange={({ latitude, longitude }) => {
                setFormData((prev) => ({
                  ...prev,
                  coordinates: {
                    ...prev.coordinates,
                    latitude: latitude !== undefined && latitude !== '' ? String(latitude) : prev.coordinates.latitude,
                    longitude: longitude !== undefined && longitude !== '' ? String(longitude) : prev.coordinates.longitude,
                  },
                }));
              }}
              height="360px"
            />
            <div className={styles.formGrid} style={{ marginTop: 16 }}>
              <div className={styles.formGroup}>
                <label htmlFor="coordinates.latitude">纬度</label>
                <input
                  type="number"
                  id="coordinates.latitude"
                  name="coordinates.latitude"
                  value={formData.coordinates.latitude}
                  onChange={handleChange}
                  step="any"
                  placeholder="例如：30.2741"
                />
              </div>

              <div className={styles.formGroup}>
                <label htmlFor="coordinates.longitude">经度</label>
                <input
                  type="number"
                  id="coordinates.longitude"
                  name="coordinates.longitude"
                  value={formData.coordinates.longitude}
                  onChange={handleChange}
                  step="any"
                  placeholder="例如：120.1551"
                />
              </div>
            </div>

            <div className={styles.formGrid}>
              <div className={styles.formGroup}>
                <label htmlFor="address.province">省份</label>
                <input
                  type="text"
                  id="address.province"
                  name="address.province"
                  value={formData.address.province}
                  onChange={handleChange}
                  placeholder="例如：浙江省"
                />
              </div>

              <div className={styles.formGroup}>
                <label htmlFor="address.city">城市</label>
                <input
                  type="text"
                  id="address.city"
                  name="address.city"
                  value={formData.address.city}
                  onChange={handleChange}
                  placeholder="例如：杭州市"
                />
              </div>
            </div>

            <div className={styles.formGrid}>
              <div className={styles.formGroup}>
                <label htmlFor="address.district">区县</label>
                <input
                  type="text"
                  id="address.district"
                  name="address.district"
                  value={formData.address.district}
                  onChange={handleChange}
                  placeholder="例如：西湖区"
                />
              </div>

              <div className={styles.formGroup}>
                <label htmlFor="address.street">详细地址</label>
                <input
                  type="text"
                  id="address.street"
                  name="address.street"
                  value={formData.address.street}
                  onChange={handleChange}
                  placeholder="例如：西湖风景名胜区"
                />
              </div>
            </div>
          </div>

          <div className={styles.section}>
            <h2>环境信息</h2>
            <div className={styles.formGrid}>
              <div className={styles.formGroup}>
                <label htmlFor="environment.habitat">栖息地类型</label>
                <select
                  id="environment.habitat"
                  name="environment.habitat"
                  value={Array.isArray(formData.environment.habitat) ? formData.environment.habitat : []}
                  onChange={handleHabitatChange}
                  multiple
                >
                  {HABITAT_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                  {(Array.isArray(formData.environment.habitat) ? formData.environment.habitat : [])
                    .filter((item) => item && !HABITAT_OPTIONS.includes(item))
                    .map((legacyValue) => (
                      <option key={`legacy-habitat-${legacyValue}`} value={legacyValue}>
                        {legacyValue}
                      </option>
                    ))}
                </select>
                <p className={styles.fieldHint}>可多选：Windows 按住 Ctrl，Mac 按住 Cmd。</p>
              </div>

              <div className={styles.formGroup}>
                <label htmlFor="environment.vegetation">植被类型</label>
                <input
                  type="text"
                  id="environment.vegetation"
                  name="environment.vegetation"
                  value={formData.environment.vegetation}
                  onChange={handleChange}
                  placeholder="例如：芦苇、柳树、香樟等"
                />
              </div>
            </div>

            <div className={styles.formGrid}>
              <div className={styles.formGroup}>
                <label htmlFor="environment.waterSource">水源（须与系统分类一致）</label>
                <select
                  id="environment.waterSource"
                  name="environment.waterSource"
                  value={['有水源', '无水源', '季节性水源'].includes(formData.environment.waterSource) ? formData.environment.waterSource : '有水源'}
                  onChange={handleChange}
                >
                  <option value="有水源">有水源</option>
                  <option value="无水源">无水源</option>
                  <option value="季节性水源">季节性水源</option>
                </select>
                <p className={styles.fieldHint}>若曾填写湖泊、河流等描述，已自动归为「有水源」；细节可写在上方描述里。</p>
              </div>

              <div className={styles.formGroup}>
                <label htmlFor="environment.disturbance">人为干扰</label>
                <select
                  id="environment.disturbance"
                  name="environment.disturbance"
                  value={
                    DISTURBANCE_OPTIONS.includes(toScalar(formData.environment.disturbance, ''))
                      ? toScalar(formData.environment.disturbance, '')
                      : ''
                  }
                  onChange={handleChange}
                >
                  <option value="">请选择干扰等级</option>
                  {DISTURBANCE_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                  {formData.environment.disturbance &&
                  !DISTURBANCE_OPTIONS.includes(formData.environment.disturbance) ? (
                    <option value={formData.environment.disturbance}>{formData.environment.disturbance}</option>
                  ) : null}
                </select>
              </div>
            </div>
          </div>

          <div className={styles.section}>
            <h2>观鸟信息</h2>
            <div className={styles.formGrid}>
              <div className={styles.formGroup}>
                <label htmlFor="birding.bestTime">最佳观鸟时间</label>
                <select
                  id="birding.bestTime"
                  name="birding.bestTime"
                  value={Array.isArray(formData.birding.bestTime) ? formData.birding.bestTime : []}
                  onChange={handleBestTimeChange}
                  multiple
                >
                  {BEST_BIRDING_TIME_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                  {(Array.isArray(formData.birding.bestTime) ? formData.birding.bestTime : [])
                    .filter((item) => item && !BEST_BIRDING_TIME_OPTIONS.includes(item))
                    .map((legacyValue) => (
                      <option key={`legacy-${legacyValue}`} value={legacyValue}>
                        {legacyValue}
                      </option>
                    ))}
                </select>
                <p className={styles.fieldHint}>可多选：Windows 按住 Ctrl，Mac 按住 Cmd 进行多选。</p>
              </div>

              <div className={styles.formGroup}>
                <label htmlFor="birding.difficulty">观鸟难度</label>
                <select
                  id="birding.difficulty"
                  name="birding.difficulty"
                  value={['简单', '中等', '困难'].includes(toScalar(formData.birding.difficulty, '简单')) ? toScalar(formData.birding.difficulty, '简单') : '简单'}
                  onChange={handleChange}
                >
                  <option value="简单">简单</option>
                  <option value="中等">中等</option>
                  <option value="困难">困难</option>
                </select>
              </div>
            </div>

            <div className={styles.formGrid}>
              <div className={styles.formGroup}>
                <label htmlFor="birding.accessibility">可达性</label>
                <select
                  id="birding.accessibility"
                  name="birding.accessibility"
                  value={
                    ['容易到达', '需要步行', '需要爬山', '需要特殊装备', '限制进入'].includes(formData.birding.accessibility)
                      ? formData.birding.accessibility
                      : '容易到达'
                  }
                  onChange={handleChange}
                >
                  <option value="容易到达">容易到达</option>
                  <option value="需要步行">需要步行</option>
                  <option value="需要爬山">需要爬山</option>
                  <option value="需要特殊装备">需要特殊装备（含乘船等）</option>
                  <option value="限制进入">限制进入</option>
                </select>
              </div>

              <div className={styles.formGroup}>
                <label htmlFor="birding.facilities">观鸟设施</label>
                <input
                  type="text"
                  id="birding.facilities"
                  name="birding.facilities"
                  value={formData.birding.facilities}
                  onChange={handleChange}
                  placeholder="例如：观鸟台、望远镜、解说牌等"
                />
              </div>
            </div>
          </div>

          <div className={styles.section}>
            <h2>设施信息</h2>
            <div className={styles.checkboxGrid}>
              <label className={styles.checkboxLabel}>
                <input type="checkbox" name="facilities.parking" checked={formData.facilities.parking} onChange={handleChange} />
                <span className={styles.checkboxText}>停车场</span>
              </label>

              <label className={styles.checkboxLabel}>
                <input type="checkbox" name="facilities.restroom" checked={formData.facilities.restroom} onChange={handleChange} />
                <span className={styles.checkboxText}>洗手间</span>
              </label>

              <label className={styles.checkboxLabel}>
                <input type="checkbox" name="facilities.observationDeck" checked={formData.facilities.observationDeck} onChange={handleChange} />
                <span className={styles.checkboxText}>观景台</span>
              </label>

              <label className={styles.checkboxLabel}>
                <input type="checkbox" name="facilities.trail" checked={formData.facilities.trail} onChange={handleChange} />
                <span className={styles.checkboxText}>步道</span>
              </label>

              <label className={styles.checkboxLabel}>
                <input type="checkbox" name="facilities.informationBoard" checked={formData.facilities.informationBoard} onChange={handleChange} />
                <span className={styles.checkboxText}>信息牌</span>
              </label>
            </div>
          </div>

          <div className={styles.section}>
            <h2>标签</h2>
            <div className={styles.tagSection}>
              <div className={styles.tagInput}>
                <input
                  type="text"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  placeholder="输入标签名称"
                  onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), handleTagAdd())}
                />
                <button type="button" onClick={handleTagAdd} className={styles.addTagButton}>
                  添加
                </button>
              </div>

              <div className={styles.tagsList}>
                {formData.tags.map((tag, index) => (
                  <span key={index} className={styles.tag}>
                    {tag}
                    <button
                      type="button"
                      onClick={() => handleTagRemove(tag)}
                      className={styles.removeTagButton}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            </div>
          </div>

          <div className={styles.submitSection}>
            <div className={styles.submitActions}>
              <button
                type="submit"
                disabled={saving || deleting}
                className={styles.submitButton}
              >
                {saving ? '保存中...' : '保存更改'}
              </button>
              <Link href={`/locations/${id}`} className={styles.cancelButton}>
                取消
              </Link>
            </div>
            <button
              type="button"
              className={styles.deleteButton}
              onClick={handleDeleteLocation}
              disabled={saving || deleting}
            >
              {deleting ? '删除中…' : '删除此地点'}
            </button>
          </div>
        </form>
      </div>

      <Footer />
      {confirmDialog}
    </div>
  );
}

export default function EditLocationPage() {
  return (
    <AuthGate loadingTitle="正在检查登录状态...">
      <EditLocationPageContent />
    </AuthGate>
  );
}
