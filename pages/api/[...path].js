import { resolveBackendApiBase } from '@/utils/backendApiBase';
import { parseProxyJsonResponse, sendProxyError } from '@/utils/proxyApi';
import { isLocalLoopbackClient, rejectUnlessLocalLoopback } from '@/utils/requestLoopback';

export const config = {
  api: {
    bodyParser: false,
    responseLimit: false,
    externalResolver: true,
  },
};

const LOOPBACK_ONLY_PATHS = new Map([
  ['/init', '初始化仅允许本机访问'],
  ['/personal/setup-env', '服务与密钥配置仅允许本机访问'],
  ['/users/local-session', '本机自动登录仅允许本机访问'],
]);

export default async function handler(req, res) {
  const segments = Array.isArray(req.query?.path)
    ? req.query.path
    : [req.query?.path].filter(Boolean);
  const backendPath = `/${segments.map((s) => encodeURIComponent(String(s))).join('/')}`;

  const loopbackMessage = LOOPBACK_ONLY_PATHS.get(backendPath);
  if (loopbackMessage && !isLocalLoopbackClient(req)) {
    return rejectUnlessLocalLoopback(res, loopbackMessage);
  }

  const rawUrl = String(req.url || '');
  const qIndex = rawUrl.indexOf('?');
  const search = qIndex >= 0 ? rawUrl.slice(qIndex) : '';
  const targetUrl = `${resolveBackendApiBase()}${backendPath}${search}`;

  const method = String(req.method || 'GET').toUpperCase();
  const forwardHeaders = {};
  const passthroughHeaders = [
    'authorization',
    'content-type',
    'accept',
    'x-setup-token',
    'x-no-compression',
  ];
  passthroughHeaders.forEach((key) => {
    if (req.headers?.[key]) {
      forwardHeaders[key] = req.headers[key];
    }
  });

  if (backendPath.endsWith('/messages/stream')) {
    forwardHeaders.accept = 'text/event-stream';
    forwardHeaders['x-no-compression'] = '1';
  }

  const init = {
    method,
    headers: forwardHeaders,
  };

  if (method !== 'GET' && method !== 'HEAD') {
    init.body = req;
    init.duplex = 'half';
  }

  try {
    const response = await fetch(targetUrl, init);
    const contentType = String(response.headers.get('content-type') || '');
    const disposition = response.headers.get('content-disposition');

    // 1. SSE Event Stream
    if (contentType.includes('text/event-stream')) {
      res.writeHead(response.status, {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no',
      });

      if (!response.body || typeof response.body.getReader !== 'function') {
        const text = await response.text();
        res.write(text);
        return res.end();
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      req.on('close', () => {
        try {
          reader.cancel();
        } catch {
          /* ignore */
        }
      });

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        res.write(decoder.decode(value, { stream: true }));
      }
      return res.end();
    }

    // 2. Binary / File Attachment Download
    if (disposition || (!contentType.includes('application/json') && response.ok && method === 'GET')) {
      const buf = Buffer.from(await response.arrayBuffer());
      res.status(response.status);
      if (contentType) res.setHeader('Content-Type', contentType);
      if (disposition) res.setHeader('Content-Disposition', disposition);
      return res.send(buf);
    }

    // 3. Standard JSON response
    const data = await parseProxyJsonResponse(response);
    return res.status(response.status).json(data);
  } catch (error) {
    if (res.headersSent) {
      try {
        res.end();
      } catch {
        /* ignore */
      }
      return;
    }
    return sendProxyError(res, error);
  }
}
