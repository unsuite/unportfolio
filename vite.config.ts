/// <reference types="vitest/config" />

import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // porta fissa: se è occupata Vite fallisce subito invece di scegliere una
  // porta nuova (che lascerebbe i tab/PWA vecchi orfani su porte morte)
  server: { port: 5173, strictPort: true },
  test: {
    include: ["tests/**/*.test.ts", "src/**/*.test.ts"],
  },
});
