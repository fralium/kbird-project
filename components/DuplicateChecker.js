import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import styles from '@/styles/DuplicateChecker.module.css';

export default function DuplicateChecker({ name, scientificName, onConfirm, onCancel }) {
  const [duplicates, setDuplicates] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const checkDuplicates = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/birds/check-duplicate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: name,
          scientificName: scientificName
        }),
      });

      const data = await response.json();

      if (data.success) {
        setDuplicates(data.data.duplicates || []);
      } else {
        setError(data.message || '查重检查失败');
      }
    } catch (error) {
      setError('查重检查失败，请重试');
    } finally {
      setLoading(false);
    }
  }, [name, scientificName]);

  useEffect(() => {
    if (name || scientificName) {
      checkDuplicates();
    }
  }, [name, scientificName, checkDuplicates]);

  const handleConfirm = () => {
    onConfirm();
  };

  const handleCancel = () => {
    onCancel();
  };

  if (loading) {
    return (
      <div className={styles.duplicateChecker}>
        <div className={styles.loading}>
          <div className={styles.spinner}></div>
          <p>正在检查重复记录...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.duplicateChecker}>
        <div className={styles.error}>
          <p>❌ {error}</p>
          <button onClick={checkDuplicates} className={styles.retryButton}>
            重试
          </button>
        </div>
      </div>
    );
  }

  if (duplicates.length === 0) {
    return (
      <div className={styles.duplicateChecker}>
        <div className={styles.noDuplicates}>
          <div className={styles.successIcon}>✅</div>
          <h3>未发现重复记录</h3>
          <p>可以继续添加这个鸟类记录</p>
          <div className={styles.actions}>
            <button onClick={handleCancel} className={styles.cancelButton}>
              取消
            </button>
            <button onClick={handleConfirm} className={styles.confirmButton}>
              确认添加
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.duplicateChecker}>
      <div className={styles.duplicatesFound}>
        <div className={styles.warningIcon}>⚠️</div>
        <h3>发现可能的重复记录</h3>
        <p>以下鸟类记录与您要添加的记录相似，请确认是否继续：</p>
        
        <div className={styles.duplicatesList}>
          {duplicates.map((duplicate, index) => (
            <div key={index} className={styles.duplicateItem}>
              <div className={styles.duplicateHeader}>
                <div className={styles.duplicateInfo}>
                  <h4>{duplicate.name}</h4>
                  <p className={styles.scientificName}>{duplicate.scientificName}</p>
                  <p className={styles.description}>{duplicate.description}</p>
                </div>
                <div className={styles.similarityScore}>
                  <span className={styles.score}>{duplicate.similarity}%</span>
                  <span className={styles.scoreLabel}>相似度</span>
                </div>
              </div>
              
              <div className={styles.duplicateDetails}>
                <div className={styles.detailItem}>
                  <strong>栖息地：</strong> {duplicate.habitat}
                </div>
                <div className={styles.detailItem}>
                  <strong>分布：</strong> {duplicate.distribution}
                </div>
                <div className={styles.detailItem}>
                  <strong>分类：</strong> {duplicate.category}
                </div>
                <div className={styles.detailItem}>
                  <strong>创建者：</strong> {duplicate.createdBy?.name || '未知'}
                </div>
              </div>
              
              <div className={styles.matchReasons}>
                <strong>匹配原因：</strong>
                <ul>
                  {duplicate.matchReasons.map((reason, reasonIndex) => (
                    <li key={reasonIndex}>{reason}</li>
                  ))}
                </ul>
              </div>
              
              <div className={styles.duplicateActions}>
                <Link href={`/birds/${duplicate._id}`} className={styles.viewButton}>
                  查看详情
                </Link>
              </div>
            </div>
          ))}
        </div>
        
        <div className={styles.actions}>
          <button onClick={handleCancel} className={styles.cancelButton}>
            取消添加
          </button>
          <button onClick={handleConfirm} className={styles.confirmButton}>
            仍要添加
          </button>
        </div>
      </div>
    </div>
  );
}