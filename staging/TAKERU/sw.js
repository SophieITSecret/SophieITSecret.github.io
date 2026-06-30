const CACHE_NAME = 'takeru-v11';

const PRE_CACHE = [
    './',
    './index.html',
    './app.js',
    './style.css',
    './TAKERUcard.csv',
    './MSlink.csv',
    './icon-192.png',
    './icon-512.png',
    './takeru-touch-icon.png',
    './images/takeru-top.jpg'
];

self.addEventListener('install', e => {
    e.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(PRE_CACHE))
        // skipWaiting はユーザー確認後に message 経由で実行
    );
});

self.addEventListener('message', e => {
    if (e.data === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('activate', e => {
    e.waitUntil(
        caches.keys().then(keys =>
            Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
        ).then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', e => {
    const url = new URL(e.request.url);

    // CSVは常にネットワーク優先（更新を反映するため）、失敗時はキャッシュ
    if (url.pathname.endsWith('.csv')) {
        e.respondWith(
            fetch(e.request)
                .then(res => {
                    const clone = res.clone();
                    caches.open(CACHE_NAME).then(c => c.put(e.request, clone));
                    return res;
                })
                .catch(() => caches.match(e.request))
        );
        return;
    }

    // 画像・音声はキャッシュ優先（初回アクセス時にキャッシュ）
    if (url.pathname.match(/\.(png|jpg|jpeg|mp3)$/i)) {
        e.respondWith(
            caches.match(e.request).then(cached => {
                if (cached) return cached;
                return fetch(e.request).then(res => {
                    // 成功時のみキャッシュ（404などはキャッシュしない＝後で画像を追加したら出る）
                    if (res.ok) {
                        const clone = res.clone();
                        caches.open(CACHE_NAME).then(c => c.put(e.request, clone));
                    }
                    return res;
                });
            })
        );
        return;
    }

    // その他はキャッシュ優先
    e.respondWith(
        caches.match(e.request).then(cached => cached || fetch(e.request))
    );
});
