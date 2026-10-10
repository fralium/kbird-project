// Next.js API代理路由 - 用户头像上传
import { resolveBackendApiBase } from '../../../utils/backendApiBase';
import { parseProxyJsonResponse, sendMethodNotAllowed, sendProxyError } from '../../../utils/proxyApi';

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
  const url = `${baseUrl}/users/avatar`;

  try {
    const headers = {};
    if (req.headers.authorization) {
      headers.Authorization = req.headers.authorization;
    }
    // 必须转发 multipart boundary，否则后端无法解析上传
    if (req.headers['content-type']) {
      headers['Content-Type'] = req.headers['content-type'];
    }

    const chunks = [];
    for await (const chunk of req) {
      chunks.push(chunk);
    }
    const body = Buffer.concat(chunks);

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body,
    });

    const data = await parseProxyJsonResponse(response);
    res.status(response.status).json(data);
  } catch (error) {
    return sendProxyError(res, error, {
      message: '服务器错误',
      code: 'AVATAR_PROXY_FAILED',
    });
  }
}
