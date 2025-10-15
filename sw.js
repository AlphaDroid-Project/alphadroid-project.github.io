// Service Worker for AlphaDroid Project Website
const CACHE_NAME = 'alphadroid-v1.0.0';
const STATIC_CACHE = 'alphadroid-static-v1.0.0';
const DYNAMIC_CACHE = 'alphadroid-dynamic-v1.0.0';

// Static assets to cache immediately
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/style.css',
  '/index.js',
  '/route.js',
  '/pages/home.html',
  '/pages/devices.html',
  '/images/fav.ico',
  '/images/logo.jpg'
];

// Dynamic assets to cache on demand
const DYNAMIC_PATTERNS = [
  /\/data\/.*\.json$/,
  /\/images\/devices\/.*\.(png|jpg|jpeg|webp)$/,
  /\/images\/Screenshot_.*\.png$/
];

// Install event - cache static assets
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then(cache => {
        console.log('Caching static assets');
        return cache.addAll(STATIC_ASSETS.map(url => new Request(url, { cache: 'reload' })));
      })
      .catch(err => console.warn('Failed to cache static assets:', err))
  );
  self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(cacheNames => {
        return Promise.all(
          cacheNames
            .filter(cacheName => 
              cacheName !== STATIC_CACHE && 
              cacheName !== DYNAMIC_CACHE &&
              cacheName.startsWith('alphadroid-')
            )
            .map(cacheName => {
              console.log('Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            })
        );
      })
  );
  self.clients.claim();
});

// Fetch event - serve from cache with network fallback
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') return;

  // Skip cross-origin requests (except for specific patterns)
  if (url.origin !== location.origin && 
      !url.hostname.includes('fonts.googleapis.com') &&
      !url.hostname.includes('fonts.gstatic.com') &&
      !url.hostname.includes('cdn.jsdelivr.net')) {
    return;
  }

  event.respondWith(
    caches.match(request)
      .then(response => {
        // Return cached version if available
        if (response) {
          return response;
        }

        // Check if this is a dynamic asset that should be cached
        const shouldCache = DYNAMIC_PATTERNS.some(pattern => pattern.test(url.pathname));

        if (shouldCache) {
          return fetch(request)
            .then(networkResponse => {
              // Don't cache non-ok responses
              if (!networkResponse.ok) {
                return networkResponse;
              }

              // Clone the response before caching
              const responseClone = networkResponse.clone();
              
              caches.open(DYNAMIC_CACHE)
                .then(cache => {
                  cache.put(request, responseClone);
                })
                .catch(err => console.warn('Failed to cache dynamic asset:', err));

              return networkResponse;
            })
            .catch(() => {
              // Return offline page for navigation requests
              if (request.mode === 'navigate') {
                return caches.match('/index.html');
              }
              throw new Error('Network request failed');
            });
        }

        // For other requests, try network first
        return fetch(request)
          .catch(() => {
            // Return offline page for navigation requests
            if (request.mode === 'navigate') {
              return caches.match('/index.html');
            }
            throw new Error('Network request failed');
          });
      })
  );
});

// Background sync for critical data updates
self.addEventListener('sync', event => {
  if (event.tag === 'background-sync') {
    event.waitUntil(
      // Sync device data in background
      fetch('/data/devices.json', { cache: 'no-cache' })
        .then(response => response.ok ? response.json() : null)
        .then(data => {
          if (data) {
            // Update cache with fresh data
            caches.open(DYNAMIC_CACHE)
              .then(cache => {
                cache.put('/data/devices.json', new Response(JSON.stringify(data)));
              });
          }
        })
        .catch(err => console.warn('Background sync failed:', err))
    );
  }
});

// Push notifications for updates (if needed in future)
self.addEventListener('push', event => {
  if (event.data) {
    const data = event.data.json();
    const options = {
      body: data.body,
      icon: '/images/fav.ico',
      badge: '/images/fav.ico',
      tag: 'alphadroid-update',
      requireInteraction: false,
      actions: [
        {
          action: 'view',
          title: 'View Update',
          icon: '/images/fav.ico'
        }
      ]
    };

    event.waitUntil(
      self.registration.showNotification(data.title, options)
    );
  }
});

// Handle notification clicks
self.addEventListener('notificationclick', event => {
  event.notification.close();
  
  if (event.action === 'view') {
    event.waitUntil(
      clients.openWindow('/')
    );
  }
});
