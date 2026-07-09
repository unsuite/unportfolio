// Service worker: rende l'app installabile come PWA (così Chrome conserva i
// permessi sulla cartella dati tra i riavvii) e garantisce che il documento
// HTML sia sempre fresco. Gli asset Vite hanno l'hash nel nome (immutabili): il
// solo file che può "incollarsi" nella cache HTTP è index.html, il puntatore ai
// bundle. Per le navigazioni lo prendiamo sempre dalla rete (cache: "reload"),
// così dopo un deploy basta un reload normale per avere la build aggiornata.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));
self.addEventListener("fetch", (event) => {
  if (event.request.mode === "navigate") {
    event.respondWith(fetch(event.request, { cache: "reload" }).catch(() => fetch(event.request)));
  }
  // resto: comportamento di default (asset hashati = sempre validi)
});
