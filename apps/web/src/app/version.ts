/**
 * Versione dell'app: lo sha del commit impresso al build (vite.config.ts) e il
 * confronto con la versione attualmente deployata (version.json), per capire da
 * Impostazioni se un reload porterebbe una build più recente.
 */

/** Versione di release (SemVer, da package.json) del bundle in esecuzione.
 *  Asse "0.1.0" delle release GitHub, distinto dallo sha del commit. */
export const APP_VERSION: string = typeof __APP_VERSION__ === "string" ? __APP_VERSION__ : "dev";
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
/** Link alla release GitHub del tag `vX.Y.Z`. */
export function releaseUrl(version: string): string {
  return `${REPO_URL}/releases/tag/v${version}`;
}

export type UpdateCheck =
  | { status: "current"; sha: string; version: string }
  | { status: "stale"; sha: string; time: string; version: string }
  | { status: "error"; message: string };

/**
 * Scarica version.json dalla copia deployata (cache-busted) e lo confronta con
 * lo sha in esecuzione. "stale" = è uscita una build più recente: basta ricaricare.
 * Espone anche la `version` (SemVer) per mostrarla al posto dello sha.
 */
export async function checkLatest(): Promise<UpdateCheck> {
  try {
    const res = await fetch(`${import.meta.env.BASE_URL}version.json?t=${Date.now()}`, {
      cache: "no-store",
    });
    if (!res.ok) return { status: "error", message: `HTTP ${res.status}` };
    const { sha, time, version } = (await res.json()) as {
      sha: string;
      time: string;
      version?: string;
    };
    const ver = version ?? "?";
    if (sha === APP_SHA) return { status: "current", sha, version: ver };
    return { status: "stale", sha, time, version: ver };
  } catch (e) {
    return { status: "error", message: e instanceof Error ? e.message : String(e) };
  }
}
