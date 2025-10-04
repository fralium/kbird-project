import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Navbar from '../../components/Navbar';
import Footer from '../../components/Footer';
import MultiBirdForm from '../../components/MultiBirdForm';
import styles from '../../styles/AddRecord.module.css';

export default function AddRecord() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      const token = localStorage.getItem('token');
      if (!token) {
        router.push('/login');
        return;
      }

      try {
        const response = await fetch('/api/users/profile', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        if (response.ok) {
          const data = await response.json();
          setUser(data.data);
        } else {
          localStorage.removeItem('token');
          router.push('/login');
        }
      } catch (error) {
        console.error('检查用户认证失败:', error);
        localStorage.removeItem('token');
        router.push('/login');
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, [router]);

  const handleSubmit = async (formData) => {
    try {
      const token = localStorage.getItem('token');
      
      if (!token) {
        alert('请先登录');
        return;
      }
      
      // 处理每个鸟类的图片上传
      const processedBirds = await Promise.all(
        formData.birds.map(async (bird) => {
          let uploadedImages = [];
          
          // 上传该鸟类的所有图片
          if (bird.images && bird.images.length > 0) {
            console.log(`开始上传鸟类 ${bird.birdId?.name || '未知'} 的图片，文件数量:`, bird.images.length);
            
            for (const image of bird.images) {
              if (image.file) {
                console.log('上传文件:', image.file.name);
                const formDataForUpload = new FormData();
                formDataForUpload.append('image', image.file);
                
                // 直接调用后端上传API
                const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002';
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
            
            console.log(`鸟类 ${bird.birdId?.name || '未知'} 所有上传的图片:`, uploadedImages);
          }
          
          return {
            birdId: bird.birdId._id,
            notes: bird.notes || '',
            images: uploadedImages,
            count: bird.count || 1
          };
        })
      );
      
      // 使用新的Record模型创建观察记录
      const recordData = {
        title: `${formData.location.name}观鸟记录`,
        location: formData.location,
        date: formData.date,
        observer: user._id,
        notes: formData.notes,
        weather: formData.weather || '',
        temperature: formData.temperature || null,
        humidity: formData.humidity || null,
        wind: formData.wind || '',
        status: 'pending',
        birds: processedBirds
      };
      
      // 调用Record API
      console.log('准备创建Record:', recordData);
      const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002';
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
        alert(`观鸟记录创建成功！共记录 ${formData.birds.length} 种鸟类`);
        router.push('/records'); // 跳转到记录列表页面
      } else {
        alert('创建失败：' + (data.message || '未知错误'));
      }
    } catch (error) {
      console.error('创建记录失败:', error);
      alert('创建失败，请重试：' + error.message);
    }
  };

  const handleCancel = () => {
    router.back(); // 返回上一页
  };

  if (loading) {
    return (
      <div className={styles.container}>
        <Navbar />
        <main className={styles.main}>
          <div className={styles.loading}>
            <div className={styles.loadingSpinner}></div>
            <p>正在加载...</p>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  if (!user) {
    return null; // 会在useEffect中重定向到登录页
  }

  return (
    <div className={styles.container}>
      <Head>
        <title>添加观鸟记录 - KBird</title>
        <meta name="description" content="添加新的观鸟记录" />
      </Head>

      <Navbar />

      <main className={styles.main}>
        {/* 头部 */}
        <div className={styles.header}>
          <h1 className={styles.title}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="#4CAF50">
                <path d="M12 2C8.5 2 5.73 4.11 5.18 7h3.64c.45-1.25 1.63-2 3.18-2s2.73.75 3.18 2h3.64C18.27 4.11 15.5 2 12 2zM5 9h2v4H5V9zm12 0h2v4h-2V9zM9 9h6v4H9V9zm-3 6h12c1.1 0 2 .9 2 2v1c0 1.1-.9 2-2 2H6c-1.1 0-2-.9-2-2v-1c0-1.1.9-2 2-2z"/>
              </svg>
              添加观鸟记录
            </span>
          </h1>
          <p className={styles.description}>
            记录您的观鸟发现，分享观察体验
          </p>
        </div>

        <div className={styles.formContainer}>
          <MultiBirdForm 
            onSubmit={handleSubmit}
            onCancel={handleCancel}
          />
        </div>
      </main>

      <Footer />
    </div>
  );
}
