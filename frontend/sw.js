const CACHE_NAME = 'busflux-v2';
const ASSETS = [
  './',
  './index.html',
  './login.html',
  './register.html',
  './profile.html',
  './conductor.html',
  './admin.html',
  './wallet.html',
  './forgot.html',
  './bookings.html',
  './buses.html',
  './style.css',
  './script.js',
  './manifest.json',
  './icons/icon-192x192.png',
  './icons/icon-512x512.png',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css'
];

// Install Event - cache the core assets
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      console.log('[Service Worker] Caching app shell assets');
      return cache.addAll(ASSETS).catch(err => {
        console.warn('[Service Worker] Cache addAll warning (some files might not be in build yet):', err);
      });
    })
  );
});

// Activate Event - clean up old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
      );
    })
  );
});

// Fetch Event - Network-First, Cache fallback for layout assets, pass through for APIs
self.addEventListener('fetch', event => {
  // Direct pass through for API endpoints or Razorpay gateway calls
  if (event.request.url.includes('/api/') || event.request.url.includes('razorpay')) {
    return;
  }
  
  event.respondWith(
    fetch(event.request)
      .then(response => {
        // Cache the newly fetched layout assets dynamically if status is OK
        if (response && response.status === 200 && response.type === 'basic') {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, responseClone);
          });
        }
        return response;
      })
      .catch(() => {
        // If network is offline, load from cache
        return caches.match(event.request);
      })
  );
});
