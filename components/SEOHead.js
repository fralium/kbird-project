import Head from 'next/head';

const SEOHead = ({ 
  title, 
  description, 
  keywords = '', 
  image = '/images/og-default.jpg',
  url = '',
  type = 'website'
}) => {
  const fullTitle = title ? `${title} - KBird` : 'KBird - 本机个人观鸟档案';
  const fullDescription = description || '本机多账号的个人观鸟档案：记清楚、查得回、整得齐。支持观鸟记录、照片整理、清单进度、数据备份与合并恢复。';
  const fullUrl = url ? `https://kbird.com${url}` : 'https://kbird.com';
  const fullImage = image.startsWith('http') ? image : `https://kbird.com${image}`;

  return (
    <Head>
      {/* 基础SEO */}
      <title>{fullTitle}</title>
      <meta name="description" content={fullDescription} />
      <meta name="keywords" content={`鸟类,观鸟,鸟类识别,观鸟记录,观鸟清单,本机档案,鸟种库,地点名录,${keywords}`} />
      <meta name="author" content="KBird" />
      <meta name="robots" content="noindex, nofollow" />
      
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
      <meta name="theme-color" content="#219EBC" />
      
      {/* 结构化数据 */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "WebApplication",
            "name": "KBird",
            "description": fullDescription,
            "applicationCategory": "LifestyleApplication",
            "operatingSystem": "Any"
          })
        }}
      />
      
      {/* 预连接优化 */}
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      
      {/* 图标 */}
      <link rel="icon" href="/logo-wetland.png" type="image/png" />
      <link rel="apple-touch-icon" href="/logo-wetland.png" />
      <link rel="icon" href="/favicon.ico" sizes="any" />
      <link rel="manifest" href="/site.webmanifest" />
    </Head>
  );
};

export default SEOHead;
