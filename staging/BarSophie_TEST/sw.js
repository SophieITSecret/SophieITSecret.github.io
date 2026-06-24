// sw.js — BARソフィー Service Worker (no-cache)
// キャッシュ不使用：常にネットワークから最新ファイルを取得
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', event => {
  // 旧キャッシュをすべて削除
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.map(k => caches.delete(k))))
  );
  self.clients.claim();
});
// fetchはすべてネットワークに流す（キャッシュしない）
