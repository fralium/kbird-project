import { resolveBackendApiBase } from '../../../../utils/backendApiBase';
import {
  parseProxyJsonResponse,
  sendMethodNotAllowed,
  sendProxyError,
} from '../../../../utils/proxyApi';

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return sendMethodNotAllowed(res, ['POST']);
  }

  const baseUrl = resolveBackendApiBase();

  try {
    const forwardHeaders = {};
    if (req.headers.authorization) {
      forwardHeaders.Authorization = req.headers.authorization;
    }
    if (req.headers['content-type']) {
      forwardHeaders['Content-Type'] = req.headers['content-type'];
    }

    const response = await fetch(`${baseUrl}/ai/identify/batch`, {
      method: 'POST',
      headers: forwardHeaders,
      body: req,
      duplex: 'half',
    });
    const data = await parseProxyJsonResponse(response, {
      invalidMessage: 'AI批量识别响应解析失败',
      invalidCode: 'UPSTREAM_INVALID_RESPONSE',
    });
    return res.status(response.status).json(data);
  } catch (error) {
    return sendProxyError(res, error, {
      message: 'AI批量识别请求失败',
      code: 'AI_IDENTIFY_BATCH_PROXY_FAILED',
    });
  }
}
