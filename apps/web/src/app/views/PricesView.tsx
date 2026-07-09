import { useState } from "react";
import { serializeConfig } from "../../core/config/codecs";
import { fmtNum, useApp, useDerived } from "../store/selectors";
import { writeFile } from "../store/store";

function CopyableCommand({ cmd }: { cmd: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="mb-2 flex items-center gap-2">
      <code className="flex-1 overflow-x-auto rounded border border-zinc-700 bg-zinc-900 px-3 py-2 text-xs whitespace-nowrap">
        {cmd}
      </code>
      <button
        onClick={() => {
          void navigator.clipboard.writeText(cmd).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          });
        }}
        className="shrink-0 rounded bg-zinc-700 px-3 py-2 text-xs hover:bg-zinc-600"
      >
        {copied ? "Copiato ✓" : "Copia"}
      </button>
    </div>
  );
}

function CoverageControls() {
  const s = useApp();
  const [anni, setAnni] = useState(String(s.config.storicoAnni));
  const [saved, setSaved] = useState(false);

  async function save(nextAnni: string, nextIntervallo: string) {
    const cfg = {
      ...s.config,
      storicoAnni: Math.max(0, Number(nextAnni) || s.config.storicoAnni),
      storicoIntervallo: nextIntervallo,
    };
    const ok = await writeFile("config.toml", serializeConfig(cfg));
    setSaved(ok);
    if (ok) setTimeout(() => setSaved(false), 1500);
  }

  return (
    <div className="mb-3 flex items-center gap-3 text-sm">
      <label className="text-zinc-400">Copertura</label>
      <input
        value={anni}
        onChange={(e) => setAnni(e.target.value)}
        onBlur={() => void save(anni, s.config.storicoIntervallo)}
        className="w-14 rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-right tabular-nums"
      />
      <span className="text-zinc-500">anni</span>
      <select
        value={s.config.storicoIntervallo}
        onChange={(e) => void save(anni, e.target.value)}
        className="rounded border border-zinc-700 bg-zinc-900 px-2 py-1"
      >
        <option value="1d">giornaliero</option>
        <option value="1wk">settimanale</option>
        <option value="1mo">mensile</option>
      </select>
      {saved && <span className="text-xs text-emerald-400">config.toml salvato ✓</span>}
    </div>
  );
}

function CommandForDataDir() {
  const s = useApp();
  // il percorso esatto è noto solo se il CLI l'ha annotato in config.toml
  // (il browser non può rilevarlo: la FS Access API non espone i percorsi)
  const path =
    s.config.percorsoDati ??
    `~/Documents/${s.store?.kind === "fsa" ? s.store.label : "<cartella-dati>"}`;
  // origin + base path della project page (es. .../unportfolio), senza slash finale
  const site = (window.location.origin + import.meta.env.BASE_URL).replace(/\/+$/, "");
  return (
    <>
      <CopyableCommand cmd={`curl -fsSL ${site}/init.sh | sh -s -- "${path}" --prezzi`} />
      {!s.config.percorsoDati && (
        <p className="mb-2 text-xs text-amber-400">
          Percorso stimato: il browser non può rilevarlo. Al primo run il comando lo annota in
          config.toml e da lì in poi qui apparirà quello esatto.
        </p>
      )}
      <p className="mb-2 text-xs text-zinc-600">
        Self-contained: al primo run scarica il binario prezzi (bun compilato, nessun runtime
        richiesto) in <code>~/.local/bin</code>, poi aggiorna. Una volta installato puoi lanciarlo
        diretto: <code className="select-all">~/.local/bin/unportfolio-prices "{path}"</code>
      </p>
    </>
  );
}

export function PricesView() {
  const { commodities, prices, booked } = useDerived();
  const s = useApp();

  // le posizioni sono chiaviate per deposito (holdingKey "broker|commodity");
  // qui aggrego per commodity (ISIN puro), che è la chiave di prezzi, info e
  // nome — come fanno patrimonio/assets con pos.commodity.
  const open = [...booked.positions.values()]
    .filter((p) => !p.units.isZero())
    .filter((p, i, arr) => arr.findIndex((q) => q.commodity === p.commodity) === i);

  // commodity → nome del conto (etichetta visualizzata, come nelle altre viste)
  const nomeByCommodity = new Map(
    s.accounts.filter((a) => a.commodity).map((a) => [a.commodity!, a.nome]),
  );

  return (
    <div className="max-w-3xl space-y-6">
      <section>
        <h2 className="mb-2 text-lg font-semibold">Aggiornamento prezzi</h2>
        <p className="mb-2 text-xs text-zinc-500">
          I prezzi si aggiornano da terminale (niente CORS, niente proxy): ETF via Yahoo risolti
          dall'ISIN, bond MOT via Borsa Italiana. Copertura incrementale fino al target qui sotto
          (config.toml, sezione [prezzi]); l'app rilegge i file da sola quando torni qui.
        </p>
        <CoverageControls />
        <CommandForDataDir />
      </section>

      <section>
        <h2 className="mb-2 text-lg font-semibold">Stato prezzi</h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-700 text-left text-zinc-400 [&>th]:px-2 [&>th]:py-1.5 [&>th]:font-medium">
              <th>Strumento</th>
              <th>Sorgente</th>
              <th className="text-right">Ultimo campione</th>
              <th className="text-right">Campioni</th>
            </tr>
          </thead>
          <tbody>
            {open.map((p) => {
              const commodity = p.commodity;
              const info = commodities.get(commodity);
              const series = prices.get(commodity) ?? [];
              const last = series[series.length - 1];
              return (
                <tr key={commodity} className="border-b border-zinc-800 [&>td]:px-2 [&>td]:py-1.5">
                  <td className="font-medium">
                    {nomeByCommodity.get(commodity) ?? info?.ticker ?? commodity}
                  </td>
                  <td className="text-xs text-zinc-500">
                    {info?.assetClass === "BOND"
                      ? `borsa-italiana:${info.isin}.MOT`
                      : (info?.priceSource ?? "— (risolto dall'ISIN al primo run)")}
                  </td>
                  <td className="text-right tabular-nums">
                    {last ? (
                      <>
                        {fmtNum(last.price)}{" "}
                        <span className="text-xs text-zinc-500">{last.date}</span>
                      </>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="text-right tabular-nums text-zinc-500">{series.length}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>
    </div>
  );
}
