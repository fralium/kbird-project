'use client';
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Navbar from '../../../components/Navbar';
import Footer from '../../../components/Footer';
import { useErrorHandler } from '../../../utils/useErrorHandler';
import ErrorMessage from '../../../components/ErrorMessage';
import TaxonomySelector from '../../../components/TaxonomySelector';
import ProtectionLevelSelector from '../../../components/ProtectionLevelSelector';
import { birdTextParser } from '../../../utils/birdTextParser';
import {
  resolveProtectionLevels,
  normalizeChinaProtectionLevel,
  normalizeIucnProtectionLevel,
  buildProtectionStatusText,
  parseProtectionStatusText,
} from '../../../data/protectionLevels';
import { api } from '../../../utils/api';
import { devError } from '../../../utils/devLogger';
import SimplePageHeader, { HeaderPrimaryButton } from '../../../components/SimplePageHeader';
import styles from '../../../styles/AddBird.module.css';

export default function AddBirdPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const redirectTimerRef = useRef(null);
  const { errors, addError, removeError } = useErrorHandler();

  useEffect(() => {
    return () => {
      if (redirectTimerRef.current) {
        clearTimeout(redirectTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const checkUserAuth = async () => {
      const token = localStorage.getItem('token');
      if (!token) {
        router.push('/login');
        return;
      }

      try {
        const data = await api.users.getProfile();

        if (data.success) {
          if (data.data.role !== 'admin') {
            router.push('/');
            return;
          }
          setUser(data.data);
        } else {
          router.push('/login');
        }
      } catch (error) {
        devError('权限检查失败:', error);
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
  const [duplicateConfirm, setDuplicateConfirm] = useState(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('token');
      if (!token) {
        router.push('/login');
      }
    }
  }, [router]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleCopyPrompt = async () => {
    const prompt = birdTextParser.buildFillPrompt({
      name: formData.name,
      scientificName: formData.scientificName,
    });
    // Always show template in the box (same as edit); clipboard is optional.
    setParserText(prompt);
    setShowParser(true);
    try {
      await navigator.clipboard.writeText(prompt);
      setCopyHint(
        formData.name?.trim()
          ? '提问模板已复制，并显示在下方文本框'
          : '提问模板已放入下方；建议先填中文名再复制，便于模型对准鸟种'
      );
      setError(null);
    } catch {
      setCopyHint('无法写入剪贴板，请在下方文本框中全选复制');
    }
    window.setTimeout(() => setCopyHint(''), 5000);
  };

  const handleParseText = async () => {
    if (!parserText.trim()) {
      setError('请输入要识别的文本');
      return;
    }

    setIsParsing(true);
    setError(null);

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

      addError(`已填充 ${filledKeys.length} 个字段，请核对后保存。`, 'success');
      setCopyHint(`已填充 ${filledKeys.length} 个字段`);
      window.setTimeout(() => setCopyHint(''), 4000);
    } catch {
      setError('文本解析失败，请检查输入格式');
    } finally {
      setIsParsing(false);
    }
  };

  const clearParserText = () => {
    setParserText('');
    setError(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const duplicateData = await api.birds.checkDuplicate({
        name: formData.name,
        scientificName: formData.scientificName,
      });

      if (duplicateData.success && duplicateData.data.hasDuplicates) {
        const duplicates = duplicateData.data.duplicates;
        setDuplicateConfirm({
          duplicates,
          onConfirm: () => {
            setDuplicateConfirm(null);
            continueSubmit();
          },
          onCancel: () => {
            setDuplicateConfirm(null);
            setIsLoading(false);
          },
        });
        return;
      }

      continueSubmit();
    } catch (submitError) {
      devError('提交失败:', submitError);
      addError(`提交失败，请重试：${submitError.message || '未知错误'}`);
      setIsLoading(false);
    }
  };

  const continueSubmit = async () => {
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

      const data = await api.birds.create({
        ...formData,
        category: formData.taxonomy,
        ...protection,
        tags: tagsArray,
        nameAliases: nameAliasesArray,
      });

      if (!data?.success) {
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

  if (loading) {
    return (
      <div className={styles.container}>
        <Navbar />
        <div className={styles.loadingContainer}>
          <div className={styles.loadingMessage}>🔍 检查权限中...</div>
        </div>
        <Footer />
      </div>
    );
  }

  if (!user || user.role !== 'admin') {
    return (
      <div className={styles.container}>
        <Navbar />
        <div className={styles.errorContainer}>
          <div className={styles.errorMessage}>❌ 只有管理员可以添加鸟类品种</div>
          <button className={styles.backButton} onClick={() => router.push('/')}>
            返回首页
          </button>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <Navbar />

      {errors.map((item) => (
        <ErrorMessage
          key={item.id}
          error={item.message}
          type={item.type}
          onClose={() => removeError(item.id)}
        />
      ))}

      {duplicateConfirm && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal}>
            <h3>发现相似鸟类记录</h3>
            <p>以下鸟类记录与您要添加的记录相似，请确认是否继续：</p>
            <div className={styles.duplicatesList}>
              {duplicateConfirm.duplicates.map((bird, index) => (
                <div key={index} className={styles.duplicateItem}>
                  <h4>
                    {bird.name} ({bird.scientificName})
                  </h4>
                  <p>相似度: {bird.similarity}%</p>
                  <p>原因: {bird.matchReasons.join(', ')}</p>
                </div>
              ))}
            </div>
            <div className={styles.modalActions}>
              <button onClick={duplicateConfirm.onCancel} className={styles.cancelButton}>
                取消
              </button>
              <button onClick={duplicateConfirm.onConfirm} className={styles.confirmButton}>
                仍要添加
              </button>
            </div>
          </div>
        </div>
      )}

      <main className={styles.main}>
        <SimplePageHeader
          title="添加鸟种"
          description="补本机鸟种库"
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
                  className={styles.parseActionButton}
                  disabled={isParsing || !parserText.trim()}
                >
                  {isParsing ? '识别中...' : '识别并填充'}
                </button>
                <button type="button" onClick={clearParserText} className={styles.clearButton} disabled={isParsing}>
                  清空
                </button>
              </div>
              <div className={styles.parserInput}>
                <textarea
                  value={parserText}
                  onChange={(e) => setParserText(e.target.value)}
                  placeholder="打开「智能识别」会先放入提问模板；也可点「复制提问模板」。把大模型填好的「字段名：内容」贴回这里再识别。"
                  className={styles.parserTextarea}
                  rows="12"
                />
              </div>
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

        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label htmlFor="name">鸟类名称 *</label>
              <input type="text" id="name" name="name" value={formData.name} onChange={handleChange} required />
            </div>
            <div className={styles.formGroup}>
              <label htmlFor="scientificName">学名 *</label>
              <input type="text" id="scientificName" name="scientificName" value={formData.scientificName} onChange={handleChange} required />
            </div>
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="nameAliases">中文别名</label>
            <input
              type="text"
              id="nameAliases"
              name="nameAliases"
              value={formData.nameAliases}
              onChange={handleChange}
              placeholder="如：白眉苦恶鸟"
            />
            <small>名录异名、旧称；用顿号或逗号分隔。搜索与地区清单导入会按此匹配。</small>
          </div>

          <div className={styles.formGroup}>
            <label>分类 *</label>
            <TaxonomySelector
              value={formData.taxonomy}
              onChange={(value) => setFormData((prev) => ({ ...prev, taxonomy: value }))}
              placeholder="请选择分类"
              showSpecies={true}
            />
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="description">描述 *</label>
            <textarea id="description" name="description" value={formData.description} onChange={handleChange} required rows="4" />
          </div>

          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label htmlFor="habitat">栖息地 *</label>
              <input type="text" id="habitat" name="habitat" value={formData.habitat} onChange={handleChange} required />
            </div>
            <div className={styles.formGroup}>
              <label htmlFor="distribution">分布区域 *</label>
              <input type="text" id="distribution" name="distribution" value={formData.distribution} onChange={handleChange} required />
            </div>
          </div>

          <div className={styles.formGroup}>
            <label>保护状态</label>
            <ProtectionLevelSelector
              value={formData.conservationStatus}
              onChange={(value) => {
                const parsed = parseProtectionStatusText(value);
                setFormData((prev) => ({
                  ...prev,
                  conservationStatus: value,
                  chinaProtectionLevel: parsed.china || prev.chinaProtectionLevel,
                  iucnProtectionLevel: parsed.iucn || prev.iucnProtectionLevel,
                }));
              }}
            />
          </div>

          <div className={styles.sectionHeader}><h3>📏 形态特征</h3></div>
          <div className={styles.formRow}>
            <div className={styles.formGroup}><label htmlFor="size">体型大小</label><input type="text" id="size" name="size" value={formData.size} onChange={handleChange} /></div>
            <div className={styles.formGroup}><label htmlFor="weight">体重</label><input type="text" id="weight" name="weight" value={formData.weight} onChange={handleChange} /></div>
            <div className={styles.formGroup}><label htmlFor="wingspan">翼展</label><input type="text" id="wingspan" name="wingspan" value={formData.wingspan} onChange={handleChange} /></div>
          </div>
          <div className={styles.formRow}>
            <div className={styles.formGroup}><label htmlFor="plumage">羽色特征</label><input type="text" id="plumage" name="plumage" value={formData.plumage} onChange={handleChange} /></div>
            <div className={styles.formGroup}><label htmlFor="bill">喙的特征</label><input type="text" id="bill" name="bill" value={formData.bill} onChange={handleChange} /></div>
            <div className={styles.formGroup}><label htmlFor="legs">腿脚特征</label><input type="text" id="legs" name="legs" value={formData.legs} onChange={handleChange} /></div>
          </div>

          <div className={styles.sectionHeader}><h3>🦅 行为习性</h3></div>
          <div className={styles.formGroup}><label htmlFor="behavior">行为习性</label><textarea id="behavior" name="behavior" value={formData.behavior} onChange={handleChange} rows="3" /></div>
          <div className={styles.formRow}>
            <div className={styles.formGroup}><label htmlFor="diet">食性</label><input type="text" id="diet" name="diet" value={formData.diet} onChange={handleChange} /></div>
            <div className={styles.formGroup}><label htmlFor="migration">迁徙习性</label><input type="text" id="migration" name="migration" value={formData.migration} onChange={handleChange} /></div>
          </div>

          <div className={styles.sectionHeader}><h3>🥚 繁殖信息</h3></div>
          <div className={styles.formRow}>
            <div className={styles.formGroup}><label htmlFor="breedingSeason">繁殖季节</label><input type="text" id="breedingSeason" name="breedingSeason" value={formData.breedingSeason} onChange={handleChange} /></div>
            <div className={styles.formGroup}><label htmlFor="nestType">巢型</label><input type="text" id="nestType" name="nestType" value={formData.nestType} onChange={handleChange} /></div>
            <div className={styles.formGroup}><label htmlFor="clutchSize">窝卵数</label><input type="text" id="clutchSize" name="clutchSize" value={formData.clutchSize} onChange={handleChange} /></div>
          </div>

          <div className={styles.sectionHeader}><h3>🔍 识别要点</h3></div>
          <div className={styles.formGroup}><label htmlFor="identificationTips">识别要点</label><textarea id="identificationTips" name="identificationTips" value={formData.identificationTips} onChange={handleChange} rows="3" /></div>
          <div className={styles.formGroup}><label htmlFor="similarSpecies">相似物种</label><input type="text" id="similarSpecies" name="similarSpecies" value={formData.similarSpecies} onChange={handleChange} /></div>

          <div className={styles.sectionHeader}><h3>📚 参考资料</h3></div>
          <div className={styles.formGroup}><label htmlFor="references">参考资料</label><textarea id="references" name="references" value={formData.references} onChange={handleChange} rows="3" /></div>
          <div className={styles.formGroup}>
            <label htmlFor="tags">标签</label>
            <input type="text" id="tags" name="tags" value={formData.tags} onChange={handleChange} />
            <small>用逗号分隔多个标签</small>
          </div>

          {error && <div className={styles.errorMessage}>{error}</div>}

          <div className={styles.formActions}>
            <button type="button" onClick={() => router.back()} className={styles.cancelButton}>
              取消
            </button>
            <button type="submit" disabled={isLoading} className={styles.submitButton}>
              {isLoading ? '创建中...' : '创建鸟类记录'}
            </button>
          </div>
        </form>
      </main>

      <Footer />
    </div>
  );
}
