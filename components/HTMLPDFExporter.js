import React, { useState } from 'react';
import { formatDisplayDate, formatDisplayDateTime } from '@/utils/localDate';
import { showToast } from '@/utils/toast';

const HTMLPDFExporter = ({ birds, selectedBirds = null, filters = {}, searchTerm = '' }) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);

  // 生成文件名
  const generateFileName = (extension) => {
    const parts = [];
    
    // 添加过滤条件
    if (filters.category) {
      parts.push(filters.category);
    }
    if (filters.family) {
      parts.push(filters.family);
    }
    if (filters.iucnProtectionLevel) {
      parts.push(`IUCN-${filters.iucnProtectionLevel}`);
    }
    if (filters.chinaProtectionLevel) {
      parts.push(`中国-${filters.chinaProtectionLevel}`);
    }
    
    // 添加搜索关键词
    if (searchTerm && searchTerm.trim()) {
      parts.push(`搜索-${searchTerm.trim()}`);
    }
    
    // 如果没有过滤条件，使用"全部"
    if (parts.length === 0) {
      parts.push('全部');
    }
    
    // 添加当前日期
    const today = new Date().toISOString().split('T')[0];
    parts.push(today);
    
    // 清理文件名中的特殊字符
    const cleanFileName = parts.join('-').replace(/[^\w\u4e00-\u9fff-]/g, '');
    
    return `${cleanFileName}.${extension}`;
  };

  // 获取鸟类的观察记录
  const fetchBirdRecords = async (birdId) => {
    try {
      console.log('开始获取观察记录，鸟类ID:', birdId);
      const response = await fetch(`/api/records/bird/${birdId}?status=pending,approved`);
      console.log('API响应状态:', response.status, response.statusText);
      
      if (response.ok) {
        const data = await response.json();
        console.log('获取到的观察记录数据:', data);
        console.log('data.data内容:', data.data);
        console.log('观察记录数量:', data.data ? data.data.length : 0);
        return data.data || [];
      } else {
        console.error('API请求失败:', response.status, response.statusText);
        const errorText = await response.text();
        console.error('错误详情:', errorText);
      }
    } catch (error) {
      console.error('获取鸟类观察记录失败:', error);
    }
    return [];
  };

  // 创建鸟类信息HTML
  const createBirdHTML = async (bird, birdRecords) => {
    console.log('创建鸟类HTML，鸟类信息:', bird);
    console.log('观察记录数据:', birdRecords);
    console.log('观察记录数量:', birdRecords ? birdRecords.length : 0);
    
    const images = bird.images || [];
    const imageCount = images.length;
    
    return `
      <div class="bird-page" style="
        font-family: 'Microsoft YaHei', 'SimSun', Arial, sans-serif;
        padding: 20px;
        max-width: 800px;
        margin: 0 auto;
        background: white;
        color: #333;
        line-height: 1.6;
      ">
        <!-- 鸟类标题 -->
        <div class="bird-header" style="
          text-align: center;
          margin-bottom: 30px;
          border-bottom: 2px solid #023047;
          padding-bottom: 20px;
        ">
          <h1 style="
            font-size: var(--type-page-title);
            color: var(--color-ink);
            margin: 0 0 10px 0;
            font-weight: bold;
          ">${bird.name || '未知鸟类'}</h1>
          <p style="
            font-size: var(--type-page-lede);
            color: var(--text-muted);
            font-style: italic;
            margin: 0;
          ">${bird.scientificName || 'Unknown'}</p>
        </div>

        <!-- 基本信息 -->
        <div class="info-section" style="margin-bottom: 30px;">
          <h2 style="
            font-size: var(--type-subsection);
            color: var(--color-ink);
            margin-bottom: 15px;
            border-left: 4px solid #023047;
            padding-left: 10px;
          ">基本信息</h2>
          
          <div class="info-grid" style="
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 15px;
            font-size: var(--type-secondary);
          ">
            <div class="info-item">
              <strong>分类：</strong>${bird.category || '未知'}
            </div>
            <div class="info-item">
              <strong>目：</strong>${bird.order || '未知'}
            </div>
            <div class="info-item">
              <strong>科：</strong>${bird.family || '未知'}
            </div>
            <div class="info-item">
              <strong>属：</strong>${bird.genus || '未知'}
            </div>
            <div class="info-item">
              <strong>种：</strong>${bird.species || '未知'}
            </div>
            <div class="info-item">
              <strong>IUCN保护等级：</strong>${bird.iucnProtectionLevel || '未评估'}
            </div>
            <div class="info-item">
              <strong>中国保护等级：</strong>${bird.chinaProtectionLevel || '未列入'}
            </div>
            <div class="info-item">
              <strong>栖息地：</strong>${bird.habitat || '未知'}
            </div>
            <div class="info-item">
              <strong>分布：</strong>${bird.distribution || '未知'}
            </div>
            <div class="info-item">
              <strong>创建时间：</strong>${bird.createdAt ? formatDisplayDate(bird.createdAt, 'short') : '未知'}
            </div>
          </div>
        </div>

        <!-- 形态特征 -->
        ${(bird.size || bird.weight || bird.wingspan || bird.plumage || bird.bill || bird.legs) ? `
        <div class="morphology-section" style="margin-bottom: 30px;">
          <h2 style="
            font-size: var(--type-subsection);
            color: var(--color-ink);
            margin-bottom: 15px;
            border-left: 4px solid #023047;
            padding-left: 10px;
          ">形态特征</h2>
          
          <div class="morphology-grid" style="
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 15px;
            font-size: var(--type-secondary);
          ">
            ${bird.size ? `<div class="morphology-item"><strong>体长：</strong>${bird.size}</div>` : ''}
            ${bird.weight ? `<div class="morphology-item"><strong>体重：</strong>${bird.weight}</div>` : ''}
            ${bird.wingspan ? `<div class="morphology-item"><strong>翼展：</strong>${bird.wingspan}</div>` : ''}
            ${bird.plumage ? `<div class="morphology-item"><strong>羽毛：</strong>${bird.plumage}</div>` : ''}
            ${bird.bill ? `<div class="morphology-item"><strong>喙：</strong>${bird.bill}</div>` : ''}
            ${bird.legs ? `<div class="morphology-item"><strong>腿：</strong>${bird.legs}</div>` : ''}
          </div>
        </div>
        ` : ''}

        <!-- 行为习性 -->
        ${(bird.behavior || bird.diet || bird.migration) ? `
        <div class="behavior-section" style="margin-bottom: 30px;">
          <h2 style="
            font-size: var(--type-subsection);
            color: var(--color-ink);
            margin-bottom: 15px;
            border-left: 4px solid #023047;
            padding-left: 10px;
          ">行为习性</h2>
          
          <div class="behavior-content" style="font-size: var(--type-secondary);">
            ${bird.behavior ? `<div class="behavior-item" style="margin-bottom: 10px;"><strong>行为：</strong>${bird.behavior}</div>` : ''}
            ${bird.diet ? `<div class="behavior-item" style="margin-bottom: 10px;"><strong>食性：</strong>${bird.diet}</div>` : ''}
            ${bird.migration ? `<div class="behavior-item" style="margin-bottom: 10px;"><strong>迁徙：</strong>${bird.migration}</div>` : ''}
          </div>
        </div>
        ` : ''}

        <!-- 照片信息 -->
        ${imageCount > 0 ? `
        <div class="photos-section" style="margin-bottom: 30px;">
          <h2 style="
            font-size: var(--type-subsection);
            color: var(--color-ink);
            margin-bottom: 15px;
            border-left: 4px solid #023047;
            padding-left: 10px;
          ">照片信息 (${imageCount}张)</h2>
          
          <div class="photos-grid" style="
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 15px;
          ">
            ${images.map((image, index) => {
              const imageUrl = typeof image === 'string' ? image : (image.url || image.filename || '');
              const imageName = typeof image === 'string' ? image.split('/').pop() : 
                               (image.filename || image.url?.split('/').pop() || `照片${index + 1}`);
              return `
                <div class="photo-item" style="
                  border: 1px solid #ddd;
                  border-radius: 8px;
                  padding: 10px;
                  text-align: center;
                  background: #f9f9f9;
                ">
                  <img src="${imageUrl}" alt="${imageName}" style="
                    max-width: 100%;
                    max-height: 150px;
                    border-radius: 4px;
                    margin-bottom: 8px;
                  " onerror="this.style.display='none'">
                  <div style="font-size: var(--type-caption); color: var(--text-muted);">${imageName}</div>
                </div>
              `;
            }).join('')}
          </div>
        </div>
        ` : ''}

        <!-- 观察记录 -->
        <div class="records-section" style="margin-bottom: 30px;">
          <h2 style="
            font-size: var(--type-subsection);
            color: var(--color-ink);
            margin-bottom: 15px;
            border-left: 4px solid #023047;
            padding-left: 10px;
          ">观察记录</h2>
          
          ${birdRecords && birdRecords.length > 0 ? `
          <p style="font-size: var(--type-secondary); color: var(--text-muted); margin-bottom: 15px;">共 ${birdRecords.length} 条记录</p>
          
          ${birdRecords.map((record, index) => `
            <div class="record-item" style="
              border: 1px solid #ddd;
              border-radius: 8px;
              padding: 15px;
              margin-bottom: 15px;
              background: #f9f9f9;
            ">
              <h3 style="
                font-size: var(--type-body);
                color: var(--color-ink);
                margin: 0 0 10px 0;
              ">记录 ${index + 1}</h3>
              
              <div class="record-details" style="
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 10px;
                font-size: var(--type-secondary);
                margin-bottom: 10px;
              ">
                <div><strong>地点：</strong>${record.location?.name || '未知'}</div>
                <div><strong>日期：</strong>${formatDisplayDate(record.date, 'short')}</div>
                <div><strong>观察者：</strong>${record.user?.username || '未知'}</div>
                <div><strong>备注：</strong>${record.notes || '无'}</div>
              </div>
              
              ${record.photos && record.photos.length > 0 ? `
                <div class="record-photos" style="margin-top: 10px;">
                  <strong>记录照片 (${record.photos.length}张)：</strong>
                  <div style="font-size: var(--type-caption); color: var(--text-muted); margin-top: 5px;">
                    ${record.photos.map(photo => {
                      const photoName = typeof photo === 'string' ? photo : 
                                       (photo.filename || photo.url?.split('/').pop() || '未知文件');
                      return photoName;
                    }).join(', ')}
                  </div>
                </div>
              ` : ''}
            </div>
          `).join('')}
          ` : `
          <div class="no-records" style="
            text-align: center;
            padding: 30px;
            color: var(--text-muted);
            font-style: italic;
            border: 1px dashed #ddd;
            border-radius: 8px;
            background: #f9f9f9;
          ">
            <p>暂无观察记录</p>
            <p style="font-size: var(--type-caption); margin-top: 10px;">该鸟类尚未有用户提交的观察记录</p>
          </div>
          `}
        </div>

        <!-- 页脚 -->
        <div class="page-footer" style="
          margin-top: 40px;
          padding-top: 20px;
          border-top: 1px solid #ddd;
          text-align: center;
          font-size: var(--type-caption);
          color: var(--text-muted);
        ">
          <p>导出时间：${formatDisplayDateTime(new Date())}</p>
          <p>数据来源：观鸟数据库</p>
        </div>
      </div>
    `;
  };

  // 导出CSV功能
  const exportToCSV = async () => {
    try {
      setIsGenerating(true);
      
      // 构建与当前过滤条件相同的查询参数，但获取所有数据
      const queryParams = new URLSearchParams({
        page: '1',
        limit: '10000', // 获取大量数据用于导出
      });
      
      // 添加搜索参数
      if (searchTerm && searchTerm.trim()) {
        queryParams.append('search', searchTerm.trim());
      }
      
      // 添加过滤器参数
      if (filters.category) {
        queryParams.append('category', filters.category);
      }
      if (filters.family) {
        queryParams.append('family', filters.family);
      }
      if (filters.iucnProtectionLevel) {
        queryParams.append('iucnProtectionLevel', filters.iucnProtectionLevel);
      }
      if (filters.chinaProtectionLevel) {
        queryParams.append('chinaProtectionLevel', filters.chinaProtectionLevel);
      }
      
      const response = await fetch(`/api/birds?${queryParams.toString()}`);
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          // 准备CSV数据
          const csvHeaders = [
            '中文名',
            '拉丁学名',
            '分类',
            'IUCN保护等级',
            '中国保护等级',
            '栖息地',
            '分布',
            '描述'
          ];
          
          const csvRows = data.data.map(bird => [
            bird.name || '',
            bird.scientificName || '',
            bird.category || '',
            bird.iucnProtectionLevel || '',
            bird.chinaProtectionLevel || '',
            bird.habitat || '',
            bird.distribution || '',
            (bird.description || '').replace(/\n/g, ' ').replace(/\r/g, ' ') // 清理换行符
          ]);
          
          // 创建CSV内容
          const csvContent = [
            csvHeaders.map(header => `"${header}"`).join(','),
            ...csvRows.map(row => 
              row.map(field => 
                `"${field.toString().replace(/"/g, '""')}"` // 转义引号
              ).join(',')
            )
          ].join('\n');
          
          // 添加BOM以支持中文
          const BOM = '\uFEFF';
          const csvWithBOM = BOM + csvContent;
          
          // 创建下载链接
          const blob = new Blob([csvWithBOM], { type: 'text/csv;charset=utf-8;' });
          const link = document.createElement('a');
          const url = URL.createObjectURL(blob);
          
          // 生成文件名
          const fileName = generateFileName('csv');
          
          link.setAttribute('href', url);
          link.setAttribute('download', fileName);
          link.style.visibility = 'hidden';
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          
          // 显示成功消息
          showToast(`导出成功！共导出 ${data.data.length} 条鸟类记录。`, 'success');
        } else {
          showToast('导出失败：' + (data.message || '获取数据失败'), 'error');
        }
      } else {
        showToast('导出失败：网络请求失败', 'error');
      }
    } catch (error) {
      console.error('导出CSV失败:', error);
      showToast('导出失败：' + error.message, 'error');
    } finally {
      setIsGenerating(false);
    }
  };


  // 导出为PDF文件
  const exportAsPDF = async () => {
    if (!birds || birds.length === 0) {
      showToast('没有可导出的鸟类数据', 'error');
      return;
    }

    const birdsToExport = selectedBirds || birds;
    setIsGenerating(true);
    setProgress(0);

    try {
      // 动态导入html2canvas和jsPDF
      const [html2canvas, { default: jsPDF }] = await Promise.all([
        import('html2canvas'),
        import('jspdf')
      ]);
      
      // 创建PDF文档
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      
      // 创建封面页
      const coverHTML = `
        <div style="
          font-family: 'Microsoft YaHei', 'SimSun', Arial, sans-serif;
          padding: 40px;
          text-align: center;
          background: white;
          color: #333;
        ">
          <h1 style="
            font-size: var(--type-scale-3xl);
            color: var(--color-ink);
            margin-bottom: 30px;
            font-weight: bold;
          ">鸟类信息报告</h1>
          
          <div style="font-size: var(--type-page-lede); margin-bottom: 20px;">
            <p><strong>导出时间：</strong>${formatDisplayDateTime(new Date())}</p>
            <p><strong>鸟类数量：</strong>${birdsToExport.length}种</p>
          </div>
          
          <div style="font-size: var(--type-body); color: var(--text-muted);">
            <p><strong>过滤条件：</strong></p>
            ${filters.category ? `<p>目：${filters.category}</p>` : ''}
            ${filters.family ? `<p>科：${filters.family}</p>` : ''}
            ${filters.iucnProtectionLevel ? `<p>IUCN保护等级：${filters.iucnProtectionLevel}</p>` : ''}
            ${filters.chinaProtectionLevel ? `<p>中国保护等级：${filters.chinaProtectionLevel}</p>` : ''}
            ${searchTerm ? `<p>搜索关键词：${searchTerm}</p>` : ''}
          </div>
        </div>
      `;
      
      // 创建临时DOM元素
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = coverHTML;
      tempDiv.style.position = 'absolute';
      tempDiv.style.left = '-9999px';
      tempDiv.style.width = '800px';
      document.body.appendChild(tempDiv);
      
      // 转换封面为图片
      const coverCanvas = await html2canvas.default(tempDiv, {
        width: 800,
        height: 600,
        scale: 2,
        useCORS: true,
        allowTaint: true
      });
      
      // 添加封面到PDF
      const coverImgData = coverCanvas.toDataURL('image/png');
      const coverHeight = (coverCanvas.height * pageWidth) / coverCanvas.width;
      pdf.addImage(coverImgData, 'PNG', 0, 0, pageWidth, coverHeight);
      
      // 清理临时元素
      document.body.removeChild(tempDiv);
      
      // 为每只鸟类创建页面
      for (let i = 0; i < birdsToExport.length; i++) {
        const bird = birdsToExport[i];
        setProgress(Math.round((i / birdsToExport.length) * 100));

        // 获取该鸟类的观察记录
        const birdRecords = await fetchBirdRecords(bird._id);
        
        // 创建鸟类HTML
        const birdHTML = await createBirdHTML(bird, birdRecords);
        
        // 创建临时DOM元素
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = birdHTML;
        tempDiv.style.position = 'absolute';
        tempDiv.style.left = '-9999px';
        tempDiv.style.width = '800px';
        document.body.appendChild(tempDiv);
        
        // 转换HTML为图片
        const canvas = await html2canvas.default(tempDiv, {
          width: 800,
          scale: 2,
          useCORS: true,
          allowTaint: true,
          backgroundColor: '#ffffff'
        });
        
        // 添加新页面
        pdf.addPage();
        
        // 将图片添加到PDF
        const imgData = canvas.toDataURL('image/png');
        const imgHeight = (canvas.height * pageWidth) / canvas.width;
        
        // 如果图片高度超过页面高度，需要分页
        if (imgHeight > pageHeight) {
          pdf.addImage(imgData, 'PNG', 0, 0, pageWidth, pageHeight);
          // 添加额外的页面来显示剩余内容
          const remainingHeight = imgHeight - pageHeight;
          const additionalPages = Math.ceil(remainingHeight / pageHeight);
          
          for (let j = 0; j < additionalPages; j++) {
            pdf.addPage();
            const yOffset = -(pageHeight * (j + 1));
            pdf.addImage(imgData, 'PNG', 0, yOffset, pageWidth, imgHeight);
          }
        } else {
          pdf.addImage(imgData, 'PNG', 0, 0, pageWidth, imgHeight);
        }
        
        // 清理临时元素
        document.body.removeChild(tempDiv);
        
        // 添加小延迟避免浏览器阻塞
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      // 保存PDF文件
      const fileName = generateFileName('pdf');
      pdf.save(fileName);
      
      showToast(`成功导出 ${birdsToExport.length} 种鸟类的详细信息到文件: ${fileName}`, 'success');
    } catch (error) {
      console.error('导出PDF文件失败:', error);
      showToast('导出PDF文件失败，请重试', 'error');
    } finally {
      setIsGenerating(false);
      setProgress(0);
    }
  };

  return (
    <div style={{ 
      margin: '0',
      padding: '24px',
      background: 'linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%)',
      border: '1px solid #dee2e6',
      borderRadius: '12px',
      boxShadow: '0 4px 6px rgba(0, 0, 0, 0.07)'
    }}>
      {/* 标题区域 */}
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        marginBottom: '20px',
        paddingBottom: '12px',
        borderBottom: '2px solid #023047'
      }}>
        <div style={{
          width: '40px',
          height: '40px',
          background: 'linear-gradient(135deg, #023047 0%, #219EBC 100%)',
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginRight: '12px',
          color: 'var(--text-white)',
          fontSize: 'var(--type-page-lede)'
        }}>
          📊
        </div>
        <div>
          <h3 style={{ 
            color: 'var(--color-ink)',
            margin: '0',
            fontSize: 'var(--type-subsection)',
            fontWeight: '600'
          }}>
            数据导出
          </h3>
          <p style={{ 
            margin: '4px 0 0 0',
            color: 'var(--text-muted)',
            fontSize: 'var(--type-secondary)'
          }}>
            导出当前筛选的鸟类数据
          </p>
        </div>
      </div>
      
      {/* 按钮区域 */}
      <div style={{ 
        display: 'flex', 
        gap: '12px', 
        flexWrap: 'wrap', 
        marginBottom: '20px' 
      }}>
        <button
          onClick={exportAsPDF}
          disabled={isGenerating}
          style={{
            padding: '12px 24px',
            background: isGenerating ? '#6c757d' : 'linear-gradient(135deg, #dc3545 0%, #c82333 100%)',
            color: 'var(--text-white)',
            border: 'none',
            borderRadius: '8px',
            cursor: isGenerating ? 'not-allowed' : 'pointer',
            fontSize: 'var(--type-secondary)',
            fontWeight: '500',
            boxShadow: isGenerating ? 'none' : '0 2px 4px rgba(220, 53, 69, 0.3)',
            transition: 'all 0.2s ease',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
          onMouseOver={(e) => {
            if (!isGenerating) {
              e.target.style.transform = 'translateY(-1px)';
              e.target.style.boxShadow = '0 4px 8px rgba(220, 53, 69, 0.4)';
            }
          }}
          onMouseOut={(e) => {
            if (!isGenerating) {
              e.target.style.transform = 'translateY(0)';
              e.target.style.boxShadow = '0 2px 4px rgba(220, 53, 69, 0.3)';
            }
          }}
        >
          {isGenerating ? (
            <>
              <span>⏳</span>
              {`生成中... ${progress}%`}
            </>
          ) : (
            <>
              <span>📄</span>
              导出PDF
            </>
          )}
        </button>
        
        <button
          onClick={exportToCSV}
          disabled={isGenerating}
          style={{
            padding: '12px 24px',
            background: isGenerating ? '#6c757d' : 'linear-gradient(135deg, #219EBC 0%, #1780a0 100%)',
            color: 'var(--text-white)',
            border: 'none',
            borderRadius: '8px',
            cursor: isGenerating ? 'not-allowed' : 'pointer',
            fontSize: 'var(--type-secondary)',
            fontWeight: '500',
            boxShadow: isGenerating ? 'none' : '0 2px 4px rgba(40, 167, 69, 0.3)',
            transition: 'all 0.2s ease',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
          onMouseOver={(e) => {
            if (!isGenerating) {
              e.target.style.transform = 'translateY(-1px)';
              e.target.style.boxShadow = '0 4px 8px rgba(40, 167, 69, 0.4)';
            }
          }}
          onMouseOut={(e) => {
            if (!isGenerating) {
              e.target.style.transform = 'translateY(0)';
              e.target.style.boxShadow = '0 2px 4px rgba(40, 167, 69, 0.3)';
            }
          }}
        >
          {isGenerating ? (
            <>
              <span>⏳</span>
              导出中...
            </>
          ) : (
            <>
              <span>📊</span>
              导出CSV
            </>
          )}
        </button>
      </div>
      
      {/* 进度条 */}
      {isGenerating && (
        <div style={{ 
          marginBottom: '20px',
          padding: '16px',
          background: 'white',
          borderRadius: '8px',
          border: '1px solid #e9ecef'
        }}>
          <div style={{
            width: '100%',
            height: '8px',
            backgroundColor: '#f8f9fa',
            borderRadius: '4px',
            overflow: 'hidden',
            marginBottom: '8px'
          }}>
            <div style={{
              width: `${progress}%`,
              height: '100%',
              background: 'linear-gradient(90deg, #023047 0%, #219EBC 100%)',
              transition: 'width 0.3s ease',
              borderRadius: '4px'
            }}></div>
          </div>
          <p style={{ 
            textAlign: 'center', 
            margin: '0',
            fontSize: 'var(--type-secondary)', 
            color: 'var(--text-secondary)',
            fontWeight: '500'
          }}>
            {progress}% 完成
          </p>
        </div>
      )}
      
      {/* 功能特点 */}
      <div style={{ 
        background: 'white',
        padding: '16px',
        borderRadius: '8px',
        border: '1px solid #e9ecef'
      }}>
        <h4 style={{ 
          color: 'var(--color-ink)',
          margin: '0 0 12px 0',
          fontSize: 'var(--type-body)',
          fontWeight: '600'
        }}>
          ✨ 导出特点
        </h4>
        <div style={{ 
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '8px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ color: 'var(--color-lake)'}}>🌐</span>
            <span style={{ fontSize: 'var(--type-secondary)', color: 'var(--text-secondary)'}}>完美支持中文显示</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ color: '#007bff'}}>🎨</span>
            <span style={{ fontSize: 'var(--type-secondary)', color: 'var(--text-secondary)'}}>保留完整样式格式</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ color: '#ffc107'}}>📷</span>
            <span style={{ fontSize: 'var(--type-secondary)', color: 'var(--text-secondary)'}}>包含照片信息</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ color: '#17a2b8'}}>📝</span>
            <span style={{ fontSize: 'var(--type-secondary)', color: 'var(--text-secondary)'}}>包含观察记录详情</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ color: '#6f42c1'}}>📋</span>
            <span style={{ fontSize: 'var(--type-secondary)', color: 'var(--text-secondary)'}}>支持多种格式</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ color: '#fd7e14'}}>🔍</span>
            <span style={{ fontSize: 'var(--type-secondary)', color: 'var(--text-secondary)'}}>智能筛选导出</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HTMLPDFExporter;
