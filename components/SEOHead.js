import Head from 'next/head';

const SEOHead = ({ 
  title, 
  description, 
  keywords = '', 
  image = '/images/og-default.jpg',
  url = '',
  type = 'website'
}) => {
  const fullTitle = title ? `${title} - KBird` : 'KBird - 鸟类收集整理网站';
  const fullDescription = description || '记录、分享、探索鸟类的奇妙世界。专业的鸟类信息平台，支持照片上传、观察记录、地点管理等功能。';
  const fullUrl = url ? `https://kbird.com${url}` : 'https://kbird.com';
  const fullImage = image.startsWith('http') ? image : `https://kbird.com${image}`;

  return (
    <Head>
      {/* 基础SEO */}
      <title>{fullTitle}</title>
      <meta name="description" content={fullDescription} />
      <meta name="keywords" content={`鸟类,观鸟,鸟类识别,鸟类记录,鸟类照片,鸟类观察,鸟类保护,鸟类研究,${keywords}`} />
      <meta name="author" content="KBird Team" />
      <meta name="robots" content="index, follow" />
      
      {/* Open Graph */}
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={fullDescription} />
      <meta property="og:image" content={fullImage} />
      <meta property="og:url" content={fullUrl} />
      <meta property="og:type" content={type} />
      <meta property="og:site_name" content="KBird" />
      
      {/* Twitter Card */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={fullDescription} />
      <meta name="twitter:image" content={fullImage} />
      
      {/* 移动端优化 */}
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <meta name="theme-color" content="#2d5016" />
      
      {/* 结构化数据 */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "WebSite",
            "name": "KBird",
            "description": fullDescription,
            "url": "https://kbird.com",
            "potentialAction": {
              "@type": "SearchAction",
              "target": "https://kbird.com/search?q={search_term_string}",
              "query-input": "required name=search_term_string"
            }
          })
        }}
      />
      
      {/* 预连接优化 */}
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link rel="dns-prefetch" href="//api.kbird.com" />
      
      {/* 图标 */}
      <link rel="icon" href="/favicon.ico" />
      <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
      <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png" />
      <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png" />
      <link rel="manifest" href="/site.webmanifest" />
    </Head>
  );
};

export default SEOHead;
