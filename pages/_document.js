import { Html, Head, Main, NextScript } from 'next/document';

export default function Document() {
  return (
    <Html lang="zh-CN" data-scroll-behavior="smooth">
      <Head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#003153" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="KBird" />
        <link rel="icon" href="/logo-wetland.png" type="image/png" />
        <link rel="apple-touch-icon" href="/logo-wetland.png" />
      </Head>
      <body>
        <Main />
        <NextScript />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', () => {
                  const isProduction = ${JSON.stringify(process.env.NODE_ENV === 'production')};
                  if (isProduction) {
                    navigator.serviceWorker.register('/sw.js').catch((registrationError) => {
                      console.error('SW registration failed:', registrationError);
                    });
                    return;
                  }

                  // 开发环境默认清理 SW，避免缓存影响调试
                  navigator.serviceWorker.getRegistrations().then((registrations) => {
                    registrations.forEach((registration) => {
                      registration.unregister();
                    });
                  });
                });
              }
            `,
          }}
        />
      </body>
    </Html>
  );
}
