/** 界面风格（色板皮肤），与 light/dark 的 theme 字段分开 */

export const UI_STYLE_STORAGE_KEY = 'kbird-ui-style';

export const UI_STYLES = [
  {
    id: 'wetland',
    label: '湿地晨曦',
    hint: '湖蓝 + 芦苇金，默认气质',
  },
  {
    id: 'forest',
    label: '深林静影',
    hint: '沉稳林绿主色，偏野外安静',
  },
  {
    id: 'ink',
    label: '墨色台账',
    hint: '近墨底色、克制强调，偏工具精致',
  },
];

export const DEFAULT_UI_STYLE = 'wetland';

export function isValidUiStyle(value) {
  return UI_STYLES.some((item) => item.id === value);
}

export function readStoredUiStyle() {
  if (typeof window === 'undefined') return DEFAULT_UI_STYLE;
  try {
    const raw = localStorage.getItem(UI_STYLE_STORAGE_KEY);
    return isValidUiStyle(raw) ? raw : DEFAULT_UI_STYLE;
  } catch {
    return DEFAULT_UI_STYLE;
  }
}

export function applyUiStyle(styleId) {
  if (typeof document === 'undefined') return DEFAULT_UI_STYLE;
  const next = isValidUiStyle(styleId) ? styleId : DEFAULT_UI_STYLE;
  document.documentElement.setAttribute('data-theme', next);
  try {
    localStorage.setItem(UI_STYLE_STORAGE_KEY, next);
  } catch {
    /* ignore */
  }
  return next;
}
