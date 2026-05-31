// SAMPLER STUDIO Service Worker
// PWA 必須 (file_handlers が機能するには SW が必要)
// 最小構成: アプリシェル (index.html) だけキャッシュ、それ以外はネットワーク優先
//
// 注意: 音源データ (blob URL / OPFS / プロジェクトフォルダ) は SW では扱わない。
// SW はあくまでアプリ本体 (HTML/JS/CSS) のキャッシュのみ。

const SW_CACHE_NAME = 'sampler-studio-v12.9.17';
const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './icon.svg',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SW_CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
      .catch(err => console.warn('[SW] install cache failed', err))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  // 古いキャッシュを削除
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(names.filter(n => n !== SW_CACHE_NAME).map(n => caches.delete(n)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  // GET 以外はキャッシュしない
  if (req.method !== 'GET') return;
  // index.html / manifest.json は network-first (更新を即反映)
  const url = new URL(req.url);
  const isAppShell = url.pathname.endsWith('/') ||
                     url.pathname.endsWith('/index.html') ||
                     url.pathname.endsWith('/manifest.json');
  if (isAppShell) {
    event.respondWith(
      fetch(req).then(resp => {
        // 成功したらキャッシュ更新
        const copy = resp.clone();
        caches.open(SW_CACHE_NAME).then(c => c.put(req, copy)).catch(_ => {});
        return resp;
      }).catch(() => caches.match(req))
    );
    return;
  }
  // それ以外はネットワーク優先 (オフライン時のみキャッシュ)
  event.respondWith(
    fetch(req).catch(() => caches.match(req))
  );
});
