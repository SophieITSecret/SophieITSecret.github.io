// sw.js — BARソフィー Service Worker (no-cache)
// キャッシュ不使用：常にネットワークから最新ファイルを取得
// デプロイのたびにこの番号を上げる → ブラウザが更新を検知してトーストを表示
const SW_VERSION = 'v32';
self.addEventListener('install', () => { /* skipWaiting はユーザー確認後に message 経由で実行 */ });

self.addEventListener('message', e => {
  if (e.data === 'SKIP_WAITING') self.skipWaiting();
});
self.addEventListener('activate', event => {
  // 旧キャッシュをすべて削除
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.map(k => caches.delete(k))))
  );
  self.clients.claim();
});
// fetchはすべてネットワークに流す（キャッシュしない）
