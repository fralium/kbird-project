import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import Navbar from '../../../components/Navbar';
import Footer from '../../../components/Footer';
import ErrorMessage from '../../../components/ErrorMessage';
import { useUser } from '../../../utils/userContext';
import styles from '../../../styles/LocationEdit.module.css';

export default function EditLocation() {
  const router = useRouter();
  const { id } = router.query;
  const { user, isAuthenticated } = useUser();
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    type: '公园',
    coordinates: {
      latitude: '',
      longitude: ''
    },
    address: {
      province: '',
      city: '',
      district: '',
      detail: ''
    },
    environment: {
      habitat: '',
      vegetation: '',
      waterSource: '',
      disturbance: ''
    },
    birding: {
      bestTime: '',
      difficulty: '简单',
      accessibility: '容易到达',
      facilities: ''
    },
    facilities: {
      parking: false,
      restroom: false,
      observationDeck: false,
      trail: false,
      informationBoard: false
    },
    tags: []
  });

  const [tagInput, setTagInput] = useState('');

  useEffect(() => {
    if (!id) return;
    
    // 检查用户认证状态
    if (!isAuthenticated) {
      router.push('/login');
      return;
    }
    
    fetchLocationData();
  }, [id, isAuthenticated]);

  const fetchLocationData = async () => {
    try {
      const response = await fetch(`/api/locations/${id}`);
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          const location = data.data;
          
          // 检查权限：只有创建者可以编辑
          if (location.createdBy._id !== user.id) {
            setError('您没有权限编辑此地点');
            setLoading(false);
            return;
          }
          
          setFormData({
            name: location.name || '',
            description: location.description || '',
            type: location.type || '公园',
            coordinates: {
              latitude: location.coordinates?.coordinates?.[1] || '',
              longitude: location.coordinates?.coordinates?.[0] || ''
            },
            address: {
              province: location.address?.province || '',
              city: location.address?.city || '',
              district: location.address?.district || '',
              detail: location.address?.detail || ''
            },
            environment: {
              habitat: location.environment?.habitat || '',
              vegetation: location.environment?.vegetation || '',
              waterSource: location.environment?.waterSource || '',
              disturbance: location.environment?.disturbance || ''
            },
            birding: {
              bestTime: location.birding?.bestTime || '',
              difficulty: location.birding?.difficulty || '简单',
              accessibility: location.birding?.accessibility || '容易到达',
              facilities: location.birding?.facilities || ''
            },
            facilities: {
              parking: location.facilities?.parking || false,
              restroom: location.facilities?.restroom || false,
              observationDeck: location.facilities?.observationDeck || false,
              trail: location.facilities?.trail || false,
              informationBoard: location.facilities?.informationBoard || false
            },
            tags: location.tags || []
          });
        } else {
          setError(data.message || '获取地点信息失败');
        }
      } else {
        setError('获取地点信息失败');
      }
    } catch (error) {
      console.error('获取地点信息失败:', error);
      setError('获取地点信息失败');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    
    if (name.includes('.')) {
      const [parent, child] = name.split('.');
      setFormData(prev => ({
        ...prev,
        [parent]: {
          ...prev[parent],
          [child]: type === 'checkbox' ? checked : value
        }
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: type === 'checkbox' ? checked : value
      }));
    }
  };

  const handleTagAdd = () => {
    if (tagInput.trim() && !formData.tags.includes(tagInput.trim())) {
      setFormData(prev => ({
        ...prev,
        tags: [...prev.tags, tagInput.trim()]
      }));
      setTagInput('');
    }
  };

  const handleTagRemove = (tagToRemove) => {
    setFormData(prev => ({
      ...prev,
      tags: prev.tags.filter(tag => tag !== tagToRemove)
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const token = localStorage.getItem('token');
      
      const locationData = {
        ...formData,
        coordinates: {
          type: 'Point',
          coordinates: [
            parseFloat(formData.coordinates.longitude) || 0,
            parseFloat(formData.coordinates.latitude) || 0
          ]
        }
      };

      const response = await fetch(`/api/locations/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(locationData),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setSuccess('地点信息更新成功！');
        setTimeout(() => {
          router.push(`/locations/${id}`);
        }, 1500);
      } else {
        setError(data.message || '更新地点信息失败');
      }
    } catch (error) {
      console.error('更新地点信息失败:', error);
      setError('更新地点信息失败');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className={styles.container}>
        <Head>
          <title>加载中... - KBird</title>
        </Head>
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
        <Head>
          <title>错误 - KBird</title>
        </Head>
        <Navbar />
        <div className={styles.error}>
          <h1>无法加载地点信息</h1>
          <p>{error}</p>
          <Link href="/locations" className={styles.backButton}>
            ← 返回地点列表
          </Link>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <Head>
        <title>编辑地点 - {formData.name} - KBird</title>
      </Head>
      <Navbar />
      
      <div className={styles.content}>
        <div className={styles.header}>
          <h1>编辑地点</h1>
          <p>更新地点信息，让更多观鸟爱好者了解这个地点</p>
        </div>

        {error && <ErrorMessage error={error} onClose={() => setError(null)} />}
        {success && <ErrorMessage error={success} type="success" onClose={() => setSuccess(null)} />}

        <form onSubmit={handleSubmit} className={styles.form}>
          {/* 基本信息 */}
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
                <select
                  id="type"
                  name="type"
                  value={formData.type}
                  onChange={handleChange}
                >
                  <option value="公园">公园</option>
                  <option value="湿地">湿地</option>
                  <option value="森林">森林</option>
                  <option value="湖泊">湖泊</option>
                  <option value="山区">山区</option>
                  <option value="海岸">海岸</option>
                  <option value="城市">城市</option>
                  <option value="农田">农田</option>
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

          {/* 地理位置 */}
          <div className={styles.section}>
            <h2>地理位置</h2>
            <div className={styles.formGrid}>
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
                <label htmlFor="address.detail">详细地址</label>
                <input
                  type="text"
                  id="address.detail"
                  name="address.detail"
                  value={formData.address.detail}
                  onChange={handleChange}
                  placeholder="例如：西湖风景名胜区"
                />
              </div>
            </div>
          </div>

          {/* 环境信息 */}
          <div className={styles.section}>
            <h2>环境信息</h2>
            <div className={styles.formGrid}>
              <div className={styles.formGroup}>
                <label htmlFor="environment.habitat">栖息地类型</label>
                <input
                  type="text"
                  id="environment.habitat"
                  name="environment.habitat"
                  value={formData.environment.habitat}
                  onChange={handleChange}
                  placeholder="例如：淡水湿地、森林、草地等"
                />
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
                <label htmlFor="environment.waterSource">水源</label>
                <input
                  type="text"
                  id="environment.waterSource"
                  name="environment.waterSource"
                  value={formData.environment.waterSource}
                  onChange={handleChange}
                  placeholder="例如：湖泊、河流、池塘等"
                />
              </div>
              
              <div className={styles.formGroup}>
                <label htmlFor="environment.disturbance">人为干扰</label>
                <input
                  type="text"
                  id="environment.disturbance"
                  name="environment.disturbance"
                  value={formData.environment.disturbance}
                  onChange={handleChange}
                  placeholder="例如：低、中等、高"
                />
              </div>
            </div>
          </div>

          {/* 观鸟信息 */}
          <div className={styles.section}>
            <h2>观鸟信息</h2>
            <div className={styles.formGrid}>
              <div className={styles.formGroup}>
                <label htmlFor="birding.bestTime">最佳观鸟时间</label>
                <input
                  type="text"
                  id="birding.bestTime"
                  name="birding.bestTime"
                  value={formData.birding.bestTime}
                  onChange={handleChange}
                  placeholder="例如：早晨6-9点，春秋季节"
                />
              </div>
              
              <div className={styles.formGroup}>
                <label htmlFor="birding.difficulty">观鸟难度</label>
                <select
                  id="birding.difficulty"
                  name="birding.difficulty"
                  value={formData.birding.difficulty}
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
                  value={formData.birding.accessibility}
                  onChange={handleChange}
                >
                  <option value="容易到达">容易到达</option>
                  <option value="需要步行">需要步行</option>
                  <option value="需要爬山">需要爬山</option>
                  <option value="需要坐船">需要坐船</option>
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

          {/* 设施信息 */}
          <div className={styles.section}>
            <h2>设施信息</h2>
            <div className={styles.checkboxGrid}>
              <label className={styles.checkboxLabel}>
                <input
                  type="checkbox"
                  name="facilities.parking"
                  checked={formData.facilities.parking}
                  onChange={handleChange}
                />
                <span className={styles.checkboxText}>停车场</span>
              </label>
              
              <label className={styles.checkboxLabel}>
                <input
                  type="checkbox"
                  name="facilities.restroom"
                  checked={formData.facilities.restroom}
                  onChange={handleChange}
                />
                <span className={styles.checkboxText}>洗手间</span>
              </label>
              
              <label className={styles.checkboxLabel}>
                <input
                  type="checkbox"
                  name="facilities.observationDeck"
                  checked={formData.facilities.observationDeck}
                  onChange={handleChange}
                />
                <span className={styles.checkboxText}>观景台</span>
              </label>
              
              <label className={styles.checkboxLabel}>
                <input
                  type="checkbox"
                  name="facilities.trail"
                  checked={formData.facilities.trail}
                  onChange={handleChange}
                />
                <span className={styles.checkboxText}>步道</span>
              </label>
              
              <label className={styles.checkboxLabel}>
                <input
                  type="checkbox"
                  name="facilities.informationBoard"
                  checked={formData.facilities.informationBoard}
                  onChange={handleChange}
                />
                <span className={styles.checkboxText}>信息牌</span>
              </label>
            </div>
          </div>

          {/* 标签 */}
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

          {/* 提交按钮 */}
          <div className={styles.submitSection}>
            <button
              type="submit"
              disabled={saving}
              className={styles.submitButton}
            >
              {saving ? '保存中...' : '保存更改'}
            </button>
            
            <Link href={`/locations/${id}`} className={styles.cancelButton}>
              取消
            </Link>
          </div>
        </form>
      </div>
      
      <Footer />
    </div>
  );
}






