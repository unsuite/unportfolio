/// <reference types="vitest/config" />

import { execSync } from "node:child_process";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";

/** Commit corrente (short sha) al momento del build; "dev" se git non è disponibile. */
function gitSha(): string {
  try {
    return execSync("git rev-parse --short HEAD", { encoding: "utf8" }).trim();
  } catch {
    return "dev";
  }
}

const BUILD_SHA = gitSha();
const BUILD_TIME = new Date().toISOString();

/** Emette version.json nel build, così l'app può confrontare la versione deployata. */
function versionManifest(): Plugin {
  return {
    name: "unportfolio-version-manifest",
    generateBundle() {
      this.emitFile({
        type: "asset",
        fileName: "version.json",
        source: JSON.stringify({ sha: BUILD_SHA, time: BUILD_TIME }),
      });
    },
  };
}

export default defineConfig(({ command }) => ({
  // project page GitHub Pages: gli asset vivono sotto /unportfolio/. In dev e
  // test il base resta "/" così il dev server serve l'app dalla radice.
  base: command === "build" ? "/unportfolio/" : "/",
  plugins: [react(), tailwindcss(), versionManifest()],
  define: {
    __APP_SHA__: JSON.stringify(BUILD_SHA),
    __APP_BUILD_TIME__: JSON.stringify(BUILD_TIME),
  },
  // porta fissa: se è occupata Vite fallisce subito invece di scegliere una
  // porta nuova (che lascerebbe i tab/PWA vecchi orfani su porte morte)
  server: { port: 5173, strictPort: true },
  test: {
    include: ["tests/**/*.test.ts", "src/**/*.test.ts"],
  },
}));
