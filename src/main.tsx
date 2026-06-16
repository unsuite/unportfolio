import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./app/App";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// PWA: registra il service worker SOLO in produzione, così l'app è installabile
// e Chrome conserva i permessi sulla cartella dati tra i riavvii. In dev NON lo
// registriamo (e ripuliamo eventuali registrazioni pregresse): installare la PWA
// su una porta di Vite la "incolla" a quella porta, che a ogni riavvio cambia.
if ("serviceWorker" in navigator) {
  if (import.meta.env.PROD) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    });
  } else {
    void navigator.serviceWorker.getRegistrations().then((regs) => {
      for (const reg of regs) void reg.unregister();
    });
  }
}
