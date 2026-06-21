// sw.js — BARソフィー Service Worker
const CACHE_NAME = 'bar-sophie-v1';

const STATIC_ASSETS = [
  '/',
  '/index_m.html',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/apple-touch-icon.png',
  '/css/style_m.css',
  '/js/app_m.js',
  '/js/navigation.js',
  '/js/music.js',
  '/js/fortune.js',
  '/js/compatibility.js',
  '/js/dj_sophie.js',
  '/js/media.js',
  '/js/utils.js',
  '/front_sophie.jpeg',
  '/sophie_face.png',
  '/sophie_shake.png',
];

// インストール: 主要静的ファイルをキャッシュ
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS))
  );
  // 旧バージョンのSWがいても即座にアクティブ化
  self.skipWaiting();
});

// アクティベート: 古いキャッシュを削除
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
      )
    )
  );
  // 開いているページをすぐにこのSWの管理下に置く
  self.clients.claim();
});

// フェッチ: ネットワーク優先、失敗時にキャッシュへフォールバック
// Firebase Hosting との競合を避けるため、外部リクエストはスルー
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // 外部リクエスト（Firebase Auth、Firestore、YouTube等）はSWを通さない
  if (url.origin !== self.location.origin) return;

  // sw.js 自体はキャッシュしない（Firebase Hostingの no-cache ヘッダーに任せる）
  if (url.pathname === '/sw.js') return;

  event.respondWith(
    fetch(event.request)
      .then(response => {
        // 正常レスポンスをキャッシュに保存（GETのみ）
        if (event.request.method === 'GET' && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
