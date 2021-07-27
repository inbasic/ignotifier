const PERIOD = 10 * 60 * 1000;

const observe = async ({request}) => {
  const now = Date.now();
  const href = request.url;

  if (href && href.startsWith('https://')) {
    const cache = await caches.open('static-v1');
    let response = await caches.match(request);
    if (response) {
      const date = (new Date(response.headers.get('date'))).getTime();
      if (now - date < PERIOD) {
        return response;
      }
    }
    response = await fetch(request);

    // cache
    if (request.method === 'GET') {
      cache.put(request, response.clone());
    }

    console.log(href, request, response);
    return response;
  }
  else {
    return await fetch(request);
  }
};
self.addEventListener('fetch', e => e.respondWith(observe(e)));

self.addEventListener('activate', () => self.clients.claim());
self.addEventListener('install', () => self.skipWaiting());
