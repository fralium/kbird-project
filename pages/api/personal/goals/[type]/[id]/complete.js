import { resolveBackendApiBase } from '@/utils/backendApiBase';
import {
  buildJsonHeaders,
  parseProxyJsonResponse,
  sendMethodNotAllowed,
  sendProxyError,
} from '@/utils/proxyApi';

export default async function handler(req, res) {
  const { method, query } = req;
  if (method !== 'POST') {
    return sendMethodNotAllowed(res, ['POST']);
  }

  const { type, id } = query;
  if (!type || !id) {
    return res.status(400).json({
      success: false,
      message: '缺少目标类型或目标ID',
      code: 'MISSING_GOAL_PATH_PARAMS',
    });
  }

  const baseUrl = resolveBackendApiBase();
  const url = `${baseUrl}/personal/goals/${encodeURIComponent(String(type))}/${encodeURIComponent(String(id))}/complete`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: buildJsonHeaders(req),
    });

    const data = await parseProxyJsonResponse(response, {
      invalidMessage: '目标完成接口响应解析失败',
      invalidCode: 'UPSTREAM_INVALID_RESPONSE',
    });

    return res.status(response.status).json(data);
  } catch (error) {
    return sendProxyError(res, error, {
      message: '目标完成服务暂不可用',
      code: 'PERSONAL_GOAL_COMPLETE_PROXY_FAILED',
    });
  }
}
