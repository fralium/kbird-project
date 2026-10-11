import { useState, useEffect } from 'react';
import {
  getChinaProtectionLevels,
  getIucnProtectionLevels,
  getProtectionLevelInfo,
  buildProtectionStatusText,
  parseProtectionStatusText,
  normalizeChinaProtectionLevel,
  normalizeIucnProtectionLevel,
} from '@/data/protectionLevels';
import styles from '@/styles/ProtectionLevelSelector.module.css';

/**
 * 兼容两种用法：
 * 1) value + onChange(text) — 新增页
 * 2) chinaValue/iucnValue + onChange(china, iucn) — 编辑页
 */
const ProtectionLevelSelector = ({
  value = '',
  chinaValue,
  iucnValue,
  onChange,
  className = '',
}) => {
  const [chinaLevel, setChinaLevel] = useState('');
  const [iucnLevel, setIucnLevel] = useState('');
  const [chinaLevels, setChinaLevels] = useState([]);
  const [iucnLevels, setIucnLevels] = useState([]);

  const usesSplitApi = chinaValue !== undefined || iucnValue !== undefined;

  useEffect(() => {
    setChinaLevels(getChinaProtectionLevels());
    setIucnLevels(getIucnProtectionLevels());
  }, []);

  useEffect(() => {
    if (usesSplitApi) {
      setChinaLevel(normalizeChinaProtectionLevel(chinaValue) || '');
      setIucnLevel(normalizeIucnProtectionLevel(iucnValue) || '');
      return;
    }
    if (value) {
      const parsed = parseProtectionStatusText(value);
      setChinaLevel(parsed.china);
      setIucnLevel(parsed.iucn);
    } else {
      setChinaLevel('');
      setIucnLevel('');
    }
  }, [usesSplitApi, chinaValue, iucnValue, value]);

  const emitChange = (china, iucn) => {
    if (!onChange) return;
    if (usesSplitApi) {
      onChange(china, iucn);
      return;
    }
    onChange(buildProtectionStatusText(china, iucn));
  };

  const handleChinaLevelChange = (e) => {
    const level = e.target.value;
    setChinaLevel(level);
    emitChange(level, iucnLevel);
  };

  const handleIucnLevelChange = (e) => {
    const level = e.target.value;
    setIucnLevel(level);
    emitChange(chinaLevel, level);
  };

  const clearSelection = () => {
    setChinaLevel('');
    setIucnLevel('');
    if (!onChange) return;
    if (usesSplitApi) {
      onChange('', '');
      return;
    }
    onChange('');
  };

  const chinaInfo = getProtectionLevelInfo('china', chinaLevel);
  const iucnInfo = getProtectionLevelInfo('iucn', iucnLevel);

  return (
    <div className={`${styles.protectionSelector} ${className}`}>
      <div className={styles.selectorRow}>
        <div className={styles.selectorGroup}>
          <label htmlFor="chinaLevel">🇨🇳 中国保护级别</label>
          <select
            id="chinaLevel"
            value={chinaLevel}
            onChange={handleChinaLevelChange}
            className={styles.selector}
          >
            <option value="">请选择中国保护级别</option>
            {chinaLevels.map((level) => (
              <option key={level} value={level}>
                {level}
              </option>
            ))}
          </select>
          {chinaInfo && (
            <div className={styles.levelInfo}>
              <span className={styles.levelIcon} style={{ color: chinaInfo.color}}>
                {chinaInfo.icon}
              </span>
              <span className={styles.levelDescription}>{chinaInfo.description}</span>
            </div>
          )}
        </div>

        <div className={styles.selectorGroup}>
          <label htmlFor="iucnLevel">🌍 IUCN保护级别</label>
          <select
            id="iucnLevel"
            value={iucnLevel}
            onChange={handleIucnLevelChange}
            className={styles.selector}
          >
            <option value="">请选择IUCN保护级别</option>
            {iucnLevels.map((level) => (
              <option key={level} value={level}>
                {level}
              </option>
            ))}
          </select>
          {iucnInfo && (
            <div className={styles.levelInfo}>
              <span className={styles.levelIcon} style={{ color: iucnInfo.color}}>
                {iucnInfo.icon}
              </span>
              <span className={styles.levelDescription}>{iucnInfo.description}</span>
            </div>
          )}
        </div>
      </div>

      {(chinaLevel || iucnLevel) && (
        <div className={styles.selectedStatus}>
          <span className={styles.statusLabel}>当前保护状态：</span>
          <div className={styles.statusValue}>
            {chinaLevel && (
              <span className={styles.statusItem} style={{ color: chinaInfo?.color}}>
                🇨🇳 {chinaLevel}
              </span>
            )}
            {chinaLevel && iucnLevel && <span className={styles.separator}>|</span>}
            {iucnLevel && (
              <span className={styles.statusItem} style={{ color: iucnInfo?.color}}>
                🌍 {iucnLevel}
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={clearSelection}
            className={styles.clearButton}
            title="清空选择"
          >
            ✕
          </button>
        </div>
      )}

      <div className={styles.helpText}>
        <p>💡 可以选择中国保护级别、IUCN保护级别，或两者都选择</p>
      </div>
    </div>
  );
};

export default ProtectionLevelSelector;
