// Next.js API代理路由 - 鸟类鸣叫上传
import { resolveBackendApiBase } from '../../../../utils/backendApiBase';
import { devLog } from '../../../../utils/devLogger';
import { parseProxyJsonResponse, sendMethodNotAllowed, sendProxyError } from '../../../../utils/proxyApi';

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req, res) {
  const { method, query, headers } = req;

  if (method !== 'POST') {
    return sendMethodNotAllowed(res, ['POST']);
  }

  const baseUrl = resolveBackendApiBase();
  const url = `${baseUrl}/birds/${query.id}/calls`;

  try {
    devLog('鸣叫上传代理请求:', {
      url,
      method,
      hasAuth: !!headers.authorization,
      contentType: headers['content-type'],
    });

    const forwardHeaders = {
      Authorization: headers.authorization || '',
    };
    if (headers['content-type']) {
      forwardHeaders['Content-Type'] = headers['content-type'];
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: forwardHeaders,
      body: req,
      duplex: 'half',
    });

    const data = await parseProxyJsonResponse(response);
    res.status(response.status).json(data);
  } catch (error) {
    return sendProxyError(res, error, {
      message: '服务器错误',
      code: 'CALL_UPLOAD_PROXY_FAILED',
    });
  }
}
