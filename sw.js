// RepoHub Service Worker
const CACHE_NAME = ‘repohub-v1’;

// キャッシュするUIシェル（repoのJSONやAPIは除く）
const SHELL_ASSETS = [
‘/’,
‘/index.html’,
‘/manifest.json’,
];

// インストール時にシェルをキャッシュ
self.addEventListener(‘install’, e => {
self.skipWaiting();
e.waitUntil(
caches.open(CACHE_NAME).then(cache => cache.addAll(SHELL_ASSETS).catch(() => {}))
);
});

// 古いキャッシュを削除
self.addEventListener(‘activate’, e => {
e.waitUntil(
caches.keys().then(keys =>
Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
).then(() => self.clients.claim())
);
});

// フェッチ戦略
self.addEventListener(‘fetch’, e => {
const url = new URL(e.request.url);

// Workerへのリクエスト・外部API・fonts は常にネットワーク優先
const isExternal = url.hostname !== self.location.hostname;
if (isExternal) {
e.respondWith(fetch(e.request).catch(() => new Response(’’, { status: 503 })));
return;
}

// repo.jsonはネットワーク優先（最新を使う）、失敗時はキャッシュ
if (url.pathname.endsWith(‘repo.json’)) {
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

// UIシェル（HTML/JS/CSS/画像）: キャッシュ優先、なければネットワーク
e.respondWith(
caches.match(e.request).then(cached => {
if (cached) return cached;
return fetch(e.request).then(res => {
// imagesディレクトリはキャッシュに追加
if (url.pathname.startsWith(’/images/’)) {
caches.open(CACHE_NAME).then(c => c.put(e.request, res.clone()));
}
return res;
}).catch(() => {
// オフラインでindex.htmlを返す
if (e.request.mode === ‘navigate’) return caches.match(’/index.html’);
});
})
);
});