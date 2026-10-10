import { resolveBackendApiBase } from '../../../../../../utils/backendApiBase';
import {
  buildJsonHeaders,
  parseProxyJsonResponse,
  sendMethodNotAllowed,
  sendProxyError,
} from '../../../../../../utils/proxyApi';

export const config = {
  api: {
    bodyParser: true,
    responseLimit: false,
    externalResolver: true,
  },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return sendMethodNotAllowed(res, ['POST']);
  }

  const id = Array.isArray(req.query?.id) ? req.query.id[0] : req.query?.id;
  if (!id) {
    return res.status(400).json({ success: false, message: '缺少对话 ID' });
  }

  const baseUrl = resolveBackendApiBase();
  const url = `${baseUrl}/ai/conversations/${encodeURIComponent(id)}/messages/stream`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        ...buildJsonHeaders(req),
        Accept: 'text/event-stream',
        'x-no-compression': '1',
      },
      body: JSON.stringify(req.body || {}),
    });

    const contentType = String(response.headers.get('content-type') || '');
    if (!contentType.includes('text/event-stream')) {
      const data = await parseProxyJsonResponse(response, {
        invalidMessage: 'AI流式对话接口响应解析失败',
        invalidCode: 'UPSTREAM_INVALID_RESPONSE',
      });
      return res.status(response.status).json(data);
    }

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
  } catch (error) {
    if (res.headersSent) {
      try {
        res.write(
          `event: error\ndata: ${JSON.stringify({
            message: '流式代理中断',
            code: 'AI_CONVERSATION_STREAM_PROXY_FAILED',
          })}\n\n`
        );
        res.end();
      } catch {
        /* ignore */
      }
      return;
    }
    return sendProxyError(res, error, {
      message: '发送消息失败',
      code: 'AI_CONVERSATION_STREAM_PROXY_FAILED',
    });
  }
}
