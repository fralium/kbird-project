/**
 * 下载个人导出文件（CBRC XLSX / eBird CSV）
 * @param {'cbrc'|'ebird'} format
 * @param {{ recordIds?: string[], year?: number|string }} options
 */
export async function downloadPersonalRecordsExport(format, options = {}) {
  if (format !== 'cbrc' && format !== 'ebird') {
    throw new Error('不支持的导出格式');
  }

  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  if (!token) {
    throw new Error('请先登录');
  }

  const recordIds = Array.isArray(options.recordIds)
    ? options.recordIds.map(String).filter(Boolean)
    : [];
  const year = options.year != null && options.year !== '' ? Number(options.year) : null;

  const usePost = recordIds.length > 0;
  const params = new URLSearchParams();
  if (!usePost && year) params.set('year', String(year));

  const endpoint = `/api/personal/export/${format}${params.toString() ? `?${params}` : ''}`;
  const response = await fetch(endpoint, {
    method: usePost ? 'POST' : 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      ...(usePost ? { 'Content-Type': 'application/json' } : {}),
    },
    body: usePost
      ? JSON.stringify({
          recordIds,
          ...(year ? { year } : {}),
        })
      : undefined,
  });

  if (!response.ok) {
    let message = `导出失败（${response.status}）`;
    try {
      const data = await response.json();
      if (data?.message) message = data.message;
    } catch {
      // ignore
    }
    const error = new Error(message);
    error.status = response.status;
    throw error;
  }

  const blob = await response.blob();
  const disposition = response.headers.get('Content-Disposition') || '';
  const matched = disposition.match(/filename="?([^";]+)"?/i);
  const fallback =
    format === 'cbrc'
      ? `kbird-cbrc-${new Date().toISOString().slice(0, 10)}.xlsx`
      : `kbird-ebird-${new Date().toISOString().slice(0, 10)}.csv`;
  const filename = matched?.[1] || fallback;

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);

  const countHeader = response.headers.get('X-Export-Count');
  return {
    filename,
    count: countHeader ? Number(countHeader) : null,
  };
}
