import { resolveBackendApiBase } from '../../../../utils/backendApiBase';
import {
  buildJsonHeaders,
  parseProxyJsonResponse,
  sendMethodNotAllowed,
  sendProxyError,
} from '../../../../utils/proxyApi';

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '20mb',
    },
  },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return sendMethodNotAllowed(res, ['POST']);
  }

  const plotId = req.body?.plotId || req.query?.id;
  if (!plotId) {
    return res.status(400).json({ success: false, message: '缺少自留地 ID' });
  }

  const baseUrl = resolveBackendApiBase();
  const url = `${baseUrl}/personal/plots/${encodeURIComponent(plotId)}/import/cbrc`;

  // 转发时去掉 plotId，避免污染后端 body
  const { plotId: _omit, ...rest } = req.body || {};

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: buildJsonHeaders(req),
      body: JSON.stringify(rest),
    });

    const data = await parseProxyJsonResponse(response, {
      invalidMessage: '自留地 CBRC 导入接口响应解析失败',
      invalidCode: 'UPSTREAM_INVALID_RESPONSE',
    });

    return res.status(response.status).json(data);
  } catch (error) {
    return sendProxyError(res, error, {
      message: '自留地服务暂不可用',
      code: 'PERSONAL_PLOTS_PROXY_FAILED',
    });
  }
}
