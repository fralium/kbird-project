// Next.js API代理路由 - 获取待审核的新鸟类申请
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, message: '方法不允许' });
  }

  const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002';
  const url = `${baseUrl}/api/admin/pending-birds`;

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': req.headers.authorization || '',
      },
    });

    const data = await response.json();
    res.status(response.status).json(data);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '服务器错误',
      error: error.message,
    });
  }
}
