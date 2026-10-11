/** 界面风格（色板皮肤），与 light/dark 的 theme 字段分开 */

export const UI_STYLE_STORAGE_KEY = 'kbird-ui-style';
/** Cookie mirrors localStorage so App Router can paint the correct theme without an inline <script>. */
export const UI_STYLE_COOKIE_KEY = 'kbird-ui-style';
const UI_STYLE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export const UI_STYLES = [
  {
    id: 'wetland',
    label: '普蓝湿地',
    hint: '普鲁士蓝为主轴，冷青纸感，芦苇金仅作点缀',
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

export function normalizeUiStyle(value) {
  return isValidUiStyle(value) ? value : DEFAULT_UI_STYLE;
}

export function readStoredUiStyle() {
  if (typeof window === 'undefined') return DEFAULT_UI_STYLE;
  try {
    const raw = localStorage.getItem(UI_STYLE_STORAGE_KEY);
    return normalizeUiStyle(raw);
  } catch {
    return DEFAULT_UI_STYLE;
  }
}

function writeUiStyleCookie(styleId) {
  if (typeof document === 'undefined') return;
  try {
    document.cookie = `${UI_STYLE_COOKIE_KEY}=${encodeURIComponent(styleId)}; path=/; max-age=${UI_STYLE_COOKIE_MAX_AGE}; SameSite=Lax`;
  } catch {
    /* ignore */
  }
}

export function applyUiStyle(styleId) {
  if (typeof document === 'undefined') return DEFAULT_UI_STYLE;
  const next = normalizeUiStyle(styleId);
  document.documentElement.setAttribute('data-theme', next);
  try {
    localStorage.setItem(UI_STYLE_STORAGE_KEY, next);
  } catch {
    /* ignore */
  }
  writeUiStyleCookie(next);
  return next;
}
