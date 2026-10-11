import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { formatAiUsageLine } from '@/utils/aiUsage';
import SpeciesHoverChip from './SpeciesHoverChip';
import styles from '@/styles/AIResult.module.css';

export default function AIResult({ result, onConfirm, onReject }) {
  const [selectedCandidateIndex, setSelectedCandidateIndex] = useState(-1);

  useEffect(() => {
    setSelectedCandidateIndex(-1);
  }, [result]);

  const providerNameMap = {
    openai: 'OpenAI兼容服务',
    hho: 'HHO AI (懂鸟)',
  };

  const normalizeConfidence = (value) => {
    const num = Number(value);
    if (!Number.isFinite(num)) return 0;
    let normalized = num;
    if (normalized > 1) normalized = normalized / 100;
    if (normalized < 0) normalized = 0;
    if (normalized > 1) normalized = 1;
    return normalized;
  };

  const mainResult = {
    name: result?.species || result?.candidates?.[0]?.name || '未知',
    scientificName:
      result?.scientificName || result?.candidates?.[0]?.scientificName || '',
    confidence: normalizeConfidence(
      result?.confidence ?? result?.candidates?.[0]?.confidence ?? 0
    ),
  };

  const possibleResults = useMemo(() => {
    if (!Array.isArray(result?.candidates)) return [];
    const mainName = (mainResult.name || '').trim().toLowerCase();
    const mainSci = (mainResult.scientificName || '').trim().toLowerCase();
    return result.candidates
      .map((item) => ({
        ...item,
        confidence: normalizeConfidence(item.confidence ?? 0),
      }))
      .filter((item) => {
        const candidateName = (item.name || '').trim().toLowerCase();
        const candidateSci = (item.scientificName || '').trim().toLowerCase();
        const sameName = mainName && candidateName && mainName === candidateName;
        const sameSci = mainSci && candidateSci && mainSci === candidateSci;
        return !sameName && !sameSci;
      })
      .sort((a, b) => (b.confidence || 0) - (a.confidence || 0));
  }, [result, mainResult.name, mainResult.scientificName]);

  if (!result) {
    return null;
  }

  const mainName = (mainResult?.name || '').trim();
  const mainScientificName = (mainResult?.scientificName || '').trim().toLowerCase();
  const matchedName = (result.matchedBird?.name || '').trim();
  const matchedScientificName = (result.matchedBird?.scientificName || '').trim().toLowerCase();
  const hasMismatch =
    !!result.matchedBird &&
    ((mainName && matchedName && mainName !== matchedName) ||
      (mainScientificName && matchedScientificName && mainScientificName !== matchedScientificName));

  const selectedCandidate =
    selectedCandidateIndex >= 0 ? possibleResults[selectedCandidateIndex] : null;

  const selectedSpecies = selectedCandidate
    ? {
        name: selectedCandidate.name || mainResult.name,
        scientificName: selectedCandidate.scientificName || '',
        confidence: selectedCandidate.confidence || mainResult.confidence,
      }
    : {
        name: mainResult.name,
        scientificName: mainResult.scientificName,
        confidence: mainResult.confidence,
      };

  const selectedName = (selectedSpecies.name || '').trim().toLowerCase();
  const selectedSci = (selectedSpecies.scientificName || '').trim().toLowerCase();
  const isMatchedBirdSelected =
    !!result.matchedBird &&
    ((selectedName &&
      (result.matchedBird.name || '').trim().toLowerCase() === selectedName) ||
      (selectedSci &&
        (result.matchedBird.scientificName || '').trim().toLowerCase() === selectedSci));

  const handleConfirm = () => {
    if (onConfirm) {
      onConfirm({
        ...selectedSpecies,
        selectedSource: selectedCandidate ? 'candidate' : 'top1',
        matchedBird: isMatchedBirdSelected ? result.matchedBird : null,
        encyclopedia: result.encyclopedia,
        candidates: result.candidates || [],
      });
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h3>🤖 AI识别结果</h3>
        <span className={styles.provider}>{providerNameMap[result.provider] || result.provider || 'AI服务'}</span>
      </div>
      <p className={styles.usageLine}>{formatAiUsageLine(result.usage)}</p>

      {/* 主要识别结果 */}
      <div className={styles.mainResult}>
        <div className={styles.resultCard}>
          <div className={styles.resultHeader}>
            <h4>
              <SpeciesHoverChip name={mainResult.name || ''} className={styles.mainNameHover}>
                {mainResult.name || '未知'}
              </SpeciesHoverChip>
            </h4>
            {mainResult.scientificName && (
              <span className={styles.scientificName}>{mainResult.scientificName}</span>
            )}
          </div>
          <div className={styles.confidence}>
            <div className={styles.confidenceBar}>
              <div
                className={styles.confidenceFill}
                style={{ width: `${(mainResult.confidence || 0) * 100}%` }}
              />
            </div>
            <span className={styles.confidenceText}>
              置信度: {Math.round((mainResult.confidence || 0) * 100)}%
            </span>
            <button
              type="button"
              className={styles.pickButton}
              onClick={() => setSelectedCandidateIndex(-1)}
            >
              选择该结果
            </button>
          </div>
        </div>

        {/* 候选结果 */}
        {possibleResults.length > 0 && (
          <div className={styles.candidates}>
            <h5>其他可能结果：</h5>
            <div className={styles.candidateList}>
              {possibleResults.map((candidate, index) => (
                <div
                  key={index}
                  className={`${styles.candidateItem} ${
                    selectedCandidateIndex === index ? styles.candidateItemActive : ''
                  }`}
                >
                  <SpeciesHoverChip
                    name={candidate.name}
                    className={styles.candidateName}
                  />
                  <span className={styles.candidateConfidence}>
                    {Math.round((candidate.confidence || 0) * 100)}%
                  </span>
                  <button
                    type="button"
                    className={styles.candidateSelectButton}
                    onClick={() => setSelectedCandidateIndex(index)}
                  >
                    使用该候选
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {(result.reasoning || (result.keyFeatures && result.keyFeatures.length > 0) || (result.lookalikes && result.lookalikes.length > 0) || result.uncertainty || result.advice) && (
          <div className={styles.feedbackBlock}>
            <h5>大模型反馈：</h5>
            {result.reasoning && <p><strong>判定依据：</strong>{result.reasoning}</p>}
            {result.keyFeatures && result.keyFeatures.length > 0 && (
              <p><strong>关键特征：</strong>{result.keyFeatures.join('；')}</p>
            )}
            {result.lookalikes && result.lookalikes.length > 0 && (
              <div>
                <strong>易混淆物种：</strong>
                <ul className={styles.lookalikeList}>
                  {result.lookalikes.slice(0, 3).map((item, idx) => (
                    <li key={idx}>
                      <SpeciesHoverChip name={item.name || ''} />
                      {item.scientificName ? ` (${item.scientificName})` : ''}
                      {item.difference ? `：${item.difference}` : ''}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {result.uncertainty && <p><strong>不确定性：</strong>{result.uncertainty}</p>}
            {result.advice && <p><strong>建议：</strong>{result.advice}</p>}
          </div>
        )}

        {/* 匹配的数据库信息 */}
        {result.matchedBird && (
          <div className={styles.matchedInfo}>
            <div className={styles.matchedHeader}>
              <span className={styles.matchedIcon}>✅</span>
              <span>已匹配到数据库</span>
            </div>
            <div className={styles.matchedContent}>
              <p className={styles.matchedName}>
                数据库物种：{result.matchedBird.name}
                {result.matchedBird.scientificName ? ` (${result.matchedBird.scientificName})` : ''}
              </p>
              {result.matchDetails && (
                <p className={styles.matchHint}>
                  匹配依据：{result.matchDetails.matchedBy === 'scientificName' ? '学名' : '中文名'}
                  {result.matchDetails.source ? ` / 来源 ${result.matchDetails.source}` : ''}
                </p>
              )}
              <Link href={`/birds/${result.matchedBird._id}`} className={styles.birdLink}>
                查看详情 →
              </Link>
            </div>
          </div>
        )}

        {hasMismatch && (
          <div className={styles.mismatchWarning}>
            当前AI候选与数据库匹配结果不一致，建议优先核对学名与关键特征后再确认。
          </div>
        )}
      </div>

      {/* 操作按钮 */}
      <div className={styles.actions}>
        {onConfirm && (
          <button
            onClick={handleConfirm}
            className={styles.confirmButton}
          >
            ✓ 一键填充记录表单
          </button>
        )}
        {onReject && (
          <button
            onClick={onReject}
            className={styles.rejectButton}
          >
            ✕ 手动输入
          </button>
        )}
      </div>
    </div>
  );
}
