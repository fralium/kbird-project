'use client';

import { useState, useEffect, useCallback } from 'react';

export const COMPARE_STORAGE_KEY = 'kbird.taxonCompare.tray';
export const COMPARE_EVENT_NAME = 'kbird-compare-tray-change';
export const MAX_COMPARE_ITEMS = 3;

export function readCompareTray() {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(COMPARE_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item) => item && item._id && item.name)
      .slice(0, MAX_COMPARE_ITEMS);
  } catch {
    return [];
  }
}

export function writeCompareTray(items, { openWorkbench = false } = {}) {
  if (typeof window === 'undefined') return [];
  const normalized = (Array.isArray(items) ? items : [])
    .filter((item) => item && item._id && item.name)
    .slice(0, MAX_COMPARE_ITEMS);
  try {
    window.localStorage.setItem(COMPARE_STORAGE_KEY, JSON.stringify(normalized));
  } catch {
    // ignore storage quota errors
  }
  window.dispatchEvent(
    new CustomEvent(COMPARE_EVENT_NAME, {
      detail: { items: normalized, openWorkbench },
    })
  );
  return normalized;
}

export function toggleCompareItem(bird) {
  if (!bird || !bird._id) return { items: readCompareTray(), added: false };
  const id = String(bird._id);
  const current = readCompareTray();
  const exists = current.some((item) => String(item._id) === id);
  if (exists) {
    const next = writeCompareTray(current.filter((item) => String(item._id) !== id));
    return { items: next, added: false };
  }
  const primaryImage =
    bird.primaryImage ||
    (Array.isArray(bird.images) && bird.images.length > 0
      ? typeof bird.images[0] === 'string'
        ? bird.images[0]
        : bird.images[0]?.url || ''
      : '');
  const entry = {
    _id: id,
    name: String(bird.name || '未知鸟种'),
    scientificName: String(bird.scientificName || ''),
    primaryImage,
  };
  const next = [...current, entry].slice(-MAX_COMPARE_ITEMS);
  return { items: writeCompareTray(next), added: true };
}

export function clearCompareTray() {
  return writeCompareTray([]);
}

/**
 * 从鸟种的 similarSpecies 字段中提取候选相似鸟种中文名
 */
export function extractSimilarBirdNames(similarSpeciesText = '', currentBirdName = '') {
  const text = String(similarSpeciesText || '').trim();
  if (!text) return [];
  // 去掉括号内拉丁名说明，按常见标点与连词切分
  const cleaned = text.replace(/\([^)]*\)|（[^）]*）/g, ' ');
  const rawTokens = cleaned
    .split(/[、，,。；;：:\s/／|]|与|和|及|跟|相似|类似|区别于|易混|近似/)
    .map((s) =>
      s
        .replace(/^(如|例如|主要为|包括|常见有|尤其是|特别是)/, '')
        .replace(/(等|相似|极似|近似|易混淆|较难区分).*$/, '')
        .trim()
    )
    .filter((s) => /^[\u4e00-\u9fa5]{2,9}$/.test(s) && s !== currentBirdName);

  return [...new Set(rawTokens)].slice(0, 4);
}

export function useCompareTray() {
  const [items, setItems] = useState(() => readCompareTray());
  const [workbenchOpen, setWorkbenchOpen] = useState(false);

  useEffect(() => {
    setItems(readCompareTray());
    const handler = (event) => {
      const next = event?.detail?.items ?? readCompareTray();
      setItems(next);
      if (event?.detail?.openWorkbench) {
        setWorkbenchOpen(true);
      }
    };
    window.addEventListener(COMPARE_EVENT_NAME, handler);
    return () => window.removeEventListener(COMPARE_EVENT_NAME, handler);
  }, []);

  const toggle = useCallback((bird) => toggleCompareItem(bird), []);
  const clear = useCallback(() => {
    clearCompareTray();
    setWorkbenchOpen(false);
  }, []);
  const remove = useCallback((id) => {
    const current = readCompareTray();
    writeCompareTray(current.filter((item) => String(item._id) !== String(id)));
  }, []);

  return {
    items,
    workbenchOpen,
    setWorkbenchOpen,
    toggle,
    remove,
    clear,
    hasItem: useCallback(
      (id) => items.some((item) => String(item._id) === String(id)),
      [items]
    ),
  };
}
