// public/sw.js — 최소 서비스워커 (설치 가능 조건 충족 + 오프라인 폴백)
const CACHE = 'office-calendar-shell-v1';

self.addEventListener('install', (e) => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then((c) => c.add('/index.html')));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  // 🔑 페이지 이동 요청만 처리. Firestore/API/이미지는 절대 건드리지 않음
  if (e.request.mode !== 'navigate') return;
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put('/index.html', copy));
        return res;
      })
      .catch(() => caches.match('/index.html'))
  );
});