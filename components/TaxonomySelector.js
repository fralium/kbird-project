import { useState, useEffect } from 'react';
import { getTaxonomyData } from '../data/birdTaxonomy';
import styles from '../styles/TaxonomySelector.module.css';

export default function TaxonomySelector({ value, onChange }) {
  const [taxonomyData, setTaxonomyData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedTaxonomy, setSelectedTaxonomy] = useState(value || {});

  useEffect(() => {
    const loadTaxonomy = async () => {
      try {
        const data = await getTaxonomyData();
        setTaxonomyData(data);
        setLoading(false);
      } catch (error) {
        console.error('加载分类数据失败:', error);
        setLoading(false);
      }
    };

    loadTaxonomy();
  }, []);

  useEffect(() => {
    if (value) {
      setSelectedTaxonomy(value);
    }
  }, [value]);

  const handleTaxonomyChange = (field, selectedValue) => {
    const newTaxonomy = {
      ...selectedTaxonomy,
      [field]: selectedValue
    };
    
    setSelectedTaxonomy(newTaxonomy);
    onChange && onChange(newTaxonomy);
  };

  if (loading) {
    return <div className={styles.loading}>加载分类数据中...</div>;
  }

  if (!taxonomyData) {
    return <div className={styles.error}>无法加载分类数据</div>;
  }

  return (
    <div className={styles.taxonomySelector}>
      {/* 目 */}
      <div className={styles.taxonomyGroup}>
        <label>目 *</label>
        <select
          value={selectedTaxonomy.order || ''}
          onChange={(e) => handleTaxonomyChange('order', e.target.value)}
          className={styles.select}
        >
          <option value="">选择目</option>
          {taxonomyData.orders.map((order) => (
            <option key={order} value={order}>
              {order}
            </option>
          ))}
        </select>
      </div>

      {/* 科 */}
      <div className={styles.taxonomyGroup}>
        <label>科 *</label>
        <select
          value={selectedTaxonomy.family || ''}
          onChange={(e) => handleTaxonomyChange('family', e.target.value)}
          className={styles.select}
          disabled={!selectedTaxonomy.order}
        >
          <option value="">选择科</option>
          {selectedTaxonomy.order && taxonomyData.families[selectedTaxonomy.order]?.map((family) => (
            <option key={family} value={family}>
              {family}
            </option>
          ))}
        </select>
      </div>

      {/* 属 */}
      <div className={styles.taxonomyGroup}>
        <label>属</label>
        <select
          value={selectedTaxonomy.genus || ''}
          onChange={(e) => handleTaxonomyChange('genus', e.target.value)}
          className={styles.select}
          disabled={!selectedTaxonomy.family}
        >
          <option value="">选择属（可选）</option>
          {selectedTaxonomy.family && taxonomyData.genera[`${selectedTaxonomy.order}_${selectedTaxonomy.family}`]?.map((genus) => (
            <option key={genus} value={genus}>
              {genus}
            </option>
          ))}
        </select>
      </div>

      {/* 种 */}
      <div className={styles.taxonomyGroup}>
        <label>种</label>
        <select
          value={selectedTaxonomy.species || ''}
          onChange={(e) => handleTaxonomyChange('species', e.target.value)}
          className={styles.select}
          disabled={!selectedTaxonomy.genus}
        >
          <option value="">选择种（可选）</option>
          {selectedTaxonomy.genus && taxonomyData.species[`${selectedTaxonomy.order}_${selectedTaxonomy.family}_${selectedTaxonomy.genus}`]?.map((species) => (
            <option key={species} value={species}>
              {species}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}




