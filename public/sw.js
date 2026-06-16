// Service worker minimale: serve solo a rendere l'app installabile come PWA,
// così Chrome conserva i permessi sulla cartella dati (File System Access API)
// tra un riavvio e l'altro. Nessuna cache: i bundle Vite hanno nomi con hash e
// non vogliamo servire asset stantii. Il fetch handler è volutamente no-op.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));
self.addEventListener("fetch", () => {});
