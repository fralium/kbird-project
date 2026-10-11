import { useState, useEffect, useMemo } from 'react';
import { getTaxonomyData } from '@/data/birdTaxonomy';
import { getFamilyChineseName, getOrderChineseName } from '@/data/taxonomyTranslation';
import styles from '@/styles/TaxonomySelector.module.css';

function normalizeSelection(value) {
  if (!value || typeof value !== 'object') {
    return { order: '', family: '', genus: '', species: '' };
  }
  return {
    order: getOrderChineseName(value.order) || String(value.order || '').trim(),
    family: getFamilyChineseName(value.family) || String(value.family || '').trim(),
    genus: String(value.genus || '').trim(),
    species: String(value.species || '').trim(),
  };
}

export default function TaxonomySelector({ value, onChange }) {
  const [taxonomyData, setTaxonomyData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedTaxonomy, setSelectedTaxonomy] = useState(() => normalizeSelection(value));

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
    setSelectedTaxonomy(normalizeSelection(value));
  }, [value]);

  const orderOptions = useMemo(() => {
    const base = taxonomyData?.orders || [];
    if (selectedTaxonomy.order && !base.includes(selectedTaxonomy.order)) {
      return [selectedTaxonomy.order, ...base];
    }
    return base;
  }, [taxonomyData, selectedTaxonomy.order]);

  const familyOptions = useMemo(() => {
    const base =
      (selectedTaxonomy.order && taxonomyData?.families?.[selectedTaxonomy.order]) || [];
    if (selectedTaxonomy.family && !base.includes(selectedTaxonomy.family)) {
      return [selectedTaxonomy.family, ...base];
    }
    return base;
  }, [taxonomyData, selectedTaxonomy.order, selectedTaxonomy.family]);

  const genusOptions = useMemo(() => {
    if (!selectedTaxonomy.order || !selectedTaxonomy.family) return [];
    const key = `${selectedTaxonomy.order}_${selectedTaxonomy.family}`;
    const base = taxonomyData?.genera?.[key] || [];
    if (selectedTaxonomy.genus && !base.includes(selectedTaxonomy.genus)) {
      return [selectedTaxonomy.genus, ...base];
    }
    return base;
  }, [taxonomyData, selectedTaxonomy.order, selectedTaxonomy.family, selectedTaxonomy.genus]);

  const speciesOptions = useMemo(() => {
    if (!selectedTaxonomy.order || !selectedTaxonomy.family || !selectedTaxonomy.genus) {
      return [];
    }
    const key = `${selectedTaxonomy.order}_${selectedTaxonomy.family}_${selectedTaxonomy.genus}`;
    const base = taxonomyData?.species?.[key] || [];
    if (selectedTaxonomy.species && !base.includes(selectedTaxonomy.species)) {
      return [selectedTaxonomy.species, ...base];
    }
    return base;
  }, [
    taxonomyData,
    selectedTaxonomy.order,
    selectedTaxonomy.family,
    selectedTaxonomy.genus,
    selectedTaxonomy.species,
  ]);

  const handleTaxonomyChange = (field, selectedValue) => {
    const newTaxonomy = {
      ...selectedTaxonomy,
      [field]: selectedValue,
    };
    if (field === 'order') {
      newTaxonomy.family = '';
      newTaxonomy.genus = '';
      newTaxonomy.species = '';
    } else if (field === 'family') {
      newTaxonomy.genus = '';
      newTaxonomy.species = '';
    } else if (field === 'genus') {
      newTaxonomy.species = '';
    }

    setSelectedTaxonomy(newTaxonomy);
    onChange?.(newTaxonomy);
  };

  if (loading) {
    return <div className={styles.loading}>加载分类数据中...</div>;
  }

  if (!taxonomyData) {
    return <div className={styles.error}>无法加载分类数据</div>;
  }

  return (
    <div className={styles.taxonomySelector}>
      <div className={styles.taxonomyGroup}>
        <label>目 *</label>
        <select
          value={selectedTaxonomy.order || ''}
          onChange={(e) => handleTaxonomyChange('order', e.target.value)}
          className={styles.select}
        >
          <option value="">选择目</option>
          {orderOptions.map((order) => (
            <option key={order} value={order}>
              {order}
            </option>
          ))}
        </select>
      </div>

      <div className={styles.taxonomyGroup}>
        <label>科 *</label>
        <select
          value={selectedTaxonomy.family || ''}
          onChange={(e) => handleTaxonomyChange('family', e.target.value)}
          className={styles.select}
          disabled={!selectedTaxonomy.order}
        >
          <option value="">选择科</option>
          {familyOptions.map((family) => (
            <option key={family} value={family}>
              {family}
            </option>
          ))}
        </select>
      </div>

      <div className={styles.taxonomyGroup}>
        <label>属</label>
        <select
          value={selectedTaxonomy.genus || ''}
          onChange={(e) => handleTaxonomyChange('genus', e.target.value)}
          className={styles.select}
          disabled={!selectedTaxonomy.family}
        >
          <option value="">选择属（可选）</option>
          {genusOptions.map((genus) => (
            <option key={genus} value={genus}>
              {genus}
            </option>
          ))}
        </select>
      </div>

      <div className={styles.taxonomyGroup}>
        <label>种</label>
        <select
          value={selectedTaxonomy.species || ''}
          onChange={(e) => handleTaxonomyChange('species', e.target.value)}
          className={styles.select}
          disabled={!selectedTaxonomy.genus}
        >
          <option value="">选择种（可选）</option>
          {speciesOptions.map((species) => (
            <option key={species} value={species}>
              {species}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
