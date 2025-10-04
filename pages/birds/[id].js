import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import Navbar from '../../components/Navbar';
import Footer from '../../components/Footer';
import SingleBirdForm from '../../components/SingleBirdForm';
import CategoryDisplay from '../../components/CategoryDisplay';
import ImageViewer from '../../components/ImageViewer';
import LocationAutocomplete from '../../components/LocationAutocomplete';
import { formatCategory } from '../../utils/formatCategory';
import { useUser } from '../../utils/userContext';
import styles from '../../styles/BirdDetail.module.css';

// 判断字符串是否看起来像文件名
const isFilename = (str) => {
  if (!str || typeof str !== 'string') return false;
  
  // 检查是否包含文件扩展名
  const hasExtension = /\.[a-zA-Z0-9]+$/.test(str);
  
  // 检查是否包含日期格式 (如 20250301)
  const hasDate = /\d{8}|\d{4}-\d{2}-\d{2}/.test(str);
  
  // 检查是否包含相机编号 (如 DSC00231)
  const hasCameraCode = /[A-Z]{2,4}\d{4,}/.test(str);
  
  // 检查是否包含连字符和数字组合 (如 1DSC00231)
  const hasNumberPrefix = /^\d+[A-Z]/.test(str);
  
  // 检查是否只包含数字
  const isOnlyNumbers = /^\d+$/.test(str);
  
  return hasExtension || hasDate || hasCameraCode || hasNumberPrefix || isOnlyNumbers;
};

export default function BirdDetail() {
  const router = useRouter();
  const { id } = router.query;
  const { user } = useUser();
  
  const [bird, setBird] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('info');
  const [showImageUpload, setShowImageUpload] = useState(false);
  const [showSightingForm, setShowSightingForm] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editingImage, setEditingImage] = useState(null);
  const [editingSighting, setEditingSighting] = useState(null);
  const [editFormData, setEditFormData] = useState({});
  const [isFavorited, setIsFavorited] = useState(false);
  const [favoriteLoading, setFavoriteLoading] = useState(false);
  const [showImageViewer, setShowImageViewer] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [showSightingImageViewer, setShowSightingImageViewer] = useState(false);
  const [currentSightingImageIndex, setCurrentSightingImageIndex] = useState(0);
  const [currentSightingImages, setCurrentSightingImages] = useState([]);
  const [locations, setLocations] = useState([]);

  // 获取鸟类数据
  const fetchBirdData = async () => {
    if (!id) return;
    
    try {
      // 并行获取鸟类基本信息和观察记录
      const [birdResponse, sightingsResponse] = await Promise.all([
        fetch(`/api/birds/${id}`),
        fetch(`/api/records/bird/${id}?status=approved,pending`)
      ]);
      
      if (birdResponse.ok) {
        const birdData = await birdResponse.json();
        if (birdData.success) {
          const bird = birdData.data;
          console.log('获取到的鸟类数据:', bird);
          console.log('鸟类图片库数量:', bird.images ? bird.images.length : 0);
          
          // 如果成功获取观察记录，添加到鸟类数据中
          if (sightingsResponse.ok) {
            const sightingsData = await sightingsResponse.json();
            if (sightingsData.success) {
              bird.sightings = sightingsData.data || [];
              console.log('获取到的观察记录数据:', bird.sightings);
              console.log('观察记录数量:', bird.sightings.length);
            } else {
              console.log('获取观察记录失败:', sightingsData);
              bird.sightings = [];
            }
          } else {
            console.log('观察记录API响应失败:', sightingsResponse.status);
            bird.sightings = [];
          }
          
          setBird(bird);
        } else {
          setError(birdData.message || '获取鸟类数据失败');
        }
      } else {
        setError('获取鸟类数据失败');
      }
    } catch (error) {
      console.error('获取鸟类数据失败:', error);
      setError('获取鸟类数据失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!id) return;
    
    let isMounted = true;
    
    
    // 检查用户收藏状态
    const checkFavoriteStatus = async () => {
      const token = localStorage.getItem('token');
      if (token && isMounted) {
        try {
          const response = await fetch('/api/users/favorites', {
            headers: {
              'Authorization': `Bearer ${token}`,
            },
          });
          if (response.ok && isMounted) {
            const data = await response.json();
            const isFavorited = data.data.some(bird => bird._id === id);
            setIsFavorited(isFavorited);
          } else if (response.status === 401 && isMounted) {
            // Token无效，清除本地存储
            localStorage.removeItem('token');
            setIsFavorited(false);
          }
        } catch (error) {
          console.error('检查收藏状态失败:', error);
        }
      }
    };
    
    // 获取地点数据
    const fetchLocations = async () => {
      try {
        const response = await fetch('/api/locations');
        if (response.ok && isMounted) {
          const data = await response.json();
          if (data.success) {
            setLocations(data.data);
          }
        }
      } catch (error) {
        console.error('获取地点列表失败:', error);
      }
    };
    
    // 并行执行数据获取和收藏状态检查
    Promise.all([
      fetchBirdData(),
      checkFavoriteStatus(),
      fetchLocations()
    ]);
    
    return () => {
      isMounted = false;
    };
  }, [id]);

  // 处理图片上传
  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // 检查文件类型
    if (!file.type.startsWith('image/')) {
      setError('请选择图片文件');
      return;
    }

    // 检查文件大小 (10MB限制)
    if (file.size > 10 * 1024 * 1024) {
      setError('图片大小不能超过10MB');
      return;
    }

    setUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('image', file);
      formData.append('caption', `红头长尾山雀 - ${new Date().toLocaleDateString()}`);
      formData.append('location', '用户上传');
      formData.append('date', new Date().toISOString());

      const token = localStorage.getItem('token');
      const response = await fetch(`/api/birds/${id}/images`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        body: formData,
      });

      const data = await response.json();

      if (data.success) {
        // 更新本地状态
        setBird(prevBird => ({
          ...prevBird,
          images: [...prevBird.images, data.data.images[data.data.images.length - 1]]
        }));
        setShowImageUpload(false);
        alert('图片上传成功！');
      } else {
        setError(data.message || '上传失败');
      }
    } catch (error) {
      setError('上传失败，请重试');
    } finally {
      setUploading(false);
    }
  };

  // 处理观察记录添加
  const handleAddSighting = async (formData) => {
    console.log('handleAddSighting被调用，接收到的数据:', formData);
    try {
      const token = localStorage.getItem('token');
      const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002';
      
      if (!token) {
        alert('请先登录');
        return;
      }
      
      // 处理图片上传
      let uploadedImages = [];
      if (formData.images && formData.images.length > 0) {
        console.log('开始上传图片，文件数量:', formData.images.length);
        
        for (const image of formData.images) {
          if (image.file) {
            console.log('上传文件:', image.file.name);
            const formDataForUpload = new FormData();
            formDataForUpload.append('image', image.file);
            
            // 直接调用后端上传API
            const imageResponse = await fetch(`${backendUrl}/api/upload/image`, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${token}`,
              },
              body: formDataForUpload,
            });
            
            if (!imageResponse.ok) {
              console.error('图片上传HTTP错误:', imageResponse.status, imageResponse.statusText);
              const errorText = await imageResponse.text();
              console.error('错误详情:', errorText);
              throw new Error(`图片上传失败: ${imageResponse.status} ${imageResponse.statusText}`);
            }
            
            const imageData = await imageResponse.json();
            console.log('图片上传响应:', imageData);
            
            if (imageData.success) {
              uploadedImages.push({
                url: imageData.url || imageData.data?.url,
                caption: image.caption
              });
            } else {
              console.error('图片上传失败:', imageData.message);
              throw new Error(`图片上传失败: ${imageData.message}`);
            }
          }
        }
        
        console.log('所有上传的图片:', uploadedImages);
      }
      
      console.log('图片上传完成，开始获取用户信息');
      
      // 获取当前用户信息
      const userResponse = await fetch(`${backendUrl}/api/users/profile`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      
      let currentUser = null;
      if (userResponse.ok) {
        const userData = await userResponse.json();
        currentUser = userData.data;
        console.log('获取到用户信息:', currentUser);
      } else {
        console.log('获取用户信息失败:', userResponse.status);
      }
      
      console.log('开始创建Record数据');
      
      // 使用新的Record模型创建观察记录
      const recordData = {
        title: `${formData.location.name}观鸟记录`,
        location: formData.location,
        date: formData.date,
        observer: currentUser ? currentUser._id : null,
        notes: formData.notes,
        weather: formData.weather || '',
        temperature: formData.temperature || null,
        humidity: formData.humidity || null,
        wind: formData.wind || '',
        status: 'pending',
        birds: [{
          birdId: id,
          notes: formData.birdNotes || '',
          images: uploadedImages || [],
          count: formData.count || 1
        }]
      };
      
      // 调用Record API
      console.log('准备创建Record:', recordData);
      console.log('使用token:', token ? '存在' : '不存在');
      
      const response = await fetch(`${backendUrl}/api/records`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(recordData),
      });

      console.log('Record API响应状态:', response.status);
      const data = await response.json();
      console.log('Record API响应数据:', data);

      if (data.success) {
        // Record创建成功，刷新鸟类数据以显示新的观察记录
        console.log('记录创建成功，开始刷新鸟类数据');
        
        // 清除可能的缓存，确保获取最新数据
        const birdCacheKey = `/api/birds/${id}`;
        const sightingsCacheKey = `/api/records/bird/${id}?status=approved,pending`;
        
        // 强制刷新数据
        await fetchBirdData();
        console.log('鸟类数据刷新完成');
        setShowSightingForm(false);
        alert('观察记录添加成功！');
      } else {
        console.log('记录创建失败:', data);
        setError(data.message || '添加失败');
      }
    } catch (error) {
      console.error('handleAddSighting发生错误:', error);
      console.error('错误堆栈:', error.stack);
      setError('添加失败，请重试: ' + error.message);
    } finally {
      console.log('handleAddSighting执行完成');
    }
  };

  // 处理收藏功能
  const handleFavorite = async () => {
    const token = localStorage.getItem('token');
    if (!token) {
      if (typeof window !== 'undefined' && window.showToast) {
        window.showToast('请先登录', 'warning', 3000);
      }
      return;
    }

    setFavoriteLoading(true);
    try {
      const method = isFavorited ? 'DELETE' : 'POST';
      const response = await fetch(`/api/users/favorites/${id}`, {
        method,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();

      if (data.success) {
        setIsFavorited(!isFavorited);
        // 使用Toast通知替代alert
        if (typeof window !== 'undefined' && window.showToast) {
          window.showToast(
            isFavorited ? '🪶 已从收藏中移除' : '🪶 已添加到收藏',
            'success',
            2500
          );
        }
      } else {
        if (typeof window !== 'undefined' && window.showToast) {
          window.showToast(data.message || '操作失败', 'error', 3000);
        }
      }
    } catch (error) {
      if (typeof window !== 'undefined' && window.showToast) {
        window.showToast('操作失败，请重试', 'error', 3000);
      }
    } finally {
      setFavoriteLoading(false);
    }
  };

  // 处理图片查看器
  const handleImageClick = (index) => {
    setCurrentImageIndex(index);
    setShowImageViewer(true);
  };

  const handleCloseImageViewer = () => {
    setShowImageViewer(false);
  };

  // 处理观察记录图片点击
  const handleSightingImageClick = (sightingIndex, imageIndex, images) => {
    setCurrentSightingImageIndex(imageIndex);
    setCurrentSightingImages(images);
    setShowSightingImageViewer(true);
  };

  // 关闭观察记录图片查看器
  const handleCloseSightingImageViewer = () => {
    setShowSightingImageViewer(false);
    setCurrentSightingImages([]);
  };

  // 处理图片编辑
  const handleEditImage = (image, index) => {
    const token = localStorage.getItem('token');
    if (!token) {
      alert('请先登录才能编辑图片信息');
      return;
    }
    
    setEditingImage({ ...image, index });
    setEditFormData({
      caption: image.caption,
      location: image.location,
      date: new Date(image.date).toISOString().split('T')[0]
    });
  };

  // 处理图片删除
  const handleDeleteImage = async (index) => {
    if (!confirm('确定要删除这张图片吗？')) return;

    try {
      const token = localStorage.getItem('token');
      
      if (!token) {
        alert('请先登录');
        return;
      }

      console.log('删除图片请求:', {
        birdId: id,
        imageIndex: index,
        token: token ? '存在' : '不存在'
      });

      const response = await fetch(`/api/birds/${id}/images/${index}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      console.log('删除图片响应状态:', response.status);
      const data = await response.json();
      console.log('删除图片响应数据:', data);

      if (data.success) {
        setBird(prevBird => ({
          ...prevBird,
          images: prevBird.images.filter((_, i) => i !== index)
        }));
        alert('图片删除成功！');
      } else {
        alert('删除失败：' + (data.message || '未知错误'));
        setError(data.message || '删除失败');
      }
    } catch (error) {
      console.error('删除图片错误:', error);
      alert('删除失败，请重试：' + error.message);
      setError('删除失败，请重试');
    }
  };

  // 处理观察记录编辑
  const handleEditSighting = (sighting, index) => {
    setEditingSighting({ ...sighting, index });
    setEditFormData({
      location: sighting.location.name,
      coordinates: sighting.location.coordinates,
      date: new Date(sighting.date).toISOString().split('T')[0],
      notes: sighting.notes
    });
  };

  // 处理观察记录删除
  const handleDeleteSighting = async (index) => {
    try {
      const token = localStorage.getItem('token');
      
      if (!token) {
        alert('请先登录');
        return;
      }

      // 获取要删除的观察记录信息
      const sightingToDelete = bird.sightings[index];
      if (!sightingToDelete || !sightingToDelete.recordId) {
        alert('观察记录信息不完整，无法删除');
        return;
      }

      // 获取Record信息以检查是否包含其他鸟类
      const recordResponse = await fetch(`/api/records/${sightingToDelete.recordId}`);
      let recordInfo = null;
      let otherBirdsInRecord = [];
      
      if (recordResponse.ok) {
        const recordData = await recordResponse.json();
        if (recordData.success) {
          recordInfo = recordData.data;
          // 检查Record中是否包含其他鸟类
          otherBirdsInRecord = recordInfo.birds.filter(birdInRecord => 
            birdInRecord.birdId._id !== id
          );
        }
      }

      // 根据情况显示不同的确认对话框
      let confirmMessage;
      if (otherBirdsInRecord.length > 0) {
        const otherBirdNames = otherBirdsInRecord.map(bird => bird.birdId.name).join('、');
        confirmMessage = `此观察记录还包含其他鸟类：${otherBirdNames}\n\n确定要从该记录中删除 ${bird.name} 的观察吗？\n\n注意：只会删除 ${bird.name} 的部分，其他鸟类的观察记录将保留。`;
      } else {
        confirmMessage = `确定要删除 ${bird.name} 的这条观察记录吗？\n\n注意：这将删除整个观察记录。`;
      }

      if (!confirm(confirmMessage)) return;

      console.log('删除观察记录请求:', {
        birdId: id,
        sightingIndex: index,
        recordId: sightingToDelete.recordId,
        token: token ? '存在' : '不存在',
        hasOtherBirds: otherBirdsInRecord.length > 0
      });

      // 使用新的API端点：只删除该鸟类，保留其他鸟类
      const response = await fetch(`/api/records/${sightingToDelete.recordId}/bird/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}), // 发送空的JSON对象
      });

      console.log('删除观察记录响应状态:', response.status);
      
      // 检查响应是否为JSON
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        const text = await response.text();
        console.log('非JSON响应:', text);
        throw new Error(`服务器返回了非JSON响应: ${text}`);
      }
      
      const data = await response.json();
      console.log('删除观察记录响应数据:', data);

      if (data.success) {
        // 从本地状态中移除该观察记录
        setBird(prevBird => ({
          ...prevBird,
          sightings: prevBird.sightings.filter((_, i) => i !== index)
        }));
        
        // 根据删除结果显示不同的提示
        if (data.deletedEntireRecord) {
          alert('观察记录删除成功！（记录中只有一只鸟类）');
        } else {
          alert(`删除成功！已从观察记录中移除 ${bird.name}，记录中还有 ${data.remainingBirds} 种其他鸟类。`);
        }
      } else {
        alert('删除失败：' + (data.message || '未知错误'));
        setError(data.message || '删除失败');
      }
    } catch (error) {
      console.error('删除观察记录错误:', error);
      alert('删除失败，请重试：' + error.message);
      setError('删除失败，请重试');
    }
  };

  // 保存图片编辑
  const handleSaveImageEdit = async (e) => {
    e.preventDefault();
    
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        alert('请先登录');
        return;
      }

      // 准备发送的数据
      const updateData = {
        caption: editFormData.caption || '',
        location: editFormData.location || '',
        date: editFormData.date || new Date().toISOString().split('T')[0],
        url: editingImage.url // 保留原有的URL
      };

      console.log('发送的更新数据:', updateData);
      console.log('使用的token:', token);
      console.log('请求URL:', `/api/birds/${id}/images/${editingImage.index}`);

      const response = await fetch(`/api/birds/${id}/images/${editingImage.index}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(updateData),
      });

      const data = await response.json();
      console.log('API响应状态:', response.status);
      console.log('API响应数据:', data);

      if (data.success) {
        setBird(prevBird => ({
          ...prevBird,
          images: prevBird.images.map((image, index) => 
            index === editingImage.index 
              ? { ...image, ...updateData, date: new Date(updateData.date) }
              : image
          )
        }));
        setEditingImage(null);
        alert('图片信息更新成功！');
      } else {
        console.error('更新失败:', data);
        alert(data.message || '更新失败');
      }
    } catch (error) {
      console.error('更新图片信息失败:', error);
      alert('更新失败，请重试');
    }
  };

  // 保存观察记录编辑
  const handleSaveSightingEdit = async (e) => {
    e.preventDefault();
    
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/birds/${id}/sightings/${editingSighting.index}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          location: {
            name: editFormData.location,
            coordinates: editFormData.coordinates
          },
          date: editFormData.date,
          notes: editFormData.notes
        }),
      });

      const data = await response.json();

      if (data.success) {
        setBird(prevBird => ({
          ...prevBird,
          sightings: prevBird.sightings.map((sighting, index) => 
            index === editingSighting.index 
              ? { 
                  ...sighting, 
                  location: { ...sighting.location, name: editFormData.location },
                  date: new Date(editFormData.date),
                  notes: editFormData.notes
                }
              : sighting
          )
        }));
        setEditingSighting(null);
        alert('观察记录更新成功！');
      } else {
        setError(data.message || '更新失败');
      }
    } catch (error) {
      setError('更新失败，请重试');
    }
  };

  // 处理鸟类删除
  const handleDeleteBird = async () => {
    const confirmMessage = `确定要删除鸟类"${bird.name}"吗？\n\n此操作将永久删除：\n• 鸟类基本信息\n• 所有图片\n• 所有观察记录\n\n此操作不可撤销！`;
    
    if (!confirm(confirmMessage)) return;
    
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/birds/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();

      if (response.ok && data.success) {
        alert('鸟类记录删除成功！');
        // 跳转到鸟类列表页面
        router.push('/birds');
      } else {
        console.error('删除失败:', data);
        setError(data.message || `删除失败 (状态码: ${response.status})`);
      }
    } catch (error) {
      setError('删除失败，请重试');
    }
  };

  if (loading) {
    return (
      <div className={styles.container}>
        <Navbar />
        <div className={styles.loadingContainer}>
          <p>加载中...</p>
        </div>
      </div>
    );
  }

  if (!bird) {
    return (
      <div className={styles.container}>
        <Navbar />
        <div className={styles.errorContainer}>
          <h2>未找到鸟类信息</h2>
          <Link href="/birds" className={styles.backButton}>
            返回鸟类列表
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <Head>
        <title>{bird.name} - KBird 鸟类详情</title>
        <meta name="description" content={`${bird.name}(${bird.scientificName})的详细信息、图片和观察记录`} />
      </Head>

      <Navbar />

      <main className={styles.main}>
        <div className={styles.birdHeader}>
          <div className={styles.birdHeaderContent}>
            <div className={styles.birdTitleSection}>
              <div className={styles.birdTitle}>
                <h1 className={styles.birdName}>{bird.name}</h1>
                <p className={styles.scientificName}>{bird.scientificName}</p>
                <div className={styles.birdMeta}>
                  <span className={styles.category}>{formatCategory(bird.category)}</span>
                  <div className={styles.protectionStatus}>
                    {bird.iucnProtectionLevel && (
                      <span className={styles.iucnStatus}>
                        IUCN: {bird.iucnProtectionLevel}
                      </span>
                    )}
                    {bird.chinaProtectionLevel && bird.chinaProtectionLevel !== '未列入' && (
                      <span className={styles.chinaStatus}>
                        中国: {bird.chinaProtectionLevel}
                      </span>
                    )}
                  </div>
                </div>
              </div>
               <div className={styles.birdActions}>
                 <button 
                   className={`${styles.favoriteButton} ${isFavorited ? styles.favorited : ''}`}
                   onClick={handleFavorite}
                   disabled={favoriteLoading}
                 >
                   {favoriteLoading ? '处理中...' : (isFavorited ? '🪶 已收藏' : '🪶 收藏')}
                 </button>
                 <Link 
                   href={`/birds/edit/${id}`}
                   className={styles.editButton}
                 >
                   ✏️ 编辑
                 </Link>
                 {user?.role === 'admin' && (
                   <button 
                     onClick={handleDeleteBird}
                     className={styles.deleteButton}
                   >
                     🗑️ 删除
                   </button>
                 )}
               </div>
            </div>
          </div>
        </div>

        <div className={styles.tabsContainer}>
          <div className={styles.tabs}>
            <button 
              className={`${styles.tabButton} ${activeTab === 'info' ? styles.active : ''}`}
              onClick={() => setActiveTab('info')}
            >
              基本信息
            </button>
            <button 
              className={`${styles.tabButton} ${activeTab === 'images' ? styles.active : ''}`}
              onClick={() => setActiveTab('images')}
            >
              图片 ({bird.images.length})
            </button>
            <button 
              className={`${styles.tabButton} ${activeTab === 'sightings' ? styles.active : ''}`}
              onClick={() => setActiveTab('sightings')}
            >
              观察记录 ({bird.sightings.length})
            </button>
          </div>
        </div>

        <div className={styles.contentContainer}>
          {activeTab === 'info' && (
            <div className={styles.infoTab}>
              <div className={styles.infoSection}>
                <h2>描述</h2>
                <p>{bird.description}</p>
              </div>
              
              <div className={styles.infoGrid}>
                <div className={styles.infoItem}>
                  <h3>栖息地</h3>
                  <p>{bird.habitat}</p>
                </div>
                <div className={styles.infoItem}>
                  <h3>分布区域</h3>
                  <p>{bird.distribution}</p>
                </div>
                <div className={styles.infoItem}>
                  <h3>保护状态</h3>
                  <div className={styles.protectionDetails}>
                    {bird.iucnProtectionLevel && (
                      <div className={styles.protectionItem}>
                        <strong>IUCN红色名录:</strong> {bird.iucnProtectionLevel}
                      </div>
                    )}
                    {bird.chinaProtectionLevel && (
                      <div className={styles.protectionItem}>
                        <strong>中国保护等级:</strong> {bird.chinaProtectionLevel}
                      </div>
                    )}
                  </div>
                </div>
                <div className={styles.infoItem}>
                  <h3>分类</h3>
                  <CategoryDisplay category={bird.category} variant="default" />
                </div>
              </div>

              <div className={styles.tagsContainer}>
                <h3>标签</h3>
                <div className={styles.tags}>
                  {bird.tags.map((tag, index) => (
                    <span key={index} className={styles.tag}>{tag}</span>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'images' && (
            <div className={styles.imagesTab}>
               <div className={styles.imageGrid}>
                 {bird.images.map((image, index) => (
                   <div key={index} className={styles.imageCard}>
                     {image.url ? (
                       <div 
                         className={styles.imageContainer}
                         onClick={() => handleImageClick(index)}
                       >
                         <img 
                           src={image.url.startsWith('http') ? image.url : (typeof window !== 'undefined' ? `${window.location.origin}${image.url}` : image.url)} 
                           alt={image.caption || bird.name}
                           className={styles.birdImage}
                           onError={(e) => {
                             console.log('图片加载失败:', image.url);
                             console.log('完整URL:', e.target.src);
                             e.target.style.display = 'none';
                             // 找到父容器中的占位符元素
                             const placeholder = e.target.closest('.imageContainer')?.nextElementSibling;
                             if (placeholder) {
                               placeholder.style.display = 'flex';
                             }
                           }}
                           onLoad={() => {
                             console.log('图片加载成功:', image.url);
                           }}
                         />
                         <div className={styles.imageOverlay}>
                           <span className={styles.zoomIcon}>🔍</span>
                         </div>
                       </div>
                     ) : null}
                     <div 
                       className={styles.imagePlaceholder}
                       style={{ display: image.url ? 'none' : 'flex' }}
                     >
                       <div className={styles.placeholderText}>{image.caption || bird.name}</div>
                     </div>
                     <div className={styles.imageInfo}>
                       {image.caption && !isFilename(image.caption) && (
                         <p className={styles.imageCaption}>{image.caption}</p>
                       )}
                       <div className={styles.imageMetadata}>
                         <span>{image.location || '未知地点'}</span>
                         <span>{image.date ? new Date(image.date).toLocaleDateString() : '未知日期'}</span>
                       </div>
                       <div className={styles.photographer}>
                         {image.photographer && image.photographer.avatar && image.photographer.avatar !== 'default-avatar.jpg' ? (
                           <img 
                             src={`${typeof window !== 'undefined' ? window.location.origin : ''}${image.photographer.avatar}`}
                             alt={image.photographer.name}
                             className={styles.userAvatar}
                             onError={(e) => {
                               console.log('头像加载失败:', image.photographer.avatar);
                               e.target.style.display = 'none';
                               e.target.nextElementSibling.style.display = 'flex';
                             }}
                             onLoad={() => {
                               console.log('头像加载成功:', image.photographer.avatar);
                             }}
                           />
                         ) : null}
                         <div 
                           className={styles.avatarPlaceholder}
                           style={{ display: (image.photographer && image.photographer.avatar && image.photographer.avatar !== 'default-avatar.jpg') ? 'none' : 'flex' }}
                         ></div>
                         <span>{image.photographer ? image.photographer.name : '用户上传'}</span>
                       </div>
                       <div className={styles.imageActions}>
                         <button 
                           className={styles.editImageButton}
                           onClick={() => handleEditImage(image, index)}
                         >
                           ✏️ 编辑
                         </button>
                         <button 
                           className={styles.deleteImageButton}
                           onClick={() => handleDeleteImage(index)}
                         >
                           🗑️ 删除
                         </button>
                       </div>
                     </div>
                   </div>
                 ))}
               </div>
              <div className={styles.uploadSection}>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  style={{ display: 'none' }}
                  id="image-upload"
                  disabled={uploading}
                />
                <label htmlFor="image-upload" className={styles.uploadButton}>
                  {uploading ? '上传中...' : '上传新图片'}
                </label>
                {error && <div className={styles.errorMessage}>{error}</div>}
              </div>
            </div>
          )}

          {activeTab === 'sightings' && (
            <div className={styles.sightingsTab}>
              <div className={styles.sightingsList}>
                {bird.sightings.map((sighting, index) => (
                  <div key={index} className={styles.sightingCard}>
                    <div className={styles.sightingHeader}>
                      <div className={styles.sightingLocation}>{sighting.location.name}</div>
                      <div className={styles.sightingDate}>{new Date(sighting.date).toLocaleDateString()}</div>
                    </div>
                    <div className={styles.sightingUser}>
                      {sighting.observer && sighting.observer.avatar && sighting.observer.avatar !== 'default-avatar.jpg' ? (
                        <img 
                          src={`${typeof window !== 'undefined' ? window.location.origin : ''}${sighting.observer.avatar}`}
                          alt={sighting.observer.name}
                          className={styles.userAvatar}
                          onError={(e) => {
                            e.target.style.display = 'none';
                            e.target.nextElementSibling.style.display = 'flex';
                          }}
                        />
                      ) : null}
                      <div 
                        className={styles.avatarPlaceholder}
                        style={{ display: (sighting.observer && sighting.observer.avatar && sighting.observer.avatar !== 'default-avatar.jpg') ? 'none' : 'flex' }}
                      ></div>
                      <span className={styles.userName}>{sighting.observer ? sighting.observer.name : '用户上传'}</span>
                    </div>
                    <div className={styles.sightingBody}>
                      <p className={styles.sightingNotes}>{sighting.notes}</p>
                      {sighting.images.length > 0 && (
                        <div className={styles.sightingImages}>
                          {sighting.images.map((image, imgIndex) => (
                            <div 
                              key={imgIndex} 
                              className={styles.sightingImageContainer}
                              onClick={() => handleSightingImageClick(index, imgIndex, sighting.images)}
                            >
                              {image.url ? (
                                <img 
                                  src={image.url.startsWith('http') ? image.url : (typeof window !== 'undefined' ? `${window.location.origin}${image.url}` : image.url)} 
                                  alt={image.caption || '观察记录图片'}
                                  className={styles.sightingImage}
                                  onError={(e) => {
                                    e.target.style.display = 'none';
                                    const placeholder = e.target.nextElementSibling;
                                    if (placeholder) {
                                      placeholder.style.display = 'flex';
                                    }
                                  }}
                                />
                              ) : null}
                              <div 
                                className={styles.sightingImagePlaceholder}
                                style={{ display: image.url ? 'none' : 'flex' }}
                              >
                                <div className={styles.placeholderText}>{image.caption || 'IMG_1196'}</div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                     <div className={styles.sightingFooter}>
                       <div className={styles.sightingActions}>
                         <button 
                           className={styles.editSightingButton}
                           onClick={() => handleEditSighting(sighting, index)}
                         >
                           ✏️ 编辑
                         </button>
                         <button 
                           className={styles.deleteSightingButton}
                           onClick={() => handleDeleteSighting(index)}
                         >
                           🗑️ 删除
                         </button>
                       </div>
                     </div>
                  </div>
                ))}
              </div>
              <div className={styles.addSightingSection}>
                <button 
                  className={styles.addSightingButton}
                  onClick={() => setShowSightingForm(!showSightingForm)}
                >
                  {showSightingForm ? '取消添加' : '添加观察记录'}
                </button>
                
                {showSightingForm && (
                  <SingleBirdForm 
                    bird={bird}
                    onSubmit={handleAddSighting}
                    onCancel={() => setShowSightingForm(false)}
                  />
                )}
              </div>
            </div>
          )}
         </div>
       </main>

       {/* 编辑图片模态框 */}
       {editingImage && (
         <div className={styles.modalOverlay}>
           <div className={styles.modal}>
             <h3>编辑图片信息</h3>
             <form onSubmit={(e) => handleSaveImageEdit(e)}>
               <div className={styles.formGroup}>
                 <label>图片标题</label>
                 <input
                   type="text"
                   value={editFormData.caption}
                   onChange={(e) => setEditFormData(prev => ({ ...prev, caption: e.target.value }))}
                 />
               </div>
               <div className={styles.formGroup}>
                 <label>拍摄地点</label>
                 <LocationAutocomplete
                   value={editFormData.location}
                   onChange={(value) => setEditFormData(prev => ({ ...prev, location: value }))}
                   placeholder="搜索或选择观鸟地点..."
                 />
               </div>
               <div className={styles.formGroup}>
                 <label>拍摄日期</label>
                 <input
                   type="date"
                   value={editFormData.date}
                   onChange={(e) => setEditFormData(prev => ({ ...prev, date: e.target.value }))}
                 />
               </div>
               <div className={styles.modalActions}>
                 <button type="button" onClick={() => setEditingImage(null)}>取消</button>
                 <button type="submit">保存</button>
               </div>
             </form>
           </div>
         </div>
       )}

       {/* 编辑观察记录模态框 */}
       {editingSighting && (
         <div className={styles.modalOverlay}>
           <div className={styles.modal}>
             <h3>编辑观察记录</h3>
             <form onSubmit={(e) => handleSaveSightingEdit(e)}>
               <div className={styles.formGroup}>
                 <label>观察地点</label>
                 <input
                   type="text"
                   value={editFormData.location}
                   onChange={(e) => setEditFormData(prev => ({ ...prev, location: e.target.value }))}
                 />
               </div>
               <div className={styles.formGroup}>
                 <label>观察日期</label>
                 <input
                   type="date"
                   value={editFormData.date}
                   onChange={(e) => setEditFormData(prev => ({ ...prev, date: e.target.value }))}
                 />
               </div>
               <div className={styles.formGroup}>
                 <label>观察记录</label>
                 <textarea
                   value={editFormData.notes}
                   onChange={(e) => setEditFormData(prev => ({ ...prev, notes: e.target.value }))}
                   rows="4"
                 />
               </div>
               <div className={styles.modalActions}>
                 <button type="button" onClick={() => setEditingSighting(null)}>取消</button>
                 <button type="submit">保存</button>
               </div>
             </form>
           </div>
         </div>
       )}

      {/* 图片查看器 */}
      {showImageViewer && bird.images && (
        <ImageViewer
          images={bird.images}
          currentIndex={currentImageIndex}
          onClose={handleCloseImageViewer}
        />
      )}

      {/* 观察记录图片查看器 */}
      {showSightingImageViewer && currentSightingImages && (
        <ImageViewer
          images={currentSightingImages}
          currentIndex={currentSightingImageIndex}
          onClose={handleCloseSightingImageViewer}
        />
      )}

      <Footer />
    </div>
  );
}