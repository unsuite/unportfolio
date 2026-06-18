/**
 * Versione dell'app: lo sha del commit impresso al build (vite.config.ts) e il
 * confronto con la versione attualmente deployata (version.json), per capire da
 * Impostazioni se un reload porterebbe una build più recente.
 */

/** Commit con cui è stato buildato il bundle in esecuzione. */
export const APP_SHA: string = typeof __APP_SHA__ === "string" ? __APP_SHA__ : "dev";
/** Istante (ISO) del build del bundle in esecuzione. */
export const APP_BUILD_TIME: string =
  typeof __APP_BUILD_TIME__ === "string" ? __APP_BUILD_TIME__ : "";

export const REPO_URL = "https://github.com/unsuite/unportfolio";
/** Link alla cronologia commit di main, per vedere qual è l'ultima versione. */
export const COMMITS_URL = `${REPO_URL}/commits/main`;
/** Link al commit specifico in esecuzione (assente in dev). */
export function commitUrl(sha: string): string {
  return `${REPO_URL}/commit/${sha}`;
}

export type UpdateCheck =
  | { status: "current"; sha: string }
  | { status: "stale"; sha: string; time: string }
  | { status: "error"; message: string };

/**
 * Scarica version.json dalla copia deployata (cache-busted) e lo confronta con
 * lo sha in esecuzione. "stale" = è uscita una build più recente: basta ricaricare.
 */
export async function checkLatest(): Promise<UpdateCheck> {
  try {
    const res = await fetch(`${import.meta.env.BASE_URL}version.json?t=${Date.now()}`, {
      cache: "no-store",
    });
    if (!res.ok) return { status: "error", message: `HTTP ${res.status}` };
    const { sha, time } = (await res.json()) as { sha: string; time: string };
    if (sha === APP_SHA) return { status: "current", sha };
    return { status: "stale", sha, time };
  } catch (e) {
    return { status: "error", message: e instanceof Error ? e.message : String(e) };
  }
}
