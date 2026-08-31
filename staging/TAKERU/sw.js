// ★デプロイ(push)のたびに SW_VERSION と CACHE_NAME の番号を一緒に上げる
const SW_VERSION = 'v117';
const CACHE_NAME = 'takeru-v117';

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
        caches.open(CACHE_NAME).then(cache =>
            // 必ずネットワークの最新を取り込む（cache:'reload'でHTTPキャッシュを迂回）。
            // これをしないと、sw.jsだけ最新なのにapp.jsは古い、という取り違えが起きる。
            // 1つ失敗しても他は取り込めるよう個別にput（addAllは全滅する）。
            Promise.all(PRE_CACHE.map(url =>
                fetch(new Request(url, { cache: 'reload' }))
                    .then(res => res.ok ? cache.put(url, res) : null)
                    .catch(() => null)
            ))
        )
        // skipWaiting はユーザー確認後に message 経由で実行
    );
});

self.addEventListener('message', e => {
    if (e.data === 'SKIP_WAITING') self.skipWaiting();
    // 設定画面が「現在のバージョン」を問い合わせてきたら返す
    else if (e.data === 'GET_VERSION' && e.ports[0]) e.ports[0].postMessage(SW_VERSION);
});

self.addEventListener('activate', e => {
    e.waitUntil(
        caches.keys().then(keys =>
            Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
        ).then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', e => {
    // GET以外（アクセス計測 log.php へのPOST等）はSWで触らずネットワークへ素通し。
    // iOSでは POST を respondWith 経由で再fetchすると本文が届かないことがある。
    if (e.request.method !== 'GET') return;

    const url = new URL(e.request.url);

    // CSV・mp3list.jsonは常にネットワーク優先（更新を反映するため）、失敗時はキャッシュ
    if (url.pathname.endsWith('.csv') || url.pathname.endsWith('mp3list.json')) {
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
