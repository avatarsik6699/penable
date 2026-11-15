export const ServiceWorkerSource = {
  create({ base, prefix, version, files, integrities }) {
    return `const BASE = ${JSON.stringify(base)};
const PREFIX = ${JSON.stringify(prefix)};
const CACHE_NAME = PREFIX + ${JSON.stringify(version)};
const PRECACHE = ${JSON.stringify(files)};
const INTEGRITIES = ${JSON.stringify(integrities)};
const URLS = new Set(PRECACHE.map(path => new URL(path, self.location.origin).href));
self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(PRECACHE.map(path => new Request(path, { cache: "reload", integrity: INTEGRITIES[path] })))).catch(async error => {
    await caches.delete(CACHE_NAME);
    throw error;
  }));
});
self.addEventListener("activate", event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys
    .filter(key => key.startsWith(PREFIX) && key !== CACHE_NAME)
    .map(key => caches.delete(key)))));
});
self.addEventListener("fetch", event => {
  const url = new URL(event.request.url);
  if (event.request.method !== "GET" || url.origin !== self.location.origin || !url.pathname.startsWith(BASE)) return;
  const navigation = event.request.mode === "navigate" && (url.pathname === BASE || url.pathname === BASE + "index.html");
  const key = navigation ? BASE + "index.html" : url.href;
  if (!navigation && !URLS.has(url.href)) return;
  event.respondWith(caches.open(CACHE_NAME).then(cache => cache.match(key)).then(response => response || fetch(event.request)));
});
`;
  },
};
