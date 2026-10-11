/**
 * Shared order grouping / display for region lists, plots, explore ledgers.
 */
import { getOrderChineseName, getOrderLatinName } from '../data/taxonomyTranslation';

export function orderDisplayName(orderKey) {
  if (!orderKey || orderKey === '未分类') return '未分类';
  const cn = getOrderChineseName(orderKey);
  return cn || orderKey;
}

/** Canonical key for grouping (prefer Latin order name). */
export function orderGroupKey(orderKey) {
  if (!orderKey || orderKey === '未分类') return '未分类';
  return getOrderLatinName(orderKey) || String(orderKey).trim() || '未分类';
}

export function orderLatinSubtitle(orderKey) {
  if (!orderKey || orderKey === '未分类') return '';
  const latin = getOrderLatinName(orderKey);
  if (latin && latin !== orderKey) return latin;
  if (/^[A-Za-z]/.test(String(orderKey))) return String(orderKey);
  return latin || '';
}
