/** @type {import('next').NextConfig} */
const nextApiCorsOrigin =
  process.env.NEXT_PUBLIC_NEXT_API_CORS_ORIGIN ||
  process.env.SITE_URL ||
  'http://localhost:13080';

const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      { protocol: 'http', hostname: 'localhost' },
      { protocol: 'http', hostname: '127.0.0.1' },
      { protocol: 'http', hostname: '47.121.183.57' },
      { protocol: 'https', hostname: '47.121.183.57' },
    ],
  },
  // 生产环境优化
  compress: true,
  poweredByHeader: false,
  generateEtags: false,
  
  // 静态文件优化
  trailingSlash: false,
  
  // 构建优化
  experimental: {
    optimizeCss: true,
  },
  
  // 重写规则
  async rewrites() {
    return [
      {
        source: '/uploads/:path*',
        destination: '/api/uploads/:path*',
      },
      {
        source: '/images/birds/:path*',
        destination: '/api/images/birds/:path*',
      },
      {
        source: '/images/avatars/:path*',
        destination: '/api/images/avatars/:path*',
      },
    ];
  },
  
  // 安全头
  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [
          {
            key: 'Access-Control-Allow-Origin',
            value: nextApiCorsOrigin,
          },
          {
            key: 'Access-Control-Allow-Methods',
            value: 'GET, POST, PUT, DELETE, OPTIONS',
          },
          {
            key: 'Access-Control-Allow-Headers',
            value: 'Content-Type, Authorization',
          },
        ],
      },
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://api.map.baidu.com https://api.tianditu.gov.cn",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: blob: http: https:",
              "font-src 'self' data:",
              "connect-src 'self' http://127.0.0.1:* http://localhost:* ws://127.0.0.1:* ws://localhost:* https://api.map.baidu.com https://*.baidu.com https://api.tianditu.gov.cn https://*.tianditu.gov.cn https://*.basemaps.cartocdn.com",
              "media-src 'self' blob: data:",
              "frame-ancestors 'none'",
              "base-uri 'self'",
              "form-action 'self'",
            ].join('; '),
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
