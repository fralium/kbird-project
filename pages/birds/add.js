import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Navbar from '../../components/Navbar';
import Footer from '../../components/Footer';
import TaxonomySelector from '../../components/TaxonomySelector';
import ProtectionLevelSelector from '../../components/ProtectionLevelSelector';
import DuplicateChecker from '../../components/DuplicateChecker';
import { birdTextParser } from '../../utils/birdTextParser';
import { parseProtectionStatusText } from '../../data/protectionLevels';
import styles from '../../styles/AddBird.module.css';

export default function AddBird() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const redirectTimerRef = useRef(null);

  // 清理定时器
  useEffect(() => {
    return () => {
      if (redirectTimerRef.current) {
        clearTimeout(redirectTimerRef.current);
      }
    };
  }, []);

  // 检查用户权限
  useEffect(() => {
    const checkUserAuth = async () => {
      const token = localStorage.getItem('token');
      if (!token) {
        router.push('/login');
        return;
      }

      try {
        const response = await fetch('/api/users/profile', {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });

        const data = await response.json();
        
        if (data.success) {
          if (data.data.role !== 'admin') {
            alert('只有管理员可以添加鸟类品种');
            router.push('/');
            return;
          }
          setUser(data.data);
        } else {
          router.push('/login');
        }
      } catch (error) {
        console.error('权限检查失败:', error);
        router.push('/login');
      } finally {
        setLoading(false);
      }
    };

    checkUserAuth();
  }, [router]);

  const [formData, setFormData] = useState({
    name: '',
    scientificName: '',
    description: '',
    habitat: '',
    distribution: '',
    conservationStatus: '', // 保护状态文本
    chinaProtectionLevel: '', // 中国保护级别
    iucnProtectionLevel: '', // IUCN保护级别
    taxonomy: '', // 新的分类字段
    tags: '',
    // 新增的形态特征字段
    size: '', // 体型大小
    weight: '', // 体重
    wingspan: '', // 翼展
    plumage: '', // 羽色特征
    bill: '', // 喙的特征
    legs: '', // 腿脚特征
    // 行为习性
    behavior: '', // 行为习性
    diet: '', // 食性
    migration: '', // 迁徙习性
    // 繁殖信息
    breedingSeason: '', // 繁殖季节
    nestType: '', // 巢型
    clutchSize: '', // 窝卵数
    // 识别要点
    identificationTips: '', // 识别要点
    similarSpecies: '', // 相似物种
    // 参考资料
    references: '', // 参考资料
  });

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [showParser, setShowParser] = useState(false);
  const [parserText, setParserText] = useState('');
  const [isParsing, setIsParsing] = useState(false);
  const [showDuplicateCheck, setShowDuplicateCheck] = useState(false);

  useEffect(() => {
    // 检查用户是否登录
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('token');
      if (!token) {
        router.push('/login');
      }
    }
  }, [router]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // 智能识别功能
  const handleParseText = async () => {
    if (!parserText.trim()) {
      setError('请输入要识别的文本');
      return;
    }

    setIsParsing(true);
    setError(null);

    try {
      // 使用解析器解析文本
      const parsedData = birdTextParser.parseText(parserText);
      
      // 更新表单数据
      setFormData(prev => ({
        ...prev,
        ...parsedData
      }));

      // 显示成功消息
      setError(null);
      alert('文本识别成功！请检查并完善信息。');
      
      // 关闭解析器
      setShowParser(false);
      setParserText('');
    } catch (err) {
      setError('文本解析失败，请检查输入格式');
    } finally {
      setIsParsing(false);
    }
  };

  // 清空解析器文本
  const clearParserText = () => {
    setParserText('');
    setError(null);
  };

  // 获取解析建议
  const getParsingSuggestions = () => {
    return birdTextParser.getParsingSuggestions();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const token = localStorage.getItem('token');
      
      // 检查重名
      const checkDuplicateResponse = await fetch('/api/birds/check-duplicate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: formData.name,
          scientificName: formData.scientificName
        }),
      });

      const duplicateData = await checkDuplicateResponse.json();
      
      if (duplicateData.success && duplicateData.data.hasDuplicates) {
        const duplicates = duplicateData.data.duplicates;
        let confirmMessage = `发现相似鸟类记录：\n\n`;
        
        duplicates.forEach((bird, index) => {
          confirmMessage += `${index + 1}. ${bird.name} (${bird.scientificName})\n`;
          confirmMessage += `   相似度: ${bird.similarity}%\n`;
          confirmMessage += `   原因: ${bird.matchReasons.join(', ')}\n\n`;
        });
        
        confirmMessage += `是否仍要继续添加？`;
        
        if (!confirm(confirmMessage)) {
          setIsLoading(false);
          return;
        }
      }
      
      // 处理标签
      const tagsArray = formData.tags
        .split(',')
        .map(tag => tag.trim())
        .filter(tag => tag.length > 0);

      // 解析保护状态
      const protectionParsed = parseProtectionStatusText(formData.conservationStatus);

      const response = await fetch('/api/birds', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          ...formData,
          category: formData.taxonomy, // 将taxonomy映射到category字段
          chinaProtectionLevel: protectionParsed.china,
          iucnProtectionLevel: protectionParsed.iucn,
          tags: tagsArray,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || '创建鸟类记录失败');
      }

      setSuccess(true);
      redirectTimerRef.current = setTimeout(() => {
        router.push('/birds');
      }, 2000);

    } catch (err) {
      setError(err.message || '创建鸟类记录时发生错误');
    } finally {
      setIsLoading(false);
    }
  };

  if (success) {
    return (
      <div className={styles.container}>
        <Head>
          <title>添加成功 - KBird</title>
        </Head>
        <Navbar />
        <main className={styles.main}>
          <div className={styles.successMessage}>
            <h2>✅ 鸟类记录创建成功！</h2>
            <p>正在跳转到鸟类列表页面...</p>
          </div>
        </main>
      </div>
    );
  }

  // 加载状态
  if (loading) {
    return (
      <div className={styles.container}>
        <Head>
          <title>添加鸟类记录 - KBird</title>
        </Head>
        <Navbar />
        <div className={styles.loadingContainer}>
          <div className={styles.loadingMessage}>
            🔍 检查权限中...
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  // 权限检查
  if (!user || user.role !== 'admin') {
    return (
      <div className={styles.container}>
        <Head>
          <title>添加鸟类记录 - KBird</title>
        </Head>
        <Navbar />
        <div className={styles.errorContainer}>
          <div className={styles.errorMessage}>
            ❌ 只有管理员可以添加鸟类品种
          </div>
          <button 
            className={styles.backButton}
            onClick={() => router.push('/')}
          >
            返回首页
          </button>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <Head>
        <title>添加鸟类记录 - KBird</title>
      </Head>

      <Navbar />

      <main className={styles.main}>
        <div className={styles.header}>
          <h1>添加新的鸟类记录</h1>
          <p>分享您观察到的鸟类信息</p>
          
          <div className={styles.headerActions}>
            <button
              type="button"
              onClick={() => setShowParser(!showParser)}
              className={styles.parseButton}
            >
              {showParser ? '关闭智能识别' : '智能识别文本'}
            </button>
          </div>
        </div>

        {/* 智能识别区域 */}
        {showParser && (
          <div className={styles.parserSection}>
            <div className={styles.parserHeader}>
              <h3>🤖 智能文本识别</h3>
              <p>将鸟类信息粘贴到下方文本框，系统会自动识别并填充表单</p>
            </div>
            
            <div className={styles.parserContent}>
              <div className={styles.parserInput}>
                <textarea
                  value={parserText}
                  onChange={(e) => setParserText(e.target.value)}
                  placeholder="请粘贴鸟类信息文本，例如：&#10;名称：北京百灵&#10;学名：Melanocorypha mongolica&#10;描述：中国北方常见的鸣禽，有百鸟之王的美誉&#10;栖息地：草原、农田&#10;分布：中国北方&#10;保护状态：无危&#10;分类：雀形目百灵科&#10;标签：鸣禽,草原,常见"
                  className={styles.parserTextarea}
                  rows="8"
                />
              </div>
              
              <div className={styles.parserActions}>
                <button
                  type="button"
                  onClick={clearParserText}
                  className={styles.clearButton}
                  disabled={isParsing}
                >
                  清空
                </button>
                <button
                  type="button"
                  onClick={handleParseText}
                  className={styles.parseActionButton}
                  disabled={isParsing || !parserText.trim()}
                >
                  {isParsing ? '识别中...' : '开始识别'}
                </button>
              </div>
            </div>
            
            <div className={styles.parserSuggestions}>
              <h4>💡 使用提示：</h4>
              <ul>
                {getParsingSuggestions().map((suggestion, index) => (
                  <li key={index}>{suggestion}</li>
                ))}
              </ul>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label htmlFor="name">鸟类名称 *</label>
              <input
                type="text"
                id="name"
                name="name"
                value={formData.name}
                onChange={handleChange}
                required
                placeholder="例如：北京百灵"
              />
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="scientificName">学名 *</label>
              <input
                type="text"
                id="scientificName"
                name="scientificName"
                value={formData.scientificName}
                onChange={handleChange}
                required
                placeholder="例如：Melanocorypha mongolica"
              />
            </div>
          </div>

          <div className={styles.formGroup}>
            <label>分类 *</label>
            <TaxonomySelector
              value={formData.taxonomy}
              onChange={(value) => setFormData(prev => ({ ...prev, taxonomy: value }))}
              placeholder="请选择分类"
              showSpecies={true}
            />
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="description">描述 *</label>
            <textarea
              id="description"
              name="description"
              value={formData.description}
              onChange={handleChange}
              required
              rows="4"
              placeholder="描述鸟类的外观特征、行为习性等..."
            />
          </div>

          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label htmlFor="habitat">栖息地 *</label>
              <input
                type="text"
                id="habitat"
                name="habitat"
                value={formData.habitat}
                onChange={handleChange}
                required
                placeholder="例如：草原、农田"
              />
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="distribution">分布区域 *</label>
              <input
                type="text"
                id="distribution"
                name="distribution"
                value={formData.distribution}
                onChange={handleChange}
                required
                placeholder="例如：中国北方"
              />
            </div>
          </div>

          <div className={styles.formGroup}>
            <label>保护状态</label>
            <ProtectionLevelSelector
              value={formData.conservationStatus}
              onChange={(value) => setFormData(prev => ({ ...prev, conservationStatus: value }))}
            />
          </div>

          {/* 形态特征 */}
          <div className={styles.sectionHeader}>
            <h3>📏 形态特征</h3>
          </div>
          
          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label htmlFor="size">体型大小</label>
              <input
                type="text"
                id="size"
                name="size"
                value={formData.size}
                onChange={handleChange}
                placeholder="例如：体长15-18cm"
              />
            </div>
            
            <div className={styles.formGroup}>
              <label htmlFor="weight">体重</label>
              <input
                type="text"
                id="weight"
                name="weight"
                value={formData.weight}
                onChange={handleChange}
                placeholder="例如：20-30g"
              />
            </div>
            
            <div className={styles.formGroup}>
              <label htmlFor="wingspan">翼展</label>
              <input
                type="text"
                id="wingspan"
                name="wingspan"
                value={formData.wingspan}
                onChange={handleChange}
                placeholder="例如：25-30cm"
              />
            </div>
          </div>
          
          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label htmlFor="plumage">羽色特征</label>
              <input
                type="text"
                id="plumage"
                name="plumage"
                value={formData.plumage}
                onChange={handleChange}
                placeholder="例如：背部棕褐色，腹部白色"
              />
            </div>
            
            <div className={styles.formGroup}>
              <label htmlFor="bill">喙的特征</label>
              <input
                type="text"
                id="bill"
                name="bill"
                value={formData.bill}
                onChange={handleChange}
                placeholder="例如：短而尖，黑色"
              />
            </div>
            
            <div className={styles.formGroup}>
              <label htmlFor="legs">腿脚特征</label>
              <input
                type="text"
                id="legs"
                name="legs"
                value={formData.legs}
                onChange={handleChange}
                placeholder="例如：细长，黄褐色"
              />
            </div>
          </div>

          {/* 行为习性 */}
          <div className={styles.sectionHeader}>
            <h3>🦅 行为习性</h3>
          </div>
          
          <div className={styles.formGroup}>
            <label htmlFor="behavior">行为习性</label>
            <textarea
              id="behavior"
              name="behavior"
              value={formData.behavior}
              onChange={handleChange}
              rows="3"
              placeholder="描述鸟类的行为特点，如飞行方式、栖息习惯等..."
            />
          </div>
          
          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label htmlFor="diet">食性</label>
              <input
                type="text"
                id="diet"
                name="diet"
                value={formData.diet}
                onChange={handleChange}
                placeholder="例如：杂食性，以昆虫和种子为主"
              />
            </div>
            
            <div className={styles.formGroup}>
              <label htmlFor="migration">迁徙习性</label>
              <input
                type="text"
                id="migration"
                name="migration"
                value={formData.migration}
                onChange={handleChange}
                placeholder="例如：留鸟/候鸟/旅鸟"
              />
            </div>
          </div>

          {/* 繁殖信息 */}
          <div className={styles.sectionHeader}>
            <h3>🥚 繁殖信息</h3>
          </div>
          
          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label htmlFor="breedingSeason">繁殖季节</label>
              <input
                type="text"
                id="breedingSeason"
                name="breedingSeason"
                value={formData.breedingSeason}
                onChange={handleChange}
                placeholder="例如：4-7月"
              />
            </div>
            
            <div className={styles.formGroup}>
              <label htmlFor="nestType">巢型</label>
              <input
                type="text"
                id="nestType"
                name="nestType"
                value={formData.nestType}
                onChange={handleChange}
                placeholder="例如：地面巢，杯状"
              />
            </div>
            
            <div className={styles.formGroup}>
              <label htmlFor="clutchSize">窝卵数</label>
              <input
                type="text"
                id="clutchSize"
                name="clutchSize"
                value={formData.clutchSize}
                onChange={handleChange}
                placeholder="例如：3-5枚"
              />
            </div>
          </div>

          {/* 识别要点 */}
          <div className={styles.sectionHeader}>
            <h3>🔍 识别要点</h3>
          </div>
          
          <div className={styles.formGroup}>
            <label htmlFor="identificationTips">识别要点</label>
            <textarea
              id="identificationTips"
              name="identificationTips"
              value={formData.identificationTips}
              onChange={handleChange}
              rows="3"
              placeholder="描述该物种的独特识别特征，便于野外识别..."
            />
          </div>
          
          <div className={styles.formGroup}>
            <label htmlFor="similarSpecies">相似物种</label>
            <input
              type="text"
              id="similarSpecies"
              name="similarSpecies"
              value={formData.similarSpecies}
              onChange={handleChange}
              placeholder="例如：与麻雀相似，但体型更大"
            />
          </div>

          {/* 参考资料 */}
          <div className={styles.sectionHeader}>
            <h3>📚 参考资料</h3>
          </div>
          
          <div className={styles.formGroup}>
            <label htmlFor="references">参考资料</label>
            <textarea
              id="references"
              name="references"
              value={formData.references}
              onChange={handleChange}
              rows="3"
              placeholder="列出信息来源，如书籍、网站、专家意见等..."
            />
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="tags">标签</label>
            <input
              type="text"
              id="tags"
              name="tags"
              value={formData.tags}
              onChange={handleChange}
              placeholder="用逗号分隔，例如：鸣禽,草原,常见"
            />
            <small>用逗号分隔多个标签</small>
          </div>

          {error && (
            <div className={styles.errorMessage}>
              {error}
            </div>
          )}

          <div className={styles.formActions}>
            <button
              type="button"
              onClick={() => router.back()}
              className={styles.cancelButton}
            >
              取消
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className={styles.submitButton}
            >
              {isLoading ? '创建中...' : '创建鸟类记录'}
            </button>
          </div>
        </form>
      </main>
      
      <Footer />
    </div>
  );
}
