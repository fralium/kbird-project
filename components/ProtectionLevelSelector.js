import { useState, useEffect } from 'react';
import { 
  getChinaProtectionLevels, 
  getIucnProtectionLevels,
  getProtectionLevelInfo,
  buildProtectionStatusText,
  parseProtectionStatusText
} from '../data/protectionLevels';
import styles from '../styles/ProtectionLevelSelector.module.css';

const ProtectionLevelSelector = ({ 
  value = '', 
  onChange, 
  className = '' 
}) => {
  const [chinaLevel, setChinaLevel] = useState('');
  const [iucnLevel, setIucnLevel] = useState('');
  
  const [chinaLevels, setChinaLevels] = useState([]);
  const [iucnLevels, setIucnLevels] = useState([]);

  // 初始化数据
  useEffect(() => {
    setChinaLevels(getChinaProtectionLevels());
    setIucnLevels(getIucnProtectionLevels());
  }, []);

  // 解析初始值
  useEffect(() => {
    if (value) {
      const parsed = parseProtectionStatusText(value);
      setChinaLevel(parsed.china);
      setIucnLevel(parsed.iucn);
    }
  }, [value]);

  // 处理中国保护级别变化
  const handleChinaLevelChange = (e) => {
    const level = e.target.value;
    setChinaLevel(level);
    updateValue(level, iucnLevel);
  };

  // 处理IUCN保护级别变化
  const handleIucnLevelChange = (e) => {
    const level = e.target.value;
    setIucnLevel(level);
    updateValue(chinaLevel, level);
  };

  // 更新值
  const updateValue = (china, iucn) => {
    const text = buildProtectionStatusText(china, iucn);
    if (onChange) {
      onChange(text);
    }
  };

  // 清空选择
  const clearSelection = () => {
    setChinaLevel('');
    setIucnLevel('');
    if (onChange) {
      onChange('');
    }
  };

  // 获取保护级别信息
  const chinaInfo = getProtectionLevelInfo('china', chinaLevel);
  const iucnInfo = getProtectionLevelInfo('iucn', iucnLevel);

  return (
    <div className={`${styles.protectionSelector} ${className}`}>
      <div className={styles.selectorRow}>
        <div className={styles.selectorGroup}>
          <label htmlFor="chinaLevel">
            🇨🇳 中国保护级别
          </label>
          <select
            id="chinaLevel"
            value={chinaLevel}
            onChange={handleChinaLevelChange}
            className={styles.selector}
          >
            <option value="">请选择中国保护级别</option>
            {chinaLevels.map(level => (
              <option key={level} value={level}>
                {level}
              </option>
            ))}
          </select>
          {chinaInfo && (
            <div className={styles.levelInfo}>
              <span className={styles.levelIcon} style={{ color: chinaInfo.color }}>
                {chinaInfo.icon}
              </span>
              <span className={styles.levelDescription}>
                {chinaInfo.description}
              </span>
            </div>
          )}
        </div>

        <div className={styles.selectorGroup}>
          <label htmlFor="iucnLevel">
            🌍 IUCN保护级别
          </label>
          <select
            id="iucnLevel"
            value={iucnLevel}
            onChange={handleIucnLevelChange}
            className={styles.selector}
          >
            <option value="">请选择IUCN保护级别</option>
            {iucnLevels.map(level => (
              <option key={level} value={level}>
                {level}
              </option>
            ))}
          </select>
          {iucnInfo && (
            <div className={styles.levelInfo}>
              <span className={styles.levelIcon} style={{ color: iucnInfo.color }}>
                {iucnInfo.icon}
              </span>
              <span className={styles.levelDescription}>
                {iucnInfo.description}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* 显示当前选择的完整状态 */}
      {(chinaLevel || iucnLevel) && (
        <div className={styles.selectedStatus}>
          <span className={styles.statusLabel}>当前保护状态：</span>
          <div className={styles.statusValue}>
            {chinaLevel && (
              <span className={styles.statusItem} style={{ color: chinaInfo?.color }}>
                🇨🇳 {chinaLevel}
              </span>
            )}
            {chinaLevel && iucnLevel && <span className={styles.separator}>|</span>}
            {iucnLevel && (
              <span className={styles.statusItem} style={{ color: iucnInfo?.color }}>
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

      {/* 帮助信息 */}
      <div className={styles.helpText}>
        <p>💡 可以选择中国保护级别、IUCN保护级别，或两者都选择</p>
      </div>
    </div>
  );
};

export default ProtectionLevelSelector;














