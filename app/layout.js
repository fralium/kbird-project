import '../styles/globals.css';
import '../styles/accessibility.css';
import AppProviders from './providers';

export const metadata = {
  title: 'KBird',
  description: 'KBird - 单机鸟友观鸟笔记本：记清楚、查得回、整得齐',
  icons: {
    icon: [
      { url: '/logo-wetland.png', type: 'image/png' },
      { url: '/favicon.ico', sizes: 'any' },
    ],
    apple: '/logo-wetland.png',
  },
};

const uiStyleBootScript = `
(function () {
  try {
    var key = 'kbird-ui-style';
    var allowed = { wetland: 1, forest: 1, ink: 1 };
    var v = localStorage.getItem(key);
    document.documentElement.setAttribute('data-theme', allowed[v] ? v : 'wetland');
  } catch (e) {
    document.documentElement.setAttribute('data-theme', 'wetland');
  }
})();
`;

export default function RootLayout({ children }) {
  return (
    <html
      lang="zh-CN"
      data-theme="wetland"
      data-scroll-behavior="smooth"
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: uiStyleBootScript }} />
      </head>
      <body>
        <a href="#main-content" className="skip-link">跳转到主要内容</a>
        <AppProviders>
          <div id="main-content">{children}</div>
        </AppProviders>
      </body>
    </html>
  );
}
