import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import Navbar from '../../components/Navbar';
import Footer from '../../components/Footer';
import ImageViewer from '../../components/ImageViewer';
import LocationAutocomplete from '../../components/LocationAutocomplete';
import styles from '../../styles/RecordDetail.module.css';

export default function RecordDetail() {
  const router = useRouter();
  const { id } = router.query;
  
  const [record, setRecord] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [imageViewerOpen, setImageViewerOpen] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [currentImages, setCurrentImages] = useState([]);
  
  // 编辑模式状态
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [availableBirds, setAvailableBirds] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  
  // 编辑表单数据
  const [editData, setEditData] = useState({
    title: '',
    description: '',
    location: { name: '', coordinates: [0, 0] },
    date: '',
    notes: '',
    weather: '',
    temperature: '',
    humidity: '',
    wind: '',
    images: [],
    birds: []
  });

  useEffect(() => {
    if (id) {
      fetchRecord();
    }
  }, [id]);

  const fetchRecord = async () => {
    try {
      setLoading(true);
      setError('');

      const response = await fetch(`/api/records/${id}`);
      
      if (response.ok) {
        const data = await response.json();
    if (data.success) {
      setRecord(data.data);
          // 初始化编辑数据
          setEditData({
            title: data.data.title || '',
            description: data.data.description || '',
            location: data.data.location || { name: '', coordinates: [0, 0] },
            date: data.data.date ? new Date(data.data.date).toISOString().split('T')[0] : '',
            notes: data.data.notes || '',
            weather: data.data.weather || '',
            temperature: data.data.temperature || '',
            humidity: data.data.humidity || '',
            wind: data.data.wind || '',
            images: data.data.images || [],
            birds: data.data.birds || []
          });
        } else {
          setError(data.message || '获取记录失败');
        }
      } else {
        setError('获取记录失败');
      }
    } catch (error) {
      console.error('获取记录失败:', error);
      setError('获取记录失败');
    } finally {
      setLoading(false);
    }
  };

  // 进入编辑模式
  const startEditing = () => {
    setIsEditing(true);
    setSuccess(false);
  };

  // 取消编辑
  const cancelEditing = () => {
    setIsEditing(false);
    setError('');
    setSuccess(false);
    // 重置编辑数据
    if (record) {
      setEditData({
        title: record.title || '',
        description: record.description || '',
        location: record.location || { name: '', coordinates: [0, 0] },
        date: record.date ? new Date(record.date).toISOString().split('T')[0] : '',
        notes: record.notes || '',
        weather: record.weather || '',
        temperature: record.temperature || '',
        humidity: record.humidity || '',
        wind: record.wind || '',
        images: record.images || [],
        birds: record.birds || []
      });
    }
  };

  // 搜索鸟类
  const searchBirds = async (query) => {
    if (!query || query.length < 2) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    try {
      const response = await fetch(`/api/birds?search=${encodeURIComponent(query)}&limit=20`);
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setSearchResults(data.data);
        }
      }
    } catch (error) {
      console.error('搜索鸟类失败:', error);
    } finally {
      setIsSearching(false);
    }
  };

  // 添加鸟类到记录
  const addBird = (bird) => {
    // 检查是否已经添加
    if (editData.birds.find(b => b.birdId._id === bird._id)) {
      alert('该鸟类已经添加过了！');
      return;
    }

    setEditData(prev => ({
      ...prev,
      birds: [...prev.birds, {
        birdId: bird,
        notes: '',
        images: [],
        count: 1
      }]
    }));
    setSearchResults([]);
    setSearchTerm('');
  };

  // 移除鸟类
  const removeBird = (birdIndex) => {
    setEditData(prev => ({
      ...prev,
      birds: prev.birds.filter((_, index) => index !== birdIndex)
    }));
  };

  // 更新鸟类备注
  const updateBirdNotes = (birdIndex, notes) => {
    setEditData(prev => ({
      ...prev,
      birds: prev.birds.map((bird, index) => 
        index === birdIndex ? { ...bird, notes } : bird
      )
    }));
  };

  // 更新鸟类数量
  const updateBirdCount = (birdIndex, count) => {
    setEditData(prev => ({
      ...prev,
      birds: prev.birds.map((bird, index) => 
        index === birdIndex ? { ...bird, count: parseInt(count) || 1 } : bird
      )
    }));
  };

  // 处理鸟类图片上传
  const handleBirdImageUpload = async (birdIndex, e) => {
    const files = Array.from(e.target.files);
    
    if (files.length === 0) return;

    // 检查文件大小（10MB限制）
    const maxSize = 10 * 1024 * 1024; // 10MB
    const oversizedFiles = files.filter(file => file.size > maxSize);
    
    if (oversizedFiles.length > 0) {
      alert(`以下文件过大，请选择小于10MB的图片文件：\n${oversizedFiles.map(f => f.name).join('\n')}`);
      e.target.value = ''; // 清空文件输入
      return;
    }

    try {
      // 为每个文件创建FormData
      const uploadPromises = files.map(async (file) => {
        const formData = new FormData();
        formData.append('image', file);
        
        const token = localStorage.getItem('token');
        
        if (!token) {
          throw new Error('未登录，请先登录');
        }
        
        // 直接调用后端API，绕过Next.js代理
        const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002';
        
        const response = await fetch(`${backendUrl}/api/upload/image`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
          },
          body: formData,
        });

        if (response.ok) {
          const data = await response.json();
          return {
            url: data.url || data.data?.url,
            caption: '',
            isNew: true
          };
        } else {
          const errorData = await response.text();
          throw new Error(`上传失败: ${response.status} ${errorData}`);
        }
      });

      // 等待所有文件上传完成
      const uploadedImages = await Promise.all(uploadPromises);
      console.log('上传完成的图片:', uploadedImages);
      
      // 更新状态
      setEditData(prev => {
        const updatedBirds = prev.birds.map((bird, index) => 
          index === birdIndex 
            ? { ...bird, images: [...(bird.images || []), ...uploadedImages] }
            : bird
        );
        console.log('添加新图片后的鸟类数据:', updatedBirds);
        return {
          ...prev,
          birds: updatedBirds
        };
      });

    } catch (error) {
      console.error('图片上传失败:', error);
      setError('图片上传失败，请重试');
    }
  };

  // 删除鸟类图片
  const removeBirdImage = (birdIndex, imageIndex) => {
    setEditData(prev => ({
      ...prev,
      birds: prev.birds.map((bird, index) => 
        index === birdIndex 
          ? { ...bird, images: bird.images.filter((_, imgIdx) => imgIdx !== imageIndex) }
          : bird
      )
    }));
  };

  // 更新鸟类图片说明
  const updateBirdImageCaption = (birdIndex, imageIndex, caption) => {
    setEditData(prev => ({
      ...prev,
      birds: prev.birds.map((bird, index) => 
        index === birdIndex 
          ? { 
              ...bird, 
              images: bird.images.map((img, imgIdx) => 
                imgIdx === imageIndex ? { ...img, caption } : img
              )
            }
          : bird
      )
    }));
  };

  // 处理输入变化
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setEditData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // 处理地点变化
  const handleLocationChange = (location) => {
    setEditData(prev => ({
      ...prev,
      location: location
    }));
  };

  // 保存编辑
  const saveRecord = async () => {
    try {
      setSaving(true);
      setError('');

      const token = localStorage.getItem('token');
      if (!token) {
        setError('请先登录');
        return;
      }

      // 验证必要字段
      if (!editData.title || !editData.location.name || !editData.date || editData.birds.length === 0) {
        setError('请填写标题、地点、日期，并至少添加一个鸟类');
        return;
      }

      // 准备数据
      const updateData = {
        title: editData.title,
        description: editData.description,
        location: editData.location,
        date: new Date(editData.date),
        notes: editData.notes,
        weather: editData.weather,
        temperature: editData.temperature,
        humidity: editData.humidity,
        wind: editData.wind,
        images: editData.images,
        birds: editData.birds.map(bird => ({
          birdId: bird.birdId._id,
          notes: bird.notes,
          images: bird.images ? bird.images.map(img => ({
            url: img.url,
            caption: img.caption || ''
          })) : [],
          count: bird.count || 1
        }))
      };
      

      const response = await fetch(`/api/records/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(updateData),
      });

      const data = await response.json();

      if (data.success) {
        console.log('保存成功，重新获取记录数据...');
        setSuccess(true);
        setIsEditing(false);
        // 重新获取记录数据
        await fetchRecord();
        setTimeout(() => {
          setSuccess(false);
        }, 3000);
      } else {
        setError(data.message || '更新失败');
      }
    } catch (error) {
      console.error('更新记录失败:', error);
      setError('更新失败，请重试');
    } finally {
      setSaving(false);
    }
  };

  const openImageViewer = (images, index = 0) => {
    setCurrentImages(images);
    setCurrentImageIndex(index);
    setImageViewerOpen(true);
  };

  const closeImageViewer = () => {
    setImageViewerOpen(false);
    setCurrentImages([]);
    setCurrentImageIndex(0);
  };

  if (loading) {
    return (
      <div className={styles.container}>
        <Navbar />
        <main className={styles.main}>
          <div className={styles.loadingContainer}>
            <p>加载中...</p>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.container}>
        <Navbar />
        <main className={styles.main}>
          <div className={styles.errorContainer}>
            <h2>错误</h2>
            <p>{error}</p>
            <Link href="/records" className={styles.backButton}>
              返回记录列表
            </Link>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  if (!record) {
    return (
      <div className={styles.container}>
        <Navbar />
        <main className={styles.main}>
          <div className={styles.errorContainer}>
            <h2>记录不存在</h2>
            <p>您要查看的观鸟记录不存在或已被删除</p>
            <Link href="/records" className={styles.backButton}>
              返回记录列表
            </Link>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <Head>
        <title>{record.title} - KBird</title>
        <meta name="description" content={record.description || `观鸟记录：${record.title}`} />
      </Head>

      <Navbar />

      <main className={styles.main}>
        {/* 面包屑导航 */}
        <nav className={styles.breadcrumb}>
          <Link href="/records">观鸟记录</Link>
          <span className={styles.separator}>/</span>
          <span className={styles.current}>{record.title}</span>
        </nav>

        {/* 记录头部 */}
        <header className={styles.recordHeader}>
          <div className={styles.headerContent}>
            <h1 className={styles.recordTitle}>{record.title}</h1>
            <div className={styles.recordMeta}>
              <div className={styles.metaItem}>
                <span className={styles.metaIcon}>📅</span>
                <span className={styles.metaText}>
                  {new Date(record.date).toLocaleDateString('zh-CN', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                    weekday: 'long'
                  })}
                </span>
              </div>
              <div className={styles.metaItem}>
                <span className={styles.metaIcon}>🐦</span>
                <span className={styles.metaText}>{record.birds.length} 种鸟类</span>
              </div>
              <div className={styles.metaItem}>
                <span className={styles.metaIcon}>👤</span>
                <span className={styles.metaText}>{record.observer.name}</span>
              </div>
            </div>
          </div>
          
          <div className={styles.headerActions}>
            {!isEditing && (
              <button onClick={startEditing} className={styles.editButton}>
                编辑记录
              </button>
            )}
            <Link href="/records" className={styles.backButton}>
              ← 返回列表
            </Link>
          </div>
        </header>

        {/* 成功消息 */}
        {success && (
          <div className={styles.successMessage}>
            <p>✅ 记录更新成功！</p>
          </div>
        )}

        {/* 错误消息 */}
        {error && (
          <div className={styles.errorMessage}>
            <p>❌ {error}</p>
          </div>
        )}

        {/* 编辑表单 */}
        {isEditing && (
          <div className={styles.editForm}>
            <div className={styles.editFormHeader}>
              <h2>编辑观鸟记录</h2>
              <div className={styles.editActions}>
                <button 
                  onClick={cancelEditing} 
                  className={styles.cancelButton}
                  disabled={saving}
                >
                  取消
                </button>
                <button 
                  onClick={saveRecord} 
                  className={styles.saveButton}
                  disabled={saving}
                >
                  {saving ? '保存中...' : '保存'}
                </button>
              </div>
            </div>

            <form className={styles.form}>
              {/* 基本信息 */}
              <div className={styles.formSection}>
                <h3>基本信息</h3>
                
                <div className={styles.formGroup}>
                  <label htmlFor="title">记录标题 *</label>
                  <input
                    type="text"
                    id="title"
                    name="title"
                    value={editData.title}
                    onChange={handleInputChange}
                    className={styles.input}
                    required
                  />
                </div>

                <div className={styles.formGroup}>
                  <label htmlFor="description">描述</label>
                  <textarea
                    id="description"
                    name="description"
                    value={editData.description}
                    onChange={handleInputChange}
                    placeholder="描述这次观鸟活动..."
                    rows="3"
                    className={styles.textarea}
                  />
                </div>

                <div className={styles.formGroup}>
                  <label htmlFor="location">观察地点 *</label>
                  <LocationAutocomplete
                    value={editData.location.name}
                    onChange={handleLocationChange}
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
                    value={editData.date}
                    onChange={handleInputChange}
                    className={styles.input}
                    required
                  />
                </div>
              </div>

              {/* 环境信息 */}
              <div className={styles.formSection}>
                <h3>环境信息</h3>
                
                <div className={styles.formRow}>
                  <div className={styles.formGroup}>
                    <label htmlFor="weather">天气</label>
                    <input
                      type="text"
                      id="weather"
                      name="weather"
                      value={editData.weather}
                      onChange={handleInputChange}
                      placeholder="如：晴天、多云、小雨等"
                      className={styles.input}
                    />
                  </div>

                  <div className={styles.formGroup}>
                    <label htmlFor="temperature">温度</label>
                    <input
                      type="number"
                      id="temperature"
                      name="temperature"
                      value={editData.temperature}
                      onChange={handleInputChange}
                      placeholder="℃"
                      className={styles.input}
                    />
                  </div>

                  <div className={styles.formGroup}>
                    <label htmlFor="humidity">湿度</label>
                    <input
                      type="number"
                      id="humidity"
                      name="humidity"
                      value={editData.humidity}
                      onChange={handleInputChange}
                      placeholder="%"
                      className={styles.input}
                    />
                  </div>

                  <div className={styles.formGroup}>
                    <label htmlFor="wind">风力</label>
                    <input
                      type="text"
                      id="wind"
                      name="wind"
                      value={editData.wind}
                      onChange={handleInputChange}
                      placeholder="如：微风、3级风等"
                      className={styles.input}
                    />
                  </div>
                </div>
              </div>

              {/* 鸟类管理 */}
              <div className={styles.formSection}>
                <h3>观察到的鸟类 *</h3>
                
                {/* 鸟类搜索 */}
                <div className={styles.birdSearch}>
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => {
                      setSearchTerm(e.target.value);
                      if (e.target.value.length >= 2) {
                        searchBirds(e.target.value);
                      }
                    }}
                    placeholder="搜索鸟类名称或学名..."
                    className={styles.searchInput}
                  />
                  
                  {searchResults.length > 0 && (
                    <div className={styles.searchResults}>
                      {searchResults.map(bird => (
                        <div
                          key={bird._id}
                          className={styles.birdOption}
                          onClick={() => addBird(bird)}
                        >
                          <div className={styles.birdInfo}>
                            <h4>{bird.name}</h4>
                            <p>{bird.scientificName}</p>
                          </div>
                          <button type="button" className={styles.addButton}>+</button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* 已选择的鸟类 */}
                <div className={styles.selectedBirds}>
                  <h4>已选择的鸟类 ({editData.birds.length})</h4>
                  {editData.birds.length === 0 ? (
                    <div className={styles.emptyState}>
                      <p>还没有选择任何鸟类</p>
                      <p>在上方搜索框中搜索并添加鸟类</p>
                    </div>
                  ) : (
                    <div className={styles.birdList}>
                      {editData.birds.map((bird, index) => (
                        <div key={index} className={styles.birdCard}>
                          <div className={styles.birdHeader}>
                            <div className={styles.birdInfo}>
                              <h4>{bird.birdId.name}</h4>
                              <p>{bird.birdId.scientificName}</p>
                            </div>
                            <button
                              type="button"
                              onClick={() => removeBird(index)}
                              className={styles.removeBird}
                            >
                              移除
                            </button>
                          </div>
                          
                          <div className={styles.birdDetails}>
                            <div className={styles.formGroup}>
                              <label>数量</label>
                              <input
                                type="number"
                                value={bird.count || 1}
                                onChange={(e) => updateBirdCount(index, e.target.value)}
                                min="1"
                                className={styles.countInput}
                              />
                            </div>
                            
                            <div className={styles.formGroup}>
                              <label>观察备注</label>
                              <textarea
                                value={bird.notes}
                                onChange={(e) => updateBirdNotes(index, e.target.value)}
                                placeholder="添加观察备注..."
                                className={styles.birdNotes}
                                rows="2"
                              />
                            </div>
                          </div>
                          
                          {/* 鸟类图片管理 */}
                          <div className={styles.birdImagesSection}>
                            <label>鸟类照片</label>
                            
                            {/* 图片上传按钮 */}
                            <div className={styles.imageUploadArea}>
                              <input
                                type="file"
                                id={`bird-images-${index}`}
                                accept="image/*"
                                multiple
                                onChange={(e) => handleBirdImageUpload(index, e)}
                                className={styles.hiddenFileInput}
                              />
                              <label 
                                htmlFor={`bird-images-${index}`}
                                className={styles.uploadButton}
                              >
                                📷 添加照片
                              </label>
                            </div>
                            
                            {/* 已上传的图片 */}
                            {bird.images && bird.images.length > 0 && (
                              <div className={styles.birdImageGrid}>
                                {bird.images.map((image, imgIndex) => (
                                  <div key={imgIndex} className={styles.birdImageItem}>
                                    <div className={styles.imageContainer}>
                                      <img 
                                        src={image.url} 
                                        alt={`${bird.birdId.name} 照片 ${imgIndex + 1}`}
                                        className={styles.birdImage}
                                      />
                                      <button
                                        type="button"
                                        onClick={() => removeBirdImage(index, imgIndex)}
                                        className={styles.removeImageButton}
                                        title="删除照片"
                                      >
                                        ✕
                                      </button>
                                    </div>
                                    <input
                                      type="text"
                                      value={image.caption || ''}
                                      onChange={(e) => updateBirdImageCaption(index, imgIndex, e.target.value)}
                                      placeholder="照片说明..."
                                      className={styles.imageCaption}
                                    />
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* 备注 */}
              <div className={styles.formSection}>
                <h3>备注</h3>
                <div className={styles.formGroup}>
                  <textarea
                    id="notes"
                    name="notes"
                    value={editData.notes}
                    onChange={handleInputChange}
                    placeholder="其他观察备注..."
                    rows="4"
                    className={styles.textarea}
                  />
                </div>
              </div>
            </form>
          </div>
        )}

        {/* 记录内容 */}
        <div className={styles.recordContent}>
          {/* 描述 */}
          {record.description && (
            <section className={styles.descriptionSection}>
              <h2 className={styles.sectionTitle}>观察描述</h2>
              <p className={styles.description}>{record.description}</p>
            </section>
          )}

          {/* 环境信息 */}
          {(record.weather || record.temperature || record.humidity || record.wind) && (
            <section className={styles.environmentSection}>
              <h2 className={styles.sectionTitle}>环境信息</h2>
              <div className={styles.environmentGrid}>
                {record.weather && (
                  <div className={styles.environmentItem}>
                    <span className={styles.environmentLabel}>天气</span>
                    <span className={styles.environmentValue}>{record.weather}</span>
                  </div>
                )}
                {record.temperature && (
                  <div className={styles.environmentItem}>
                    <span className={styles.environmentLabel}>温度</span>
                    <span className={styles.environmentValue}>{record.temperature}°C</span>
                  </div>
                )}
                {record.humidity && (
                  <div className={styles.environmentItem}>
                    <span className={styles.environmentLabel}>湿度</span>
                    <span className={styles.environmentValue}>{record.humidity}%</span>
                  </div>
                )}
                {record.wind && (
                  <div className={styles.environmentItem}>
                    <span className={styles.environmentLabel}>风力</span>
                    <span className={styles.environmentValue}>{record.wind}</span>
                  </div>
                )}
              </div>
            </section>
          )}

          {/* 鸟类列表 */}
          <section className={styles.birdsSection}>
            <h2 className={styles.sectionTitle}>观察到的鸟类</h2>
            <div className={styles.birdsGrid}>
              {record.birds.map((bird, index) => (
                <div key={index} className={styles.birdCard}>
                  <div className={styles.birdHeader}>
                    <Link href={`/birds/${bird.birdId._id}`} className={styles.birdNameLink}>
                      <h3 className={styles.birdName}>{bird.birdId.name}</h3>
                      <span className={styles.birdScientific}>{bird.birdId.scientificName}</span>
                    </Link>
                  </div>
                  
                  {bird.count > 1 && (
                    <div className={styles.birdCount}>
                      数量: {bird.count}
                    </div>
                  )}
                  
                  {bird.images && bird.images.length > 0 && (
                    <div className={styles.birdImages}>
                      <div className={styles.birdImageGrid}>
                        {bird.images.map((image, imgIndex) => (
                          <div 
                            key={imgIndex}
                            className={styles.birdImageItem}
                            onClick={() => openImageViewer(bird.images, imgIndex)}
                          >
                            <img 
                              src={image.url.startsWith('http') ? image.url : (typeof window !== 'undefined' ? `${window.location.origin}${image.url}` : image.url)}
                              alt={image.caption || bird.birdId.name}
                              className={styles.birdImage}
                              onError={(e) => {
                                console.log('图片加载失败:', image.url);
                                e.target.style.display = 'none';
                                const placeholder = e.target.nextElementSibling;
                                if (placeholder) {
                                  placeholder.style.display = 'flex';
                                }
                              }}
                            />
                            <div 
                              className={styles.imagePlaceholder}
                              style={{ display: 'none' }}
                            >
                              <span>图片加载失败</span>
                              <small>{image.url}</small>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {bird.notes && (
                    <div className={styles.birdNotes}>
                      <p>{bird.notes}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>


          {/* 备注 */}
          {record.notes && (
            <section className={styles.notesSection}>
              <h2 className={styles.sectionTitle}>备注</h2>
              <p className={styles.notes}>{record.notes}</p>
            </section>
          )}
        </div>
      </main>

      <Footer />

      {/* 图片查看器 */}
      {imageViewerOpen && (
        <ImageViewer
          images={currentImages}
          currentIndex={currentImageIndex}
          onClose={closeImageViewer}
        />
      )}
    </div>
  );
}
