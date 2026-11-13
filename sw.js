const CACHE_NAME = 'modymc-shell-v2';
const SHELL_FILES = ['./', './index.html', './manifest.json', './icon-192.png', './icon-512.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      // cache:'reload' يتجاوز كاش المتصفح عشان نخزّن آخر نسخة فعلية من الموقع
      Promise.all(SHELL_FILES.map((f) => cache.add(new Request(f, { cache: 'reload' })).catch(() => {})))
    )
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Network-first: دائمًا نجيب آخر نسخة من السيرفر، ولا نرجع للكاش إلا عند انقطاع الاتصال.
// صفحات الموقع (navigate) نجيبها بدون كاش المتصفح، ونحدّث نسخة الكاش عند كل نجاح.
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req, { cache: 'reload' })
        .then((res) => {
          if (res && res.ok) {
            const copy = res.clone();
            caches.open(CACHE_NAME).then((c) => c.put('./index.html', copy)).catch(() => {});
          }
          return res;
        })
        .catch(() => caches.match(req).then((res) => res || caches.match('./index.html')))
    );
    return;
  }

  event.respondWith(
    fetch(req).catch(() => caches.match(req).then((res) => res || Response.error()))
  );
});

// ============ إشعارات المودات الجديدة ============
self.addEventListener('push', (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch(e){ data = { title: 'ModyMC', body: event.data ? event.data.text() : '' }; }
  const title = data.title || 'ModyMC';
  const options = {
    body: data.body || '',
    icon: './icon-192.png',
    badge: './icon-192.png',
    data: { url: data.url || './' }
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || './';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientsArr) => {
      const hadWindow = clientsArr.find((c) => c.url.includes(self.location.origin));
      if (hadWindow) { hadWindow.navigate(url); return hadWindow.focus(); }
      return clients.openWindow(url);
    })
  );
});
