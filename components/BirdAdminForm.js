'use client';

import { useState } from 'react';
import TaxonomySelector from './TaxonomySelector';
import ProtectionLevelSelector from './ProtectionLevelSelector';
import SimplePageHeader, { HeaderPrimaryButton } from './SimplePageHeader';
import { birdTextParser } from '@/utils/birdTextParser';
import {
  normalizeChinaProtectionLevel,
  normalizeIucnProtectionLevel,
  buildProtectionStatusText,
} from '@/data/protectionLevels';
import {
  EMPTY_TAXONOMY_SELECTION,
  parseTaxonomyInput,
} from '@/utils/birdTaxonomyParse';
import styles from '@/styles/AddBird.module.css';

export const EMPTY_BIRD_ADMIN_FORM = {
  name: '',
  scientificName: '',
  nameAliases: '',
  description: '',
  habitat: '',
  distribution: '',
  conservationStatus: '',
  chinaProtectionLevel: '',
  iucnProtectionLevel: '',
  taxonomy: { ...EMPTY_TAXONOMY_SELECTION },
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
};

export function mergeParsedBirdFields(prev, fields) {
  const china = normalizeChinaProtectionLevel(fields.chinaProtectionLevel);
  const iucn = normalizeIucnProtectionLevel(fields.iucnProtectionLevel);
  const { taxonomy: parsedTaxonomyRaw, ...restFields } = fields;
  const next = { ...prev, ...restFields };
  if (parsedTaxonomyRaw != null && parsedTaxonomyRaw !== '') {
    const parsed = parseTaxonomyInput(parsedTaxonomyRaw);
    if (parsed.selection.order || parsed.selection.family) {
      next.taxonomy = {
        ...EMPTY_TAXONOMY_SELECTION,
        ...prev.taxonomy,
        ...parsed.selection,
      };
    }
  }
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
}

export function splitBirdAdminTags(tags) {
  return String(tags || '')
    .split(',')
    .map((tag) => tag.trim())
    .filter((tag) => tag.length > 0);
}

export function splitBirdAdminAliases(aliases) {
  return String(aliases || '')
    .split(/[,，、;；|/]/)
    .map((alias) => alias.trim())
    .filter((alias) => alias.length > 0);
}

/**
 * Shared admin bird create/edit form (parser + fields + actions).
 */
export default function BirdAdminForm({
  title,
  description,
  formData,
  setFormData,
  onSubmit,
  error,
  setError,
  isLoading = false,
  submitLabel = '保存',
  onCancel,
  extraActions = null,
}) {
  const [showParser, setShowParser] = useState(false);
  const [parserText, setParserText] = useState('');
  const [isParsing, setIsParsing] = useState(false);
  const [copyHint, setCopyHint] = useState('');

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
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
    try {
      await navigator.clipboard.writeText(prompt);
      setCopyHint(
        formData.name?.trim()
          ? '提问模板已复制，去外部模型填写后贴回来'
          : '提问模板已复制（建议先填中文名再复制，便于对准鸟种）'
      );
      setError?.(null);
    } catch {
      setParserText(prompt);
      setCopyHint('无法写入剪贴板，模板已放入下方文本框，请全选复制');
    }
    window.setTimeout(() => setCopyHint(''), 4000);
  };

  const handleParseText = async () => {
    if (!parserText.trim()) {
      setError?.('请输入要识别的文本');
      return;
    }
    setIsParsing(true);
    setError?.(null);
    try {
      const fields = birdTextParser.parseText(parserText);
      const filledKeys = Object.keys(fields).filter((k) => String(fields[k] || '').trim());
      if (!filledKeys.length) {
        setError?.('没有识别到可用字段。请确认粘贴的是「字段名：内容」格式');
        return;
      }
      setFormData((prev) => mergeParsedBirdFields(prev, fields));
      setCopyHint(`已填充 ${filledKeys.length} 个字段，请核对后保存`);
      window.setTimeout(() => setCopyHint(''), 4000);
    } catch {
      setError?.('文本解析失败，请检查输入格式');
    } finally {
      setIsParsing(false);
    }
  };

  return (
    <>
      <SimplePageHeader
        title={title}
        description={description}
        descriptionVariant="caption"
        actions={
          <HeaderPrimaryButton onClick={() => setShowParser((v) => !v)}>
            {showParser ? '关闭识别' : '智能识别'}
          </HeaderPrimaryButton>
        }
      />

      {showParser ? (
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
              <button
                type="button"
                onClick={() => {
                  setParserText('');
                  setError?.(null);
                }}
                className={styles.parseActionButton}
                disabled={isParsing || !parserText.trim()}
              >
                清空
              </button>
            </div>
            <div className={styles.parserInput}>
              <textarea
                value={parserText}
                onChange={(e) => setParserText(e.target.value)}
                placeholder="在此粘贴外部大模型返回的「字段名：内容」全文…"
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
      ) : null}

      {copyHint ? <div className={styles.parserHintBanner}>{copyHint}</div> : null}
      {error ? <div className={styles.errorMessage}>{error}</div> : null}

      <form onSubmit={onSubmit} className={styles.form}>
        <div className={styles.sectionHeader}>
          <h2>基本信息</h2>
        </div>
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
            />
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
            />
          </div>
        </div>

        <div className={styles.sectionHeader}>
          <h2>保护状态</h2>
        </div>
        <div className={styles.formGroup}>
          <label>保护级别</label>
          <ProtectionLevelSelector
            chinaValue={formData.chinaProtectionLevel}
            iucnValue={formData.iucnProtectionLevel}
            onChange={handleProtectionChange}
          />
        </div>

        <div className={styles.sectionHeader}>
          <h2>形态特征</h2>
        </div>
        <div className={styles.formRow}>
          <div className={styles.formGroup}>
            <label htmlFor="size">体型大小</label>
            <input type="text" id="size" name="size" value={formData.size} onChange={handleChange} />
          </div>
          <div className={styles.formGroup}>
            <label htmlFor="weight">体重</label>
            <input
              type="text"
              id="weight"
              name="weight"
              value={formData.weight}
              onChange={handleChange}
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
            />
          </div>
          <div className={styles.formGroup}>
            <label htmlFor="bill">喙的特征</label>
            <input type="text" id="bill" name="bill" value={formData.bill} onChange={handleChange} />
          </div>
          <div className={styles.formGroup}>
            <label htmlFor="legs">腿脚特征</label>
            <input type="text" id="legs" name="legs" value={formData.legs} onChange={handleChange} />
          </div>
        </div>

        <div className={styles.sectionHeader}>
          <h2>行为习性</h2>
        </div>
        <div className={styles.formGroup}>
          <label htmlFor="behavior">行为习性</label>
          <textarea
            id="behavior"
            name="behavior"
            value={formData.behavior}
            onChange={handleChange}
            rows="3"
          />
        </div>
        <div className={styles.formRow}>
          <div className={styles.formGroup}>
            <label htmlFor="diet">食性</label>
            <input type="text" id="diet" name="diet" value={formData.diet} onChange={handleChange} />
          </div>
          <div className={styles.formGroup}>
            <label htmlFor="migration">迁徙习性</label>
            <input
              type="text"
              id="migration"
              name="migration"
              value={formData.migration}
              onChange={handleChange}
            />
          </div>
        </div>

        <div className={styles.sectionHeader}>
          <h2>繁殖信息</h2>
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
            />
          </div>
        </div>

        <div className={styles.sectionHeader}>
          <h2>识别要点</h2>
        </div>
        <div className={styles.formGroup}>
          <label htmlFor="identificationTips">识别要点</label>
          <textarea
            id="identificationTips"
            name="identificationTips"
            value={formData.identificationTips}
            onChange={handleChange}
            rows="3"
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
          />
        </div>

        <div className={styles.sectionHeader}>
          <h2>参考资料</h2>
        </div>
        <div className={styles.formGroup}>
          <label htmlFor="references">参考资料</label>
          <textarea
            id="references"
            name="references"
            value={formData.references}
            onChange={handleChange}
            rows="3"
          />
        </div>
        <div className={styles.formGroup}>
          <label htmlFor="tags">标签</label>
          <input type="text" id="tags" name="tags" value={formData.tags} onChange={handleChange} />
          <small>用逗号分隔多个标签</small>
        </div>

        <div className={styles.formActions}>
          {extraActions}
          {onCancel ? (
            <button type="button" onClick={onCancel} className={styles.cancelButton}>
              取消
            </button>
          ) : null}
          <button type="submit" disabled={isLoading} className={styles.submitButton}>
            {isLoading ? '提交中...' : submitLabel}
          </button>
        </div>
      </form>
    </>
  );
}
