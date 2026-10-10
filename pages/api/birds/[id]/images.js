// Next.js API代理路由 - 鸟类图片上传
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
  
  // 构建后端API URL
  const baseUrl = resolveBackendApiBase();
  const url = `${baseUrl}/birds/${query.id}/images`;
  
  try {
    devLog('图片上传代理请求:', {
      url,
      method,
      hasAuth: !!headers.authorization,
      contentType: headers['content-type']
    });

    // 直接转发请求到后端
    const forwardHeaders = {
      Authorization: headers.authorization || '',
    };
    if (headers['content-type']) {
      forwardHeaders['Content-Type'] = headers['content-type'];
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: forwardHeaders,
      // bodyParser=false 时，req 是可读流；用原始流转发 multipart body
      body: req,
      duplex: 'half',
    });

    devLog('后端响应状态:', response.status);
    
    const data = await parseProxyJsonResponse(response);
    
    res.status(response.status).json(data);
  } catch (error) {
    return sendProxyError(res, error, {
      message: '服务器错误',
      code: 'UPLOAD_PROXY_FAILED',
    });
  }
}