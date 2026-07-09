/// <reference types="vitest/config" />

import { execSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv, type Plugin } from "vite";

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
/** Versione di release (SemVer) da package.json: l'asse "0.1.0" mostrato in UI,
 *  distinto dallo sha del bundle e dalla revisione del formato dati. */
const APP_VERSION = JSON.parse(readFileSync(resolve("package.json"), "utf8")).version as string;

/** Script di setup serviti dal sito su cui iniettare il SITE_URL canonico. */
const SETUP_SCRIPTS = ["init.sh", "init.ps1"] as const;

/** Sostituisce il default del sito (SITE_DEFAULT / $SiteDefault) con `url`. */
function withSite(text: string, url: string): string {
  return text
    .replace(/(SITE_DEFAULT=")[^"]*(")/, `$1${url}$2`)
    .replace(/(\$SiteDefault\s*=\s*")[^"]*(")/, `$1${url}$2`);
}

/**
 * Inietta SITE_URL (.env) negli script di setup: nel build riscrive i file in
 * dist/, in dev li serve al volo via middleware. Il valore letterale negli .sh
 * resta come fallback se lanci lo script grezzo dal repo.
 */
function injectSite(url: string): Plugin {
  return {
    name: "unportfolio-inject-site",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const name = (req.url ?? "").split("?")[0]?.replace(/^\//, "");
        if (!name || !SETUP_SCRIPTS.includes(name as (typeof SETUP_SCRIPTS)[number])) return next();
        const file = resolve("public", name);
        if (!existsSync(file)) return next();
        res.setHeader("Content-Type", "text/plain; charset=utf-8");
        res.end(withSite(readFileSync(file, "utf8"), url));
      });
    },
    closeBundle() {
      for (const name of SETUP_SCRIPTS) {
        const file = resolve("dist", name);
        if (existsSync(file)) writeFileSync(file, withSite(readFileSync(file, "utf8"), url));
      }
    },
  };
}

/** Emette version.json nel build e lo serve anche in dev, così il check
 *  versione non becca l'index.html (SPA fallback) e in sviluppo risulta
 *  sempre "aggiornato" invece di fallire il parse JSON. */
function versionManifest(): Plugin {
  const payload = JSON.stringify({ sha: BUILD_SHA, time: BUILD_TIME, version: APP_VERSION });
  return {
    name: "unportfolio-version-manifest",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if ((req.url ?? "").split("?")[0] !== "/version.json") return next();
        res.setHeader("Content-Type", "application/json; charset=utf-8");
        res.end(payload);
      });
    },
    generateBundle() {
      this.emitFile({ type: "asset", fileName: "version.json", source: payload });
    },
  };
}

export default defineConfig(({ command, mode }) => ({
  // project page GitHub Pages: gli asset vivono sotto /unportfolio/. In dev e
  // test il base resta "/" così il dev server serve l'app dalla radice.
  base: command === "build" ? "/unportfolio/" : "/",
  plugins: [
    react(),
    tailwindcss(),
    versionManifest(),
    injectSite(
      loadEnv(mode, process.cwd(), "").SITE_URL ?? "https://unsuite.github.io/unportfolio",
    ),
  ],
  define: {
    __APP_SHA__: JSON.stringify(BUILD_SHA),
    __APP_BUILD_TIME__: JSON.stringify(BUILD_TIME),
    __APP_VERSION__: JSON.stringify(APP_VERSION),
  },
  // prova la 5173 e, se occupata, prende la prima porta libera successiva
  server: { port: 5173, strictPort: false },
  test: {
    include: ["tests/**/*.test.ts", "src/**/*.test.ts"],
  },
}));
