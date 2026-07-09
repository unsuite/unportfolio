import {
  createHashHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Link,
  Outlet,
  redirect,
} from "@tanstack/react-router";
import { DATA_FORMAT_MIN, dataVersionLabel } from "@unportfolio/core/config/format";
import { useInstallPrompt } from "./pwa/install";
import { useApp } from "./store/selectors";
import { dismissNotices, migrateStore } from "./store/store";
import { VersionFooter } from "./VersionFooter";
import { GoalsView } from "./views/GoalsView";
import { GuidaView } from "./views/GuidaView";
import { MovimentiView } from "./views/MovimentiView";
import { PatrimonioView } from "./views/PatrimonioView";
import { PensioneView } from "./views/PensioneView";
import { PricesView } from "./views/PricesView";
import { RibilanciamentoView } from "./views/RibilanciamentoView";
import { SettingsView } from "./views/SettingsView";

/**
 * Routing client-only con TanStack Router (ADR-0008). Nessun loader su server:
 * i dati arrivano dallo store locale (File System Access). Usiamo hash history
 * così i deep-link funzionano su GitHub Pages senza fallback lato server.
 */
const TABS = [
  ["patrimonio", "Patrimonio"],
  ["goals", "Goals"],
  ["pensione", "Pensione"],
  ["ribilanciamento", "Ribilancia"],
  ["movimenti", "Movimenti"],
  ["prezzi", "Prezzi"],
  ["impostazioni", "Impostazioni"],
  ["guida", "Guida"],
] as const;

/** Guscio dell'app: header + nav + banner + <Outlet/> + footer. */
function Shell() {
  const s = useApp();
  const { canInstall, promptInstall } = useInstallPrompt();

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <header className="sticky top-0 z-30 border-b border-zinc-800 bg-zinc-900/90 px-6 py-3 backdrop-blur">
        <div className="flex items-center gap-6">
          <h1 className="text-lg font-bold tracking-tight">unportfolio</h1>
          <nav className="flex gap-1">
            {TABS.map(([id, label]) => (
              <Link
                key={id}
                to={`/${id}`}
                className="rounded px-3 py-1 text-sm text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
                activeProps={{ className: "rounded px-3 py-1 text-sm bg-zinc-700 text-white" }}
              >
                {label}
              </Link>
            ))}
          </nav>
          {canInstall ? (
            <button
              type="button"
              onClick={promptInstall}
              title="Installa l'app: il browser ricorderà il permesso sulla cartella tra i riavvii"
              className="ml-auto rounded bg-sky-700 px-3 py-1 text-sm font-medium hover:bg-sky-600"
            >
              Installa l'app
            </button>
          ) : null}
        </div>
      </header>
      {s.formatBlocked && (
        <div className="flex flex-wrap items-center gap-3 border-b border-red-900 bg-red-950 px-6 py-3 text-sm text-red-300">
          <span>
            Versione dati cartella {dataVersionLabel(s.dataFormat)} non più supportata (minimo{" "}
            {dataVersionLabel(DATA_FORMAT_MIN)}). Le modifiche sono disabilitate finché non aggiorni
            la cartella.
          </span>
          <button
            type="button"
            onClick={() => void migrateStore()}
            disabled={s.busy}
            className="rounded bg-red-800 px-3 py-1 font-medium text-red-50 hover:bg-red-700 disabled:opacity-50"
          >
            Correggi automaticamente
          </button>
        </div>
      )}
      {s.notices.length > 0 && (
        <div
          className="cursor-pointer border-b border-sky-900 bg-sky-950 px-6 py-2 text-sm text-sky-300"
          onClick={dismissNotices}
        >
          {s.notices.map((n, i) => (
            <div key={i}>{n}</div>
          ))}
        </div>
      )}
      <main className="px-6 py-6">
        <Outlet />
      </main>
      <VersionFooter />
    </div>
  );
}

const rootRoute = createRootRoute({ component: Shell });

/** Radice "/" → reindirizza al primo tab. */
const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  beforeLoad: () => {
    throw redirect({ to: "/patrimonio" });
  },
});

const VIEWS = {
  patrimonio: PatrimonioView,
  goals: GoalsView,
  pensione: PensioneView,
  ribilanciamento: RibilanciamentoView,
  movimenti: MovimentiView,
  prezzi: PricesView,
  impostazioni: SettingsView,
  guida: GuidaView,
} as const;

const tabRoutes = TABS.map(([id]) =>
  createRoute({
    getParentRoute: () => rootRoute,
    path: `/${id}`,
    component: VIEWS[id],
  }),
);

const routeTree = rootRoute.addChildren([indexRoute, ...tabRoutes]);

export const router = createRouter({
  routeTree,
  history: createHashHistory(),
  defaultPreload: "intent",
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
