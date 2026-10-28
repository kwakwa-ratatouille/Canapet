// Service worker minimal : rend l'appli installable, sans rien garder en cache (toujours la dernière version).
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', () => {});
