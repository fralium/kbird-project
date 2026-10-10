// Service Worker for PWA offline support
// 注意：当前在开发环境已禁用，如需启用请取消注释

// 完全禁用 Service Worker - 不拦截任何请求
// 这样可以避免开发环境中的错误
self.addEventListener('fetch', (event) => {
  // 不拦截任何请求，让浏览器正常处理
  return;
});

// 安装Service Worker - 静默处理
self.addEventListener('install', (event) => {
  // 立即激活，跳过等待
  self.skipWaiting();
  // 不进行任何缓存操作
  event.waitUntil(Promise.resolve());
});

// 更新Service Worker - 静默处理
self.addEventListener('activate', (event) => {
  // 立即控制所有客户端
  event.waitUntil(
    self.clients.claim().then(() => {
      // 可选：清理旧缓存
      return caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            return caches.delete(cacheName);
          })
        );
      }).catch(() => {
        // 静默处理错误
        return Promise.resolve();
      });
    }).catch(() => {
      // 静默处理错误
      return Promise.resolve();
    })
  );
});

/* 生产环境启用 Service Worker 的代码（暂时禁用）
const CACHE_NAME = 'kbird-v1';
const urlsToCache = [
  '/',
  '/logo.png',
  '/manifest.json',
];

// 安装Service Worker
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Opened cache');
        return cache.addAll(urlsToCache).catch((error) => {
          console.warn('缓存初始化失败:', error);
          return Promise.resolve();
        });
      })
      .catch((error) => {
        console.warn('Service Worker 安装失败:', error);
        return Promise.resolve();
      })
  );
});

// 拦截请求
self.addEventListener('fetch', (event) => {
  const { request } = event;
  
  try {
    const url = new URL(request.url);
    
    // 跳过不应该缓存的请求
    const isCrossOrigin = url.origin !== self.location.origin;
    const isAPIRequest = url.pathname.startsWith('/api/') || 
                         (url.hostname === 'localhost' && url.port !== self.location.port) ||
                         url.hostname.includes('api');
    
    if (
      request.method !== 'GET' ||
      url.protocol === 'ws:' ||
      url.protocol === 'wss:' ||
      url.pathname.startsWith('/_next/webpack-hmr') ||
      url.pathname.startsWith('/_next/static') ||
      url.pathname.startsWith('/api/') ||
      url.pathname.includes('__webpack') ||
      isCrossOrigin ||
      isAPIRequest
    ) {
      return; // 不拦截
    }
    
    // 只处理同源的 GET 请求
    event.respondWith(
      caches.match(request)
        .then((response) => {
          if (response) {
            return response;
          }
          return fetch(request)
            .then((response) => {
              if (!response || response.status !== 200 || response.type !== 'basic') {
                return response;
              }
              const responseToCache = response.clone();
              caches.open(CACHE_NAME)
                .then((cache) => {
                  cache.put(request, responseToCache);
                })
                .catch(() => {});
              return response;
            })
            .catch((error) => {
              return caches.match(request).then(cachedResponse => {
                return cachedResponse || new Response('网络错误', { status: 503 });
              }).catch(() => {
                return new Response('网络错误', { status: 503 });
              });
            });
        })
        .catch(() => {
          return fetch(request).catch(() => {
            return new Response('网络错误', { status: 503 });
          });
        })
    );
  } catch (error) {
    return; // 不拦截请求
  }
});

// 更新Service Worker
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});
*/
