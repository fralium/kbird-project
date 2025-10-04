export default async function handler(req, res) {
  const { id, birdId } = req.query;

  if (!id || !birdId) {
    return res.status(400).json({
      success: false,
      message: '缺少必要参数'
    });
  }

  try {
    const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002';
    const url = `${backendUrl}/api/records/${id}/bird/${birdId}`;

    console.log('代理请求到后端:', url);

    const response = await fetch(url, {
      method: req.method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': req.headers.authorization || '',
      },
      body: req.method === 'DELETE' ? JSON.stringify({}) : undefined,
    });

    console.log('后端响应状态:', response.status);
    console.log('后端响应头:', response.headers.get('content-type'));

    // 检查响应是否为JSON
    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      const text = await response.text();
      console.log('后端响应文本:', text);
      return res.status(response.status).json({
        success: false,
        message: '服务器返回了非JSON响应',
        error: text,
      });
    }

    const data = await response.json();
    console.log('后端响应数据:', data);

    res.status(response.status).json(data);
  } catch (error) {
    console.error('API代理错误:', error);
    res.status(500).json({
      success: false,
      message: '服务器内部错误',
      error: error.message,
    });
  }
}
