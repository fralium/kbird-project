import React, { useState } from 'react';
import styles from '../styles/BirdPDFExporter.module.css';

const BirdPDFExporter = ({ birds, selectedBirds = null }) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);

  // 格式化鸟类数据
  const formatBirdData = (bird) => {
    return {
      // 基本信息
      name: bird.name || '未知',
      scientificName: bird.scientificName || '未知',
      category: bird.category || '未知',
      
      // 分类学信息
      order: bird.order || '未知',
      family: bird.family || '未知',
      genus: bird.genus || '未知',
      species: bird.species || '未知',
      
      // 保护等级
      iucnProtectionLevel: bird.iucnProtectionLevel || '未评估',
      chinaProtectionLevel: bird.chinaProtectionLevel || '未列入',
      
      // 栖息地和分布
      habitat: bird.habitat || '未知',
      distribution: bird.distribution || '未知',
      
      // 形态特征
      size: bird.size || '未知',
      weight: bird.weight || '未知',
      wingspan: bird.wingspan || '未知',
      plumage: bird.plumage || '未知',
      bill: bird.bill || '未知',
      legs: bird.legs || '未知',
      
      // 行为习性
      behavior: bird.behavior || '未知',
      diet: bird.diet || '未知',
      migration: bird.migration || '未知',
      
      // 繁殖信息
      breedingSeason: bird.breedingSeason || '未知',
      nestType: bird.nestType || '未知',
      clutchSize: bird.clutchSize || '未知',
      
      // 识别要点
      identificationTips: bird.identificationTips || '无',
      similarSpecies: bird.similarSpecies || '无',
      
      // 描述
      description: bird.description || '无详细描述',
      
      // 图片数量
      imageCount: bird.images ? bird.images.length : 0,
      
      // 观察记录数量
      sightingCount: bird.sightings ? bird.sightings.length : 0,
      
      // 创建时间
      createdAt: bird.createdAt ? new Date(bird.createdAt).toLocaleDateString('zh-CN') : '未知'
    };
  };

  // 生成单个鸟类PDF
  const generateSingleBirdPDF = async (bird) => {
    // 动态导入jsPDF
    const { default: jsPDF } = await import('jspdf');
    
    const formattedBird = formatBirdData(bird);
    
    const pdf = new jsPDF('p', 'mm', 'a4');
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 20;
    let yPosition = margin;

    // 设置字体
    pdf.setFont('helvetica');

    // 标题
    pdf.setFontSize(20);
    pdf.setFont('helvetica', 'bold');
    pdf.text(formattedBird.name, margin, yPosition);
    yPosition += 15;

    // 拉丁学名
    pdf.setFontSize(14);
    pdf.setFont('helvetica', 'italic');
    pdf.text(formattedBird.scientificName, margin, yPosition);
    yPosition += 20;

    // 基本信息
    pdf.setFontSize(12);
    pdf.setFont('helvetica', 'bold');
    pdf.text('基本信息', margin, yPosition);
    yPosition += 10;

    pdf.setFont('helvetica', 'normal');
    const basicInfo = [
      `分类: ${formattedBird.category}`,
      `目: ${formattedBird.order}`,
      `科: ${formattedBird.family}`,
      `属: ${formattedBird.genus}`,
      `种: ${formattedBird.species}`,
      `IUCN保护等级: ${formattedBird.iucnProtectionLevel}`,
      `中国保护等级: ${formattedBird.chinaProtectionLevel}`
    ];

    basicInfo.forEach(info => {
      pdf.text(info, margin, yPosition);
      yPosition += 7;
    });

    yPosition += 10;

    // 形态特征
    pdf.setFont('helvetica', 'bold');
    pdf.text('形态特征', margin, yPosition);
    yPosition += 10;

    pdf.setFont('helvetica', 'normal');
    const morphologyInfo = [
      `体型: ${formattedBird.size}`,
      `体重: ${formattedBird.weight}`,
      `翼展: ${formattedBird.wingspan}`,
      `羽毛: ${formattedBird.plumage}`,
      `喙: ${formattedBird.bill}`,
      `腿: ${formattedBird.legs}`
    ];

    morphologyInfo.forEach(info => {
      pdf.text(info, margin, yPosition);
      yPosition += 7;
    });

    yPosition += 10;

    // 行为习性
    pdf.setFont('helvetica', 'bold');
    pdf.text('行为习性', margin, yPosition);
    yPosition += 10;

    pdf.setFont('helvetica', 'normal');
    const behaviorInfo = [
      `行为: ${formattedBird.behavior}`,
      `食性: ${formattedBird.diet}`,
      `迁徙: ${formattedBird.migration}`
    ];

    behaviorInfo.forEach(info => {
      pdf.text(info, margin, yPosition);
      yPosition += 7;
    });

    yPosition += 10;

    // 栖息地和分布
    pdf.setFont('helvetica', 'bold');
    pdf.text('栖息地和分布', margin, yPosition);
    yPosition += 10;

    pdf.setFont('helvetica', 'normal');
    pdf.text(`栖息地: ${formattedBird.habitat}`, margin, yPosition);
    yPosition += 7;
    pdf.text(`分布: ${formattedBird.distribution}`, margin, yPosition);
    yPosition += 15;

    // 描述
    if (formattedBird.description !== '无详细描述') {
      pdf.setFont('helvetica', 'bold');
      pdf.text('详细描述', margin, yPosition);
      yPosition += 10;

      pdf.setFont('helvetica', 'normal');
      const descriptionLines = pdf.splitTextToSize(formattedBird.description, pageWidth - 2 * margin);
      descriptionLines.forEach(line => {
        if (yPosition > pageHeight - margin) {
          pdf.addPage();
          yPosition = margin;
        }
        pdf.text(line, margin, yPosition);
        yPosition += 7;
      });
      yPosition += 10;
    }

    // 统计信息
    pdf.setFont('helvetica', 'bold');
    pdf.text('统计信息', margin, yPosition);
    yPosition += 10;

    pdf.setFont('helvetica', 'normal');
    const statsInfo = [
      `图片数量: ${formattedBird.imageCount}张`,
      `观察记录: ${formattedBird.sightingCount}条`,
      `创建时间: ${formattedBird.createdAt}`
    ];

    statsInfo.forEach(info => {
      pdf.text(info, margin, yPosition);
      yPosition += 7;
    });

    return pdf;
  };

  // 生成多个鸟类PDF（简化版本）
  const generateMultipleBirdsPDF = async (birdsToExport) => {
    // 简化版本：为每个鸟类生成单独的PDF文件
    return birdsToExport;
  };

  // 导出单个鸟类PDF
  const exportSingleBird = async (bird) => {
    setIsGenerating(true);
    try {
      const pdf = await generateSingleBirdPDF(bird);
      const fileName = `${bird.name}_详细信息.pdf`;
      pdf.save(fileName);
    } catch (error) {
      console.error('生成PDF失败:', error);
      alert('生成PDF失败，请重试');
    } finally {
      setIsGenerating(false);
    }
  };

  // 导出多个鸟类PDF
  const exportMultipleBirds = async () => {
    if (!birds || birds.length === 0) {
      alert('没有可导出的鸟类数据');
      return;
    }

    const birdsToExport = selectedBirds || birds;
    setIsGenerating(true);
    setProgress(0);

    try {
      for (let i = 0; i < birdsToExport.length; i++) {
        const bird = birdsToExport[i];
        setProgress(Math.round((i / birdsToExport.length) * 100));

        const birdPdf = await generateSingleBirdPDF(bird);
        
        // 为每个鸟类创建单独的PDF文件
        const fileName = `${bird.name.replace(/[^\w\s-]/g, '').replace(/\s+/g, '_')}_详细信息.pdf`;
        birdPdf.save(fileName);
        
        // 添加小延迟避免浏览器阻塞
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      alert(`成功导出 ${birdsToExport.length} 个鸟类PDF文件`);
    } catch (error) {
      console.error('批量生成PDF失败:', error);
      alert('批量生成PDF失败，请重试');
    } finally {
      setIsGenerating(false);
      setProgress(0);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h3>鸟类详细信息PDF导出</h3>
        <p>导出包含完整鸟类信息的PDF文档</p>
      </div>

      <div className={styles.controls}>
        <button
          onClick={exportMultipleBirds}
          disabled={isGenerating || !birds || birds.length === 0}
          className={styles.exportButton}
        >
          {isGenerating ? '生成中...' : '导出所有鸟类PDF'}
        </button>

        {selectedBirds && (
          <button
            onClick={() => exportMultipleBirds()}
            disabled={isGenerating}
            className={styles.exportButton}
          >
            导出选中鸟类PDF
          </button>
        )}
      </div>

      {isGenerating && (
        <div className={styles.progressContainer}>
          <div className={styles.progressBar}>
            <div 
              className={styles.progressFill} 
              style={{ width: `${progress}%` }}
            ></div>
          </div>
          <p className={styles.progressText}>生成进度: {progress}%</p>
        </div>
      )}

      <div className={styles.info}>
        <h4>导出内容包括：</h4>
        <ul>
          <li>基本信息（名称、学名、分类）</li>
          <li>形态特征（体型、体重、翼展等）</li>
          <li>行为习性（食性、迁徙、行为）</li>
          <li>栖息地和分布</li>
          <li>保护等级信息</li>
          <li>详细描述</li>
          <li>统计信息（图片数量、观察记录等）</li>
        </ul>
      </div>
    </div>
  );
};

export default BirdPDFExporter;