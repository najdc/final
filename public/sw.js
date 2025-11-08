// Service Worker - Najd Project
// إلغاء تسجيل Service Worker القديم

self.addEventListener('install', (event) => {
  console.log('Service Worker: Installing...');
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  console.log('Service Worker: Activating...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          return caches.delete(cacheName);
        })
      );
    })
  );
  self.clients.claim();
});

// إلغاء تسجيل نفسه
self.addEventListener('fetch', (event) => {
  // لا نفعل شيء - نترك الطلبات تمر بشكل طبيعي
  event.respondWith(fetch(event.request));
});


