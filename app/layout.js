import { cookies } from 'next/headers';
import '../styles/globals.css';
import '../styles/accessibility.css';
import AppProviders from './providers';
import { DEFAULT_UI_STYLE, normalizeUiStyle, UI_STYLE_COOKIE_KEY } from '@/utils/uiStyle';

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

export default async function RootLayout({ children }) {
  const cookieStore = await cookies();
  const theme = normalizeUiStyle(cookieStore.get(UI_STYLE_COOKIE_KEY)?.value || DEFAULT_UI_STYLE);

  return (
    <html
      lang="zh-CN"
      data-theme={theme}
      data-scroll-behavior="smooth"
      suppressHydrationWarning
    >
      <body>
        <a href="#main-content" className="skip-link">跳转到主要内容</a>
        <AppProviders>
          <div id="main-content" tabIndex={-1}>
            {children}
          </div>
        </AppProviders>
      </body>
    </html>
  );
}
