import { resolveBackendApiBase } from '../../../../../utils/backendApiBase';
import { devLog } from '../../../../../utils/devLogger';
import {
  buildJsonHeaders,
  parseProxyJsonResponse,
  sendMethodNotAllowed,
  sendProxyError,
} from '../../../../../utils/proxyApi';

export default async function handler(req, res) {
  const { id, birdId } = req.query;
  if (req.method !== 'DELETE') {
    return sendMethodNotAllowed(res, ['DELETE']);
  }

  if (!id || !birdId) {
    return res.status(400).json({
      success: false,
      message: '缺少必要参数',
      code: 'MISSING_REQUIRED_PARAMS',
    });
  }

  try {
    const backendUrl = resolveBackendApiBase();
    const url = `${backendUrl}/records/${id}/bird/${birdId}`;

    devLog('代理请求到后端:', url);

    const response = await fetch(url, {
      method: req.method,
      headers: buildJsonHeaders(req),
      body: req.method === 'DELETE' ? JSON.stringify({}) : undefined,
    });

    devLog('后端响应状态:', response.status);
    devLog('后端响应头:', response.headers.get('content-type'));

    const data = await parseProxyJsonResponse(response, {
      invalidMessage: '服务器返回了非JSON响应',
      invalidCode: 'UPSTREAM_INVALID_RESPONSE',
    });
    devLog('后端响应数据:', data);

    res.status(response.status).json(data);
  } catch (error) {
    return sendProxyError(res, error, {
      message: '服务器内部错误',
      code: 'RECORD_BIRD_PROXY_FAILED',
    });
  }
}










