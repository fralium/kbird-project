/**
 * 地图气泡 HTML：湿地笔记风格，避免 emoji 与默认方框观感。
 */
export function buildMapInfoWindowHtml(location = {}) {
  const name = escapeHtml(location.name || location.location?.name || '未知地点');
  const records = Number(location.records || location.recordCount || 0);
  const birds = Number(location.birds || location.birdCount || 0);
  const dateText = location.date
    ? new Date(location.date).toLocaleDateString('zh-CN', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : '';
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
  color:#023047;
">
  <div style="
    border-left:3px solid #219EBC;padding:10px 12px 10px 11px;
    border-radius:0 10px 10px 0;
    background:linear-gradient(180deg,#f7fbfd 0%,#ffffff 70%);
  ">
    <div style="font-size:11px;font-weight:700;color:#219EBC;letter-spacing:0.02em;">足迹点位</div>
    <div style="margin-top:4px;font-size:15px;font-weight:700;line-height:1.35;">${name}</div>
    ${
      rows.length
        ? `<div style="margin-top:8px;display:flex;flex-direction:column;gap:4px;">${rows.join('')}</div>`
        : ''
    }
  </div>
</div>`.trim();
}

function metaRow(label, value) {
  return `<div style="display:flex;justify-content:space-between;gap:12px;font-size:12px;line-height:1.35;">
    <span style="color:#6b7a88;font-weight:600;">${label}</span>
    <span style="color:#023047;font-weight:650;text-align:right;">${value}</span>
  </div>`;
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
