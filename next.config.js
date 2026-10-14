/** @type {import('next').NextConfig} */
const nextApiCorsOrigin =
  process.env.NEXT_PUBLIC_NEXT_API_CORS_ORIGIN ||
  process.env.SITE_URL ||
  'http://localhost:13080';

const nextConfig = {
  reactStrictMode: true,
  // Workaround for Next 16 pages-router HMR invalid isrManifest noise.
  devIndicators: false,
  images: {
    remotePatterns: [
      { protocol: 'http', hostname: 'localhost' },
      { protocol: 'http', hostname: '127.0.0.1' },
      { protocol: 'http', hostname: '47.121.183.57' },
      { protocol: 'http', hostname: '172.31.55.167' },
      { protocol: 'https', hostname: '47.121.183.57' },
      { protocol: 'https', hostname: '172.31.55.167' },
    ],
  },
  compress: true,
  poweredByHeader: false,
  generateEtags: false,
  
  experimental: {
    optimizeCss: false,
  },
  
  webpack: (config, { isServer, dev }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
      };
    }
    return config;
  },
  
  async redirects() {
    return [
      {
        source: '/personal/plots',
        destination: '/records/plots',
        permanent: false,
      },
      {
        source: '/personal/plots/:path*',
        destination: '/records/plots/:path*',
        permanent: false,
      },
      {
        source: '/ai/identify',
        destination: '/ai?mode=identify',
        permanent: false,
      },
    ];
  },

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
  
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN',
          },
          {
            // 收紧 XSS 面：JWT 在 localStorage 时降低脚本注入危害
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://api.map.baidu.com https://api.tianditu.gov.cn",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: blob: http: https:",
              "font-src 'self' data:",
              "connect-src 'self' http://127.0.0.1:* http://localhost:* ws://127.0.0.1:* ws://localhost:* https://api.map.baidu.com https://*.baidu.com https://api.tianditu.gov.cn https://*.tianditu.gov.cn https://*.basemaps.cartocdn.com",
              "media-src 'self' blob: data:",
              "frame-ancestors 'self'",
              "base-uri 'self'",
              "form-action 'self'",
            ].join('; '),
          },
        ],
      },
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
    ];
  },
};

module.exports = nextConfig;