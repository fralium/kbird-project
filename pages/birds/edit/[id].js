import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Navbar from '../../../components/Navbar';
import TaxonomySelector from '../../../components/TaxonomySelector';
import ProtectionLevelSelector from '../../../components/ProtectionLevelSelector';
import { birdTextParser } from '../../../utils/birdTextParser';
import { parseProtectionStatusText } from '../../../data/protectionLevels';
import styles from '../../../styles/AddBird.module.css';

export default function EditBird() {
  const router = useRouter();
  const { id } = router.query;
  
  const [formData, setFormData] = useState({
    name: '',
    scientificName: '',
    description: '',
    habitat: '',
    distribution: '',
    conservationStatus: '',
    chinaProtectionLevel: '',
    iucnProtectionLevel: '',
    taxonomy: '',
    tags: '',
    // 形态特征
    size: '',
    weight: '',
    wingspan: '',
    plumage: '',
    bill: '',
    legs: '',
    // 行为习性
    behavior: '',
    diet: '',
    migration: '',
    // 繁殖信息
    breedingSeason: '',
    nestType: '',
    clutchSize: '',
    // 识别要点
    identificationTips: '',
    similarSpecies: '',
    // 参考资料
    references: '',
  });

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [showParser, setShowParser] = useState(false);
  const [parserText, setParserText] = useState('');
  const [isParsing, setIsParsing] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 检查用户是否登录
    if (typeof window !== 'undefined' && !localStorage.getItem('token')) {
      router.push('/login');
      return;
    }

    // 加载鸟类数据
    if (id) {
      loadBirdData();
    }
  }, [id, router]);

  const loadBirdData = async () => {
    try {
      // 从API获取鸟类数据
      const response = await fetch(`/api/birds/${id}`);
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          const birdData = data.data;
          
          // 填充表单数据
          setFormData({
            name: birdData.name || '',
            scientificName: birdData.scientificName || '',
            description: birdData.description || '',
            habitat: birdData.habitat || '',
            distribution: birdData.distribution || '',
            conservationStatus: birdData.conservationStatus || '',
            chinaProtectionLevel: birdData.chinaProtectionLevel || '',
            iucnProtectionLevel: birdData.iucnProtectionLevel || '',
            taxonomy: birdData.category || '',
            tags: Array.isArray(birdData.tags) ? birdData.tags.join(', ') : (birdData.tags || ''),
            size: birdData.size || '',
            weight: birdData.weight || '',
            wingspan: birdData.wingspan || '',
            plumage: birdData.plumage || '',
            bill: birdData.bill || '',
            legs: birdData.legs || '',
            behavior: birdData.behavior || '',
            diet: birdData.diet || '',
            migration: birdData.migration || '',
            breedingSeason: birdData.breedingSeason || '',
            nestType: birdData.nestType || '',
            clutchSize: birdData.clutchSize || '',
            identificationTips: birdData.identificationTips || '',
            similarSpecies: birdData.similarSpecies || '',
            references: birdData.references || '',
          });
        } else {
          setError(data.message || '获取鸟类数据失败');
        }
      } else {
        setError('获取鸟类数据失败');
      }
    } catch (error) {
      setError('加载鸟类数据失败');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleTaxonomyChange = (taxonomy) => {
    setFormData(prev => ({
      ...prev,
      taxonomy: taxonomy
    }));
  };

  const handleProtectionChange = (china, iucn) => {
    setFormData(prev => ({
      ...prev,
      chinaProtectionLevel: china,
      iucnProtectionLevel: iucn
    }));
  };

  // 智能文本解析
  const handleParseText = async () => {
    if (!parserText.trim()) return;
    
    setIsParsing(true);
    try {
      const result = birdTextParser.parseText(parserText);
      
      // 更新表单数据
      setFormData(prev => ({
        ...prev,
        ...result
      }));
      
      setParserText('');
      alert('文本解析完成！');
    } catch (error) {
      alert('文本解析失败，请检查格式');
    } finally {
      setIsParsing(false);
    }
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
      
      // 处理标签
      const tagsArray = formData.tags
        .split(',')
        .map(tag => tag.trim())
        .filter(tag => tag.length > 0);

      // 解析保护状态
      const protectionParsed = parseProtectionStatusText(formData.conservationStatus);

      const response = await fetch(`/api/birds/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          ...formData,
          category: formData.taxonomy,
          chinaProtectionLevel: protectionParsed.china,
          iucnProtectionLevel: protectionParsed.iucn,
          tags: tagsArray,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setSuccess(true);
        setTimeout(() => {
          router.push(`/birds/${id}`);
        }, 2000);
      } else {
        setError(data.message || '更新失败');
      }
    } catch (error) {
      setError('更新失败，请重试');
    } finally {
      setIsLoading(false);
    }
  };

  if (loading) {
    return (
      <div className={styles.container}>
        <Navbar />
        <div className={styles.loadingContainer}>
          <div className={styles.loadingSpinner}></div>
          <p>加载鸟类数据中...</p>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className={styles.container}>
        <Navbar />
        <div className={styles.successContainer}>
          <div className={styles.successIcon}>✅</div>
          <h2>更新成功！</h2>
          <p>鸟类记录已成功更新，正在跳转到详情页面...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <Head>
        <title>编辑鸟类记录 - KBird</title>
      </Head>

      <Navbar />

      <main className={styles.main}>
        <div className={styles.header}>
          <h1>编辑鸟类记录</h1>
          <p>修改鸟类信息</p>
          
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
              <textarea
                value={parserText}
                onChange={(e) => setParserText(e.target.value)}
                placeholder="请粘贴鸟类信息文本，例如：&#10;名称：红头长尾山雀&#10;学名：Aegithalos concinnus&#10;描述：小型鸣禽，头部红褐色&#10;栖息地：针叶林、混交林&#10;分布：中国中部、南部山区&#10;保护状态：三有/无危(LC)&#10;分类：雀形目长尾山雀科长尾山雀属&#10;标签：小型鸟类,森林鸟类,常见种"
                className={styles.parserTextarea}
                rows="8"
              />
              <div className={styles.parseActions}>
                <button
                  type="button"
                  onClick={handleParseText}
                  disabled={isParsing || !parserText.trim()}
                  className={styles.parseActionButton}
                >
                  {isParsing ? '解析中...' : '识别并填充'}
                </button>
              </div>
            </div>
            
            <div className={styles.parserSuggestions}>
              <h4>解析建议：</h4>
              <div className={styles.suggestionsList}>
                {getParsingSuggestions().map((suggestion, index) => (
                  <div key={index} className={styles.suggestionItem}>
                    <strong>{suggestion.field}:</strong> {suggestion.example}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className={styles.errorMessage}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className={styles.form}>
          {/* 基本信息 */}
          <div className={styles.sectionHeader}>
            <h2>📝 基本信息</h2>
          </div>
          
          <div className={styles.formGroup}>
            <label htmlFor="name">鸟类名称 *</label>
            <input
              type="text"
              id="name"
              name="name"
              value={formData.name}
              onChange={handleInputChange}
              required
              placeholder="例如：红头长尾山雀"
            />
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="scientificName">学名 *</label>
            <input
              type="text"
              id="scientificName"
              name="scientificName"
              value={formData.scientificName}
              onChange={handleInputChange}
              required
              placeholder="例如：Aegithalos concinnus"
            />
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="description">描述 *</label>
            <textarea
              id="description"
              name="description"
              value={formData.description}
              onChange={handleInputChange}
              required
              rows="4"
              placeholder="详细描述鸟类特征、习性等"
            />
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="habitat">栖息地 *</label>
            <input
              type="text"
              id="habitat"
              name="habitat"
              value={formData.habitat}
              onChange={handleInputChange}
              required
              placeholder="例如：针叶林、混交林、灌丛"
            />
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="distribution">分布区域 *</label>
            <input
              type="text"
              id="distribution"
              name="distribution"
              value={formData.distribution}
              onChange={handleInputChange}
              required
              placeholder="例如：中国中部、南部及西南部山区"
            />
          </div>

          {/* 分类信息 */}
          <div className={styles.sectionHeader}>
            <h2>🔬 分类信息</h2>
          </div>

          <div className={styles.formGroup}>
            <label>分类 *</label>
            <TaxonomySelector
              value={formData.taxonomy}
              onChange={handleTaxonomyChange}
            />
          </div>

          {/* 保护状态 */}
          <div className={styles.sectionHeader}>
            <h2>🛡️ 保护状态</h2>
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="conservationStatus">保护状态描述</label>
            <input
              type="text"
              id="conservationStatus"
              name="conservationStatus"
              value={formData.conservationStatus}
              onChange={handleInputChange}
              placeholder="例如：无危"
            />
          </div>

          <div className={styles.formGroup}>
            <label>保护级别</label>
            <ProtectionLevelSelector
              chinaValue={formData.chinaProtectionLevel}
              iucnValue={formData.iucnProtectionLevel}
              onChange={handleProtectionChange}
            />
          </div>

          {/* 形态特征 */}
          <div className={styles.sectionHeader}>
            <h2>📏 形态特征</h2>
          </div>

          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label htmlFor="size">体型大小</label>
              <input
                type="text"
                id="size"
                name="size"
                value={formData.size}
                onChange={handleInputChange}
                placeholder="例如：体长10-12厘米"
              />
            </div>
            <div className={styles.formGroup}>
              <label htmlFor="weight">体重</label>
              <input
                type="text"
                id="weight"
                name="weight"
                value={formData.weight}
                onChange={handleInputChange}
                placeholder="例如：6-8克"
              />
            </div>
            <div className={styles.formGroup}>
              <label htmlFor="wingspan">翼展</label>
              <input
                type="text"
                id="wingspan"
                name="wingspan"
                value={formData.wingspan}
                onChange={handleInputChange}
                placeholder="例如：14-16厘米"
              />
            </div>
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="plumage">羽色特征</label>
            <textarea
              id="plumage"
              name="plumage"
              value={formData.plumage}
              onChange={handleInputChange}
              rows="3"
              placeholder="详细描述羽毛颜色、图案等"
            />
          </div>

          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label htmlFor="bill">喙的特征</label>
              <input
                type="text"
                id="bill"
                name="bill"
                value={formData.bill}
                onChange={handleInputChange}
                placeholder="例如：短小尖锐，黑色"
              />
            </div>
            <div className={styles.formGroup}>
              <label htmlFor="legs">腿脚特征</label>
              <input
                type="text"
                id="legs"
                name="legs"
                value={formData.legs}
                onChange={handleInputChange}
                placeholder="例如：细长，灰黑色"
              />
            </div>
          </div>

          {/* 行为习性 */}
          <div className={styles.sectionHeader}>
            <h2>🦅 行为习性</h2>
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="behavior">行为习性</label>
            <textarea
              id="behavior"
              name="behavior"
              value={formData.behavior}
              onChange={handleInputChange}
              rows="3"
              placeholder="描述鸟类的行为特点"
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
                onChange={handleInputChange}
                placeholder="例如：昆虫、蜘蛛等小型无脊椎动物"
              />
            </div>
            <div className={styles.formGroup}>
              <label htmlFor="migration">迁徙习性</label>
              <input
                type="text"
                id="migration"
                name="migration"
                value={formData.migration}
                onChange={handleInputChange}
                placeholder="例如：留鸟，不进行长距离迁徙"
              />
            </div>
          </div>

          {/* 繁殖信息 */}
          <div className={styles.sectionHeader}>
            <h2>🥚 繁殖信息</h2>
          </div>

          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label htmlFor="breedingSeason">繁殖季节</label>
              <input
                type="text"
                id="breedingSeason"
                name="breedingSeason"
                value={formData.breedingSeason}
                onChange={handleInputChange}
                placeholder="例如：3-7月"
              />
            </div>
            <div className={styles.formGroup}>
              <label htmlFor="nestType">巢型</label>
              <input
                type="text"
                id="nestType"
                name="nestType"
                value={formData.nestType}
                onChange={handleInputChange}
                placeholder="例如：球形巢"
              />
            </div>
            <div className={styles.formGroup}>
              <label htmlFor="clutchSize">窝卵数</label>
              <input
                type="text"
                id="clutchSize"
                name="clutchSize"
                value={formData.clutchSize}
                onChange={handleInputChange}
                placeholder="例如：6-8枚"
              />
            </div>
          </div>

          {/* 识别要点 */}
          <div className={styles.sectionHeader}>
            <h2>🔍 识别要点</h2>
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="identificationTips">识别要点</label>
            <textarea
              id="identificationTips"
              name="identificationTips"
              value={formData.identificationTips}
              onChange={handleInputChange}
              rows="3"
              placeholder="描述如何识别该鸟类"
            />
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="similarSpecies">相似物种</label>
            <textarea
              id="similarSpecies"
              name="similarSpecies"
              value={formData.similarSpecies}
              onChange={handleInputChange}
              rows="2"
              placeholder="描述容易混淆的相似物种"
            />
          </div>

          {/* 其他信息 */}
          <div className={styles.sectionHeader}>
            <h2>📚 其他信息</h2>
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="tags">标签</label>
            <input
              type="text"
              id="tags"
              name="tags"
              value={formData.tags}
              onChange={handleInputChange}
              placeholder="用逗号分隔，例如：小型鸟类,森林鸟类,常见种,鸣禽"
            />
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="references">参考资料</label>
            <textarea
              id="references"
              name="references"
              value={formData.references}
              onChange={handleInputChange}
              rows="3"
              placeholder="列出相关的参考资料、文献等"
            />
          </div>

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
              {isLoading ? '更新中...' : '更新记录'}
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}

