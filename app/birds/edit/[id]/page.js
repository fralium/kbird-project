'use client';
/* eslint-disable react-hooks/exhaustive-deps */
import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Navbar from '../../../../components/Navbar';
import TaxonomySelector from '../../../../components/TaxonomySelector';
import ProtectionLevelSelector from '../../../../components/ProtectionLevelSelector';
import { useAuth } from '../../../../components/AuthProvider';
import { birdTextParser } from '../../../../utils/birdTextParser';
import {
  resolveProtectionLevels,
  normalizeChinaProtectionLevel,
  normalizeIucnProtectionLevel,
  buildProtectionStatusText,
} from '../../../../data/protectionLevels';
import { api } from '../../../../utils/api';
import SimplePageHeader, { HeaderPrimaryButton } from '../../../../components/SimplePageHeader';
import { useConfirmDialog } from '../../../../components/ConfirmDialog';
import styles from '../../../../styles/AddBird.module.css';

export default function EditBirdPage() {
  const router = useRouter();
  const params = useParams();
  const id = params?.id;
  const { user, token, loading: userLoading } = useAuth();
  const isAuthenticated = !!token && !!user;

  const [formData, setFormData] = useState({
    name: '',
    scientificName: '',
    nameAliases: '',
    description: '',
    habitat: '',
    distribution: '',
    conservationStatus: '',
    chinaProtectionLevel: '',
    iucnProtectionLevel: '',
    taxonomy: '',
    tags: '',
    size: '',
    weight: '',
    wingspan: '',
    plumage: '',
    bill: '',
    legs: '',
    behavior: '',
    diet: '',
    migration: '',
    breedingSeason: '',
    nestType: '',
    clutchSize: '',
    identificationTips: '',
    similarSpecies: '',
    references: '',
  });

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [showParser, setShowParser] = useState(false);
  const [parserText, setParserText] = useState('');
  const [isParsing, setIsParsing] = useState(false);
  const [copyHint, setCopyHint] = useState('');
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const { ask, dialog: confirmDialog } = useConfirmDialog();

  const loadBirdData = useCallback(async () => {
    try {
      const data = await api.birds.getById(id);
      if (data.success) {
        const birdData = data.data;
        setFormData({
          name: birdData.name || '',
          scientificName: birdData.scientificName || '',
          nameAliases: Array.isArray(birdData.nameAliases)
            ? birdData.nameAliases.join('、')
            : birdData.nameAliases || '',
          description: birdData.description || '',
          habitat: birdData.habitat || '',
          distribution: birdData.distribution || '',
          conservationStatus: birdData.conservationStatus || '',
          chinaProtectionLevel: birdData.chinaProtectionLevel || '',
          iucnProtectionLevel: birdData.iucnProtectionLevel || '',
          taxonomy: birdData.category || '',
          tags: Array.isArray(birdData.tags) ? birdData.tags.join(', ') : birdData.tags || '',
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
    } catch (loadError) {
      setError(loadError?.message || '加载鸟类数据失败');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (typeof window !== 'undefined' && !localStorage.getItem('token')) {
      router.push('/login');
      return;
    }

    if (userLoading) return;

    if (!user || user.role !== 'admin') {
      setError('只有管理员可以编辑鸟种名录');
      setLoading(false);
      return;
    }

    if (id) {
      loadBirdData();
    }
  }, [id, router, user, userLoading, loadBirdData]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleTaxonomyChange = (taxonomy) => {
    setFormData((prev) => ({
      ...prev,
      taxonomy,
    }));
  };

  const handleProtectionChange = (china, iucn) => {
    setFormData((prev) => ({
      ...prev,
      chinaProtectionLevel: china || '',
      iucnProtectionLevel: iucn || '',
      conservationStatus: buildProtectionStatusText(china || '', iucn || ''),
    }));
  };

  const handleCopyPrompt = async () => {
    const prompt = birdTextParser.buildFillPrompt({
      name: formData.name,
      scientificName: formData.scientificName,
    });
    setParserText(prompt);
    setShowParser(true);
    try {
      await navigator.clipboard.writeText(prompt);
      setCopyHint('提问模板已复制，并显示在下方文本框');
      setError(null);
    } catch {
      setCopyHint('无法写入剪贴板，请在下方文本框中全选复制');
    }
    window.setTimeout(() => setCopyHint(''), 5000);
  };

  const handleParseText = async () => {
    if (!parserText.trim()) return;

    setIsParsing(true);
    try {
      const fields = birdTextParser.parseText(parserText);
      const filledKeys = Object.keys(fields).filter((k) => String(fields[k] || '').trim());
      if (!filledKeys.length) {
        setError('没有识别到可用字段。请确认粘贴的是「字段名：内容」格式');
        return;
      }
      const china = normalizeChinaProtectionLevel(fields.chinaProtectionLevel);
      const iucn = normalizeIucnProtectionLevel(fields.iucnProtectionLevel);
      setFormData((prev) => {
        const next = { ...prev, ...fields };
        if (china) next.chinaProtectionLevel = china;
        if (iucn) next.iucnProtectionLevel = iucn;
        if (china || iucn) {
          next.conservationStatus =
            String(fields.conservationStatus || '').trim() ||
            buildProtectionStatusText(
              china || prev.chinaProtectionLevel,
              iucn || prev.iucnProtectionLevel
            );
        }
        return next;
      });
      setError(null);
      setCopyHint(`已填充 ${filledKeys.length} 个字段，请核对后保存`);
      window.setTimeout(() => setCopyHint(''), 4000);
    } catch {
      setError('文本解析失败，请检查格式');
    } finally {
      setIsParsing(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const tagsArray = formData.tags
        .split(',')
        .map((tag) => tag.trim())
        .filter((tag) => tag.length > 0);

      const nameAliasesArray = formData.nameAliases
        .split(/[,，、;；|/]/)
        .map((alias) => alias.trim())
        .filter((alias) => alias.length > 0);

      const protection = resolveProtectionLevels({
        chinaProtectionLevel: formData.chinaProtectionLevel,
        iucnProtectionLevel: formData.iucnProtectionLevel,
        conservationStatus: formData.conservationStatus,
      });

      const data = await api.birds.update(id, {
        ...formData,
        category: formData.taxonomy,
        ...protection,
        tags: tagsArray,
        nameAliases: nameAliasesArray,
      });

      if (data.success) {
        setSuccess(true);
        setTimeout(() => {
          router.push(`/birds/${id}`);
        }, 2000);
      } else {
        setError(data.message || '更新失败');
      }
    } catch (err) {
      setError(err?.message || '更新失败，请重试');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteBird = async () => {
    const ok = await ask({
      message: `确定删除「${formData.name || '此鸟种'}」？\n会一并去掉这只鸟的图片、鸣叫和观察记录。删除后不能恢复。`,
    });
    if (!ok) return;

    setDeleting(true);
    setError(null);
    try {
      const data = await api.birds.delete(id);
      if (data.success) {
        if (typeof window !== 'undefined' && window.showToast) {
          window.showToast('已删除该鸟种', 'success', 2500);
        }
        router.push('/birds');
      } else {
        setError(data.message || '删除失败');
      }
    } catch {
      setError('删除失败，请重试');
    } finally {
      setDeleting(false);
    }
  };

  if (userLoading) {
    return (
      <div className={styles.container}>
        <Navbar />
        <div className={styles.loadingContainer}>
          <div className={styles.loadingSpinner}></div>
          <p>正在检查登录状态...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return (
      <div className={styles.container}>
        <Navbar />
        <div className={styles.errorContainer}>
          <h2>需要登录</h2>
          <p>请先登录才能编辑鸟类信息。</p>
          <button onClick={() => router.push('/login')} className={styles.loginButton}>
            去登录
          </button>
        </div>
      </div>
    );
  }

  if (user.role !== 'admin') {
    return (
      <div className={styles.container}>
        <Navbar />
        <div className={styles.errorContainer}>
          <h2>权限不足</h2>
          <p>只有管理员可以编辑鸟种名录。</p>
          <button onClick={() => router.push('/birds')} className={styles.loginButton}>
            返回鸟种名录
          </button>
        </div>
      </div>
    );
  }

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
      <Navbar />

      <main className={styles.main}>
        <SimplePageHeader
          title="编辑鸟种"
          description="改本机物种资料"
          descriptionVariant="caption"
          actions={
            <HeaderPrimaryButton
              onClick={() => {
                if (!showParser && !parserText.trim()) {
                  setParserText(
                    birdTextParser.buildFillPrompt({
                      name: formData.name,
                      scientificName: formData.scientificName,
                    })
                  );
                }
                setShowParser(!showParser);
              }}
            >
              {showParser ? '关闭识别' : '智能识别'}
            </HeaderPrimaryButton>
          }
        />

        {showParser && (
          <div className={styles.parserSection}>
            <div className={styles.parserHeader}>
              <h3>智能资料回填</h3>
              <p>
                ① 复制提问模板 → ② 交给外部大模型填写 → ③ 把回答整段粘贴回来 → ④ 识别并填充
              </p>
            </div>

            <div className={styles.parserContent}>
              <div className={styles.parserActions}>
                <button type="button" onClick={handleCopyPrompt} className={styles.parseActionButton}>
                  复制提问模板
                </button>
                <button
                  type="button"
                  onClick={handleParseText}
                  disabled={isParsing || !parserText.trim()}
                  className={styles.parseActionButton}
                >
                  {isParsing ? '解析中...' : '识别并填充'}
                </button>
                <button
                  type="button"
                  onClick={() => setParserText('')}
                  className={styles.cancelButton}
                  disabled={isParsing || !parserText}
                >
                  清空
                </button>
              </div>
              <textarea
                value={parserText}
                onChange={(e) => setParserText(e.target.value)}
                placeholder="在此粘贴外部大模型返回的「字段名：内容」全文…"
                className={styles.parserTextarea}
                rows="12"
              />
            </div>

            <div className={styles.parserSuggestions}>
              <h4>使用步骤</h4>
              <ul>
                {birdTextParser.getPromptUsageTips().map((tip) => (
                  <li key={tip}>{tip}</li>
                ))}
              </ul>
              <h4>字段一览</h4>
              <div className={styles.suggestionsList}>
                {birdTextParser.getParsingSuggestions().map((suggestion) => (
                  <div key={suggestion.field} className={styles.suggestionItem}>
                    <strong>{suggestion.field}</strong>
                    {suggestion.example ? `：${suggestion.example}` : ''}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {copyHint ? <div className={styles.parserHintBanner}>{copyHint}</div> : null}
        {error && <div className={styles.errorMessage}>{error}</div>}

        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.sectionHeader}><h2>📝 基本信息</h2></div>
          <div className={styles.formGroup}><label htmlFor="name">鸟类名称 *</label><input type="text" id="name" name="name" value={formData.name} onChange={handleInputChange} required /></div>
          <div className={styles.formGroup}><label htmlFor="scientificName">学名 *</label><input type="text" id="scientificName" name="scientificName" value={formData.scientificName} onChange={handleInputChange} required /></div>
          <div className={styles.formGroup}>
            <label htmlFor="nameAliases">中文别名</label>
            <input
              type="text"
              id="nameAliases"
              name="nameAliases"
              value={formData.nameAliases}
              onChange={handleInputChange}
              placeholder="如：白眉苦恶鸟"
            />
            <small>名录异名、旧称；用顿号或逗号分隔。搜索与地区清单导入会按此匹配。</small>
          </div>
          <div className={styles.formGroup}><label htmlFor="description">描述 *</label><textarea id="description" name="description" value={formData.description} onChange={handleInputChange} required rows="4" /></div>
          <div className={styles.formGroup}><label htmlFor="habitat">栖息地 *</label><input type="text" id="habitat" name="habitat" value={formData.habitat} onChange={handleInputChange} required /></div>
          <div className={styles.formGroup}><label htmlFor="distribution">分布区域 *</label><input type="text" id="distribution" name="distribution" value={formData.distribution} onChange={handleInputChange} required /></div>

          <div className={styles.sectionHeader}><h2>🔬 分类信息</h2></div>
          <div className={styles.formGroup}>
            <label>分类 *</label>
            <TaxonomySelector value={formData.taxonomy} onChange={handleTaxonomyChange} />
          </div>

          <div className={styles.sectionHeader}><h2>🛡️ 保护状态</h2></div>
          <div className={styles.formGroup}><label htmlFor="conservationStatus">保护状态描述</label><input type="text" id="conservationStatus" name="conservationStatus" value={formData.conservationStatus} onChange={handleInputChange} /></div>
          <div className={styles.formGroup}>
            <label>保护级别</label>
            <ProtectionLevelSelector
              chinaValue={formData.chinaProtectionLevel}
              iucnValue={formData.iucnProtectionLevel}
              onChange={handleProtectionChange}
            />
          </div>

          <div className={styles.sectionHeader}><h2>📏 形态特征</h2></div>
          <div className={styles.formRow}>
            <div className={styles.formGroup}><label htmlFor="size">体型大小</label><input type="text" id="size" name="size" value={formData.size} onChange={handleInputChange} /></div>
            <div className={styles.formGroup}><label htmlFor="weight">体重</label><input type="text" id="weight" name="weight" value={formData.weight} onChange={handleInputChange} /></div>
            <div className={styles.formGroup}><label htmlFor="wingspan">翼展</label><input type="text" id="wingspan" name="wingspan" value={formData.wingspan} onChange={handleInputChange} /></div>
          </div>
          <div className={styles.formGroup}><label htmlFor="plumage">羽色特征</label><textarea id="plumage" name="plumage" value={formData.plumage} onChange={handleInputChange} rows="3" /></div>
          <div className={styles.formRow}>
            <div className={styles.formGroup}><label htmlFor="bill">喙的特征</label><input type="text" id="bill" name="bill" value={formData.bill} onChange={handleInputChange} /></div>
            <div className={styles.formGroup}><label htmlFor="legs">腿脚特征</label><input type="text" id="legs" name="legs" value={formData.legs} onChange={handleInputChange} /></div>
          </div>

          <div className={styles.sectionHeader}><h2>🦅 行为习性</h2></div>
          <div className={styles.formGroup}><label htmlFor="behavior">行为习性</label><textarea id="behavior" name="behavior" value={formData.behavior} onChange={handleInputChange} rows="3" /></div>
          <div className={styles.formRow}>
            <div className={styles.formGroup}><label htmlFor="diet">食性</label><input type="text" id="diet" name="diet" value={formData.diet} onChange={handleInputChange} /></div>
            <div className={styles.formGroup}><label htmlFor="migration">迁徙习性</label><input type="text" id="migration" name="migration" value={formData.migration} onChange={handleInputChange} /></div>
          </div>

          <div className={styles.sectionHeader}><h2>🥚 繁殖信息</h2></div>
          <div className={styles.formRow}>
            <div className={styles.formGroup}><label htmlFor="breedingSeason">繁殖季节</label><input type="text" id="breedingSeason" name="breedingSeason" value={formData.breedingSeason} onChange={handleInputChange} /></div>
            <div className={styles.formGroup}><label htmlFor="nestType">巢型</label><input type="text" id="nestType" name="nestType" value={formData.nestType} onChange={handleInputChange} /></div>
            <div className={styles.formGroup}><label htmlFor="clutchSize">窝卵数</label><input type="text" id="clutchSize" name="clutchSize" value={formData.clutchSize} onChange={handleInputChange} /></div>
          </div>

          <div className={styles.sectionHeader}><h2>🔍 识别要点</h2></div>
          <div className={styles.formGroup}><label htmlFor="identificationTips">识别要点</label><textarea id="identificationTips" name="identificationTips" value={formData.identificationTips} onChange={handleInputChange} rows="3" /></div>
          <div className={styles.formGroup}><label htmlFor="similarSpecies">相似物种</label><textarea id="similarSpecies" name="similarSpecies" value={formData.similarSpecies} onChange={handleInputChange} rows="2" /></div>

          <div className={styles.sectionHeader}><h2>📚 其他信息</h2></div>
          <div className={styles.formGroup}><label htmlFor="tags">标签</label><input type="text" id="tags" name="tags" value={formData.tags} onChange={handleInputChange} /></div>
          <div className={styles.formGroup}><label htmlFor="references">参考资料</label><textarea id="references" name="references" value={formData.references} onChange={handleInputChange} rows="3" /></div>

          <div className={styles.formActions}>
            <button
              type="button"
              onClick={handleDeleteBird}
              disabled={isLoading || deleting}
              className={styles.deleteButton}
            >
              {deleting ? '删除中…' : '删除此鸟种'}
            </button>
            <button type="button" onClick={() => router.back()} className={styles.cancelButton}>取消</button>
            <button type="submit" disabled={isLoading || deleting} className={styles.submitButton}>
              {isLoading ? '更新中...' : '更新记录'}
            </button>
          </div>
        </form>
      </main>
      {confirmDialog}
    </div>
  );
}
