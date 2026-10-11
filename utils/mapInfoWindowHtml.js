import { formatDisplayDate } from '@/utils/localDate';

/**
 * 地图气泡 HTML：湿地笔记风格，避免 emoji 与默认方框观感。
 * 注意：注入地图 DOM，不能依赖站点 CSS 变量，须写实色/实号。
 */
const INK = '#003153';
const LAKE = '#247896';
const MUTED = '#5a6b75';

export function buildMapInfoWindowHtml(location = {}) {
  const name = escapeHtml(location.name || location.location?.name || '未知地点');
  const records = Number(location.records || location.recordCount || 0);
  const birds = Number(location.birds || location.birdCount || 0);
  const dateText = location.date ? formatDisplayDate(location.date, 'long') : '';
  const province = escapeHtml(location.province || '');

  const rows = [];
  if (birds > 0) rows.push(metaRow('鸟种', `${birds} 种`));
  if (records > 0) rows.push(metaRow('记录', `${records} 次`));
  if (province) rows.push(metaRow('省份', province));
  if (dateText) rows.push(metaRow('日期', escapeHtml(dateText)));

  return `
<div style="
  min-width:168px;max-width:220px;margin:-8px -4px 0;
  font-family:'Noto Sans SC','PingFang SC','Microsoft YaHei',sans-serif;
  color:${INK};
">
  <div style="
    border-left:3px solid ${LAKE};padding:10px 12px 10px 11px;
    border-radius:0 10px 10px 0;
    background:linear-gradient(180deg,#f3f6f8 0%,#ffffff 70%);
  ">
    <div style="font-size:0.75rem;font-weight:700;color:${LAKE};letter-spacing:0.02em;">足迹点位</div>
    <div style="margin-top:4px;font-size:1rem;font-weight:700;line-height:1.35;">${name}</div>
    ${
      rows.length
        ? `<div style="margin-top:8px;display:flex;flex-direction:column;gap:4px;">${rows.join('')}</div>`
        : ''
    }
  </div>
</div>`.trim();
}

function metaRow(label, value) {
  return `<div style="display:flex;justify-content:space-between;gap:12px;font-size:0.75rem;line-height:1.35;">
    <span style="color:${MUTED};font-weight:600;">${label}</span>
    <span style="color:${INK};font-weight:650;text-align:right;">${value}</span>
  </div>`;
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
