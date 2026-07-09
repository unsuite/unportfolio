import { Decimal } from "decimal.js";
import { ChevronsDownUp, ChevronsUpDown, Pencil, Plus } from "lucide-react";
import { Fragment, type ReactNode, useMemo, useState } from "react";
import type { IsoDate, TransactionDirective } from "../../core/beancount/ast";
import { book, holdingKey } from "../../core/beancount/booking";
import { type AssetRow, type CommodityInfo, deriveAssets } from "../../core/derive/assets";
import { deriveBolloTitoli } from "../../core/derive/bollo";
import { deriveManualReturn } from "../../core/derive/manualReturn";
import type { PatrimonioRow, PatrimonioStatement } from "../../core/derive/patrimonio";
import type { PriceTable } from "../../core/derive/prices";
import { deriveReturns } from "../../core/derive/returns";
import {
  deriveGroupStats,
  deriveValueSeries,
  type TimelinePoint,
} from "../../core/derive/timeline";
import type { PatrimonioAccount } from "../../core/model/config";
import { fmtEur, fmtNum, fmtPct, useApp, useDerived } from "../store/selectors";
import { allDirectives } from "../store/store";
import { gainColor, holdingLabel, NameEditor, TaxEditInline } from "./AssetDetail";
import { ContoForm } from "./ContoForm";
import { AllocationBars, type GroupStats, InvestedValueChart, LineChart } from "./charts";
import { Modal } from "./Modal";
import { ManualSnapshotEditor, SnapshotForm } from "./SnapshotForm";

type GroupBy = "globale" | "assetclass" | "tracciamento" | "owner" | "portfolio";

/** Modalità del grafico di gruppo: valore assoluto, rendimento total-return
 *  (ribasato alla finestra), o capitale investito vs valore di mercato. */
type ChartMode = "valore" | "rendimento" | "investito";
const CHART_MODES: { key: ChartMode; label: string }[] = [
  { key: "valore", label: "Valore" },
  { key: "rendimento", label: "Rendimento" },
  { key: "investito", label: "Investito" },
];

/** Finestra temporale del grafico (quanto indietro mostrare). */
type ChartRange = "1m" | "3m" | "6m" | "1a" | "ytd" | "max";
const CHART_RANGES: { key: ChartRange; label: string }[] = [
  { key: "1m", label: "1M" },
  { key: "3m", label: "3M" },
  { key: "6m", label: "6M" },
  { key: "1a", label: "1A" },
  { key: "ytd", label: "YTD" },
  { key: "max", label: "Max" },
];
const RANGE_MONTHS: Partial<Record<ChartRange, number>> = { "1m": 1, "3m": 3, "6m": 6, "1a": 12 };

/** Data-soglia (inclusa) per una finestra, ancorata all'ultimo punto `anchor`
 *  (IsoDate "YYYY-MM-DD"). "max" → undefined (nessun taglio). Il confronto è
 *  lessicografico sulle stringhe ISO, quindi una soglia con giorno inesistente
 *  (es. "-11-31") resta comunque un limite valido. */
function chartCutoff(range: ChartRange, anchor: IsoDate): IsoDate | undefined {
  if (range === "max") return undefined;
  const [y, m, d] = anchor.split("-").map(Number) as [number, number, number];
  if (range === "ytd") return `${y}-01-01`;
  const months = RANGE_MONTHS[range]!;
  const total = y * 12 + (m - 1) - months;
  const ny = Math.floor(total / 12);
  const nm = (total % 12) + 1;
  return `${ny}-${String(nm).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/** Ritaglia una serie datata alla finestra: a destra su `when`, a sinistra su
 *  `range` (ancorato all'ultimo punto visibile). */
function windowByRange<T extends { date: IsoDate }>(
  arr: T[],
  when: IsoDate | "live",
  range: ChartRange,
): T[] {
  const upto = when === "live" ? arr : arr.filter((p) => p.date <= when);
  const cutoff = upto.length ? chartCutoff(range, upto[upto.length - 1]!.date) : undefined;
  return cutoff ? upto.filter((p) => p.date >= cutoff) : upto;
}

/** Mini segmented control in alto a destra del grafico. */
function ChartModeToggle({
  mode,
  onChange,
}: {
  mode: ChartMode;
  onChange: (m: ChartMode) => void;
}) {
  return (
    <div className="flex overflow-hidden rounded border border-zinc-700">
      {CHART_MODES.map((m) => (
        <button
          key={m.key}
          onClick={() => onChange(m.key)}
          className={`px-2 py-0.5 text-xs ${
            mode === m.key
              ? "bg-zinc-700 text-zinc-100"
              : "bg-zinc-900 text-zinc-400 hover:bg-zinc-800"
          }`}
        >
          {m.label}
        </button>
      ))}
    </div>
  );
}

/** Toggle del grafico nel dettaglio di un singolo strumento: prezzo (%) o
 *  capitale investito vs valore. */
function AssetChartToggle({
  mode,
  onChange,
}: {
  mode: "prezzo" | "investito";
  onChange: (m: "prezzo" | "investito") => void;
}) {
  const opts: { key: "prezzo" | "investito"; label: string }[] = [
    { key: "prezzo", label: "Prezzo" },
    { key: "investito", label: "Investito" },
  ];
  return (
    <div className="flex overflow-hidden rounded border border-zinc-700">
      {opts.map((o) => (
        <button
          key={o.key}
          onClick={() => onChange(o.key)}
          className={`px-2 py-0.5 text-xs ${
            mode === o.key
              ? "bg-zinc-700 text-zinc-100"
              : "bg-zinc-900 text-zinc-400 hover:bg-zinc-800"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Nota quando una modalità del grafico non ha abbastanza dati. */
function EmptyChartNote({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-44 items-center justify-center text-sm text-zinc-600">{children}</div>
  );
}

/** chiave di raggruppamento mono-valore (tutte le modalità tranne assetclass,
 *  dove un conto composito ricade su più classi: vedi classContributions). */
function groupKeyOf(a: PatrimonioAccount, groupBy: GroupBy): string {
  return groupBy === "globale"
    ? "Patrimonio"
    : groupBy === "tracciamento"
      ? a.commodity
        ? "Asset tracked"
        : "Asset campionati"
      : groupBy === "owner"
        ? a.owner || "—"
        : groupBy === "assetclass"
          ? a.tipo || "—"
          : (a.portfolio ?? "— senza goal —");
}

/** classi di un conto con la quota relativa: split se presente, altrimenti il
 *  tipo al 100%. Usato dal raggruppamento per asset class (distribuzione). */
function classContributions(a: PatrimonioAccount): { classe: string; weight: number }[] {
  if (a.split && a.split.length > 0)
    return a.split.map((s) => ({ classe: s.classe, weight: s.peso }));
  return [{ classe: a.tipo || "—", weight: 1 }];
}

const GROUP_LABELS: Record<GroupBy, string> = {
  globale: "globale",
  assetclass: "classe",
  tracciamento: "tracciamento",
  owner: "owner",
  portfolio: "portfolio",
};

/** suddivisione del valore (alla data scelta) delle righe di un gruppo lungo
 *  una dimensione: per classe distribuisce i conti compositi, altrimenti
 *  bucketizza per la chiave della dimensione. Solo conti in net worth. */
function breakdownOf(
  rows: PatrimonioRow[],
  dim: GroupBy,
  when: IsoDate | "live",
): Map<string, Decimal> {
  const out = new Map<string, Decimal>();
  const add = (k: string, v: Decimal) => out.set(k, (out.get(k) ?? new Decimal(0)).add(v));
  for (const r of rows) {
    if (!r.account.inNetWorth) continue;
    const v = when === "live" ? r.live : r.values.get(when);
    if (v === undefined || v.isZero()) continue;
    if (dim === "assetclass")
      for (const c of classContributions(r.account)) add(c.classe, v.mul(c.weight));
    else add(groupKeyOf(r.account, dim), v);
  }
  return out;
}

/** copia di una riga con valori (e live) scalati di un peso. */
function scaleRow(r: PatrimonioRow, weight: number): PatrimonioRow {
  if (weight === 1) return r;
  const k = new Decimal(weight);
  const values: typeof r.values = new Map();
  for (const [d, v] of r.values) values.set(d, v?.mul(k));
  return { account: r.account, values, live: r.live?.mul(k) };
}

/** valore di una riga a una certa colonna ("live" o una data). */
function valueAt(row: PatrimonioRow, when: IsoDate | "live"): Decimal | undefined {
  return when === "live" ? row.live : row.values.get(when);
}

/** serie dei valori della riga lungo le date + live (per la sparkline). */
function rowSeries(row: PatrimonioRow, dates: IsoDate[]): number[] {
  const out: number[] = [];
  for (const d of dates) {
    const v = row.values.get(d);
    if (v !== undefined) out.push(v.toNumber());
  }
  if (row.live !== undefined) out.push(row.live.toNumber());
  return out;
}

/** serie del totale di un gruppo (somma righe inNetWorth) lungo le date + live. */
function groupSeries(rows: PatrimonioRow[], dates: IsoDate[]): number[] {
  const inNW = rows.filter((r) => r.account.inNetWorth);
  const out: number[] = [];
  for (const d of dates) {
    let sum = 0;
    let any = false;
    for (const r of inNW) {
      const v = r.values.get(d);
      if (v !== undefined) {
        sum += v.toNumber();
        any = true;
      }
    }
    if (any) out.push(sum);
  }
  let live = 0;
  let anyLive = false;
  for (const r of inNW)
    if (r.live !== undefined) {
      live += r.live.toNumber();
      anyLive = true;
    }
  if (anyLive) out.push(live);
  return out;
}

/** totale di un gruppo (righe inNetWorth) a una certa data/live. */
function groupTotalAt(rows: PatrimonioRow[], when: IsoDate | "live"): number {
  let sum = 0;
  for (const r of rows) {
    if (!r.account.inNetWorth) continue;
    const v = valueAt(r, when);
    if (v !== undefined) sum += v.toNumber();
  }
  return sum;
}

function pct(from: number, to: number): number | undefined {
  if (from === 0) return undefined;
  return (to - from) / Math.abs(from);
}

const pctFmt = new Intl.NumberFormat("it-IT", {
  style: "percent",
  maximumFractionDigits: 1,
  signDisplay: "exceptZero",
});
const eurSigned = new Intl.NumberFormat("it-IT", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
  signDisplay: "exceptZero",
});

function deltaClass(v: number): string {
  return v > 0 ? "text-emerald-400" : v < 0 ? "text-red-400" : "text-zinc-500";
}

function Sparkline({ values }: { values: number[] }) {
  if (values.length < 2) return <span className="text-xs text-zinc-600">—</span>;
  const W = 80;
  const H = 22;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const x = (i: number) => (i / (values.length - 1)) * W;
  const y = (v: number) => H - 2 - ((v - min) / span) * (H - 4);
  const d = values
    .map((v, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(v).toFixed(1)}`)
    .join(" ");
  const rising = values[values.length - 1]! >= values[0]!;
  return (
    <svg width={W} height={H} className="inline-block align-middle">
      <path d={d} fill="none" stroke={rising ? "#34d399" : "#f87171"} strokeWidth={1.5} />
    </svg>
  );
}

function DateSelect({
  value,
  onChange,
  dates,
  label,
}: {
  value: IsoDate | "live";
  onChange: (v: IsoDate | "live") => void;
  dates: IsoDate[];
  label?: string;
}) {
  return (
    <label className="flex items-center gap-1.5 text-sm">
      {label && <span className="text-zinc-400">{label}</span>}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as IsoDate | "live")}
        className="rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-sm"
      >
        <option value="live">Live</option>
        {[...dates].reverse().map((d) => (
          <option key={d} value={d}>
            {d}
          </option>
        ))}
      </select>
    </label>
  );
}

const COLORS = [
  "#34d399",
  "#38bdf8",
  "#818cf8",
  "#fbbf24",
  "#f472b6",
  "#a3e635",
  "#fb923c",
  "#22d3ee",
];

function PatrimonioMisto({
  st,
  booked,
  prices,
  asOf,
  assets,
  commodities,
}: {
  st: PatrimonioStatement;
  booked: ReturnType<typeof useDerived>["booked"];
  prices: PriceTable;
  asOf: IsoDate;
  assets: AssetRow[];
  commodities: Map<string, CommodityInfo>;
}) {
  const s = useApp();
  const [when, setWhen] = useState<IsoDate | "live">("live");
  const [baseline, setBaseline] = useState<IsoDate | "prev">("prev");
  const [groupBy, setGroupBy] = useState<GroupBy>("globale");
  const [range, setRange] = useState<ChartRange>("max");
  // modalità del grafico per gruppo e per singolo conto (default: valore/prezzo)
  const [groupChartMode, setGroupChartMode] = useState<Map<string, ChartMode>>(new Map());
  const [assetChartMode, setAssetChartMode] = useState<Map<string, "prezzo" | "investito">>(
    new Map(),
  );
  const [breakdownBy, setBreakdownBy] = useState<GroupBy>("assetclass");
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  // transazioni per le serie di rendimento/investito (grafici asset)
  const transactions = useMemo(
    () => allDirectives(s).filter((d): d is TransactionDirective => d.kind === "transaction"),
    [s],
  );
  const [expanded, setExpanded] = useState<string>();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [comparing, setComparing] = useState(false);
  const [editing, setEditing] = useState<
    { kind: "edit"; conto: PatrimonioAccount } | { kind: "new" }
  >();
  // null = chiuso; "new" = nuovo snapshot; IsoDate = modifica in blocco di
  // uno snapshot già inserito (la data selezionata nel selettore "al").
  const [snapEdit, setSnapEdit] = useState<IsoDate | "new" | null>(null);

  // AssetRow per commodity, ricalcolati alla posizione selezionata (`when`):
  // in live = quelli già derivati; a una data passata ri-book le sole
  // transazioni ≤ when e ri-derivo as-of quella data (prezzi campionati).
  const assetAt = useMemo(() => {
    const rows =
      when === "live"
        ? assets
        : deriveAssets({
            positions: book(
              allDirectives(s).filter((d) => d.kind !== "transaction" || d.date <= when),
            ).positions,
            commodities,
            prices,
            asOf: when,
          });
    return new Map(rows.map((a) => [holdingKey(a.deposito, a.commodity), a]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [when, s.version]);

  // AssetRow di un conto ledger-backed: match esatto per (deposito, commodity);
  // se il conto non ha ancora un deposito assegnato, ripiega sulla commodity.
  const assetFor = (account: PatrimonioAccount): AssetRow | undefined => {
    if (!account.commodity) return undefined;
    if (account.deposito) return assetAt.get(holdingKey(account.deposito, account.commodity));
    for (const a of assetAt.values()) if (a.commodity === account.commodity) return a;
    return undefined;
  };

  // una posizione è "chiusa/storica" se il conto è fuori net worth, oppure se
  // è uno strumento con zero unità alla data selezionata.
  const isClosed = (r: PatrimonioRow): boolean =>
    !r.account.inNetWorth ||
    r.account.uscitaIl !== undefined ||
    (!!r.account.commodity && (assetFor(r.account)?.units.isZero() ?? false));

  // chiave di gruppo che, in modalità tracciamento, isola le posizioni chiuse.
  const bucketKey = (r: PatrimonioRow): string =>
    groupBy === "tracciamento" && isClosed(r) ? "Chiuse / Storico" : groupKeyOf(r.account, groupBy);

  const toggleSelected = (commodity: string) =>
    setSelected((cur) => {
      const n = new Set(cur);
      n.has(commodity) ? n.delete(commodity) : n.add(commodity);
      return n;
    });

  // per ogni gruppo: serie storica del valore, rendimento (MWRR/TWRR) e
  // allocazione per classe. Ricalcolati al variare del raggruppamento; il
  // grafico viene poi troncato alla data scelta in fase di render.
  const groupExtras = useMemo(() => {
    const directives = allDirectives(s);
    // per gruppo: conti membri + peso (1, o quota dello split in asset class)
    const byKey = new Map<
      string,
      { accounts: PatrimonioAccount[]; weights: Map<string, number> }
    >();
    const add = (key: string, a: PatrimonioAccount, weight: number) => {
      let e = byKey.get(key);
      if (!e) {
        e = { accounts: [], weights: new Map() };
        byKey.set(key, e);
      }
      e.accounts.push(a);
      e.weights.set(a.id, weight);
    };
    for (const r of st.rows) {
      if (groupBy === "assetclass")
        for (const c of classContributions(r.account)) add(c.classe, r.account, c.weight);
      else add(bucketKey(r), r.account, 1);
    }
    const out = new Map<string, { stats?: GroupStats; series: TimelinePoint[] }>();
    for (const [k, { accounts, weights }] of byKey) {
      const input = {
        accounts,
        snapshots: s.snapshots,
        directives,
        prices,
        asOf,
        weights,
      };
      // MWRR/TWRR solo sui conti a membership piena (peso 1): i compositi
      // distribuiti non hanno un rendimento per-classe ben definito.
      const holdings = accounts
        .filter((a) => (weights.get(a.id) ?? 1) === 1 && a.commodity)
        .map((a) => ({ commodity: a.commodity!, deposito: a.deposito }));
      out.set(k, {
        stats: deriveGroupStats(holdings, booked.positions, directives, prices, asOf),
        series: deriveValueSeries(input).global,
      });
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [st, groupBy, assetAt]);

  // data di riferimento per le variazioni: "precedente" = lo snapshot subito
  // prima della vista; altrimenti una data fissa scelta.
  const prev: IsoDate | undefined =
    baseline === "prev"
      ? when === "live"
        ? st.dates[st.dates.length - 1]
        : st.dates[st.dates.indexOf(when) - 1]
      : baseline;

  const groups = useMemo(() => {
    const map = new Map<string, PatrimonioRow[]>();
    const push = (key: string, row: PatrimonioRow) => map.set(key, [...(map.get(key) ?? []), row]);
    for (const r of st.rows) {
      if (groupBy === "assetclass")
        for (const c of classContributions(r.account)) push(c.classe, scaleRow(r, c.weight));
      else push(bucketKey(r), r);
    }
    const arr = [...map.entries()].map(([key, rows]) => {
      const total = rows.reduce(
        (a, r) => (r.account.inNetWorth ? a.add(valueAt(r, when) ?? new Decimal(0)) : a),
        new Decimal(0),
      );
      return { key, rows, total };
    });
    arr.sort((a, b) => b.total.comparedTo(a.total));
    return arr;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [st, when, groupBy, assetAt]);

  const positiveTotal = groups.reduce(
    (a, g) => (g.total.gt(0) ? a.add(g.total) : a),
    new Decimal(0),
  );
  const portfolios = [...new Set(s.goals.map((g) => g.portfolio))].sort();

  // stima del bollo titoli per conto titoli (valore × aliquota alla data scelta)
  const bollo = deriveBolloTitoli({ rows: st.rows, depositi: s.config.depositi, when });

  // dimensioni di suddivisione del gruppo: tutte tranne globale (banale) e
  // quella principale già selezionata.
  const breakdownDims = (["assetclass", "tracciamento", "owner", "portfolio"] as GroupBy[]).filter(
    (d) => d !== groupBy,
  );
  const breakdownDim = breakdownDims.includes(breakdownBy) ? breakdownBy : breakdownDims[0]!;

  const allCollapsed = groups.length > 0 && groups.every((g) => collapsed.has(g.key));

  return (
    <div className="space-y-4">
      <div className="sticky top-[52px] z-20 -mx-6 space-y-3 border-b border-zinc-800/60 bg-zinc-950/95 px-6 py-2 backdrop-blur">
        <div className="flex flex-wrap items-center gap-3">
          <DateSelect value={when} onChange={setWhen} dates={st.dates} label="al" />
          <label className="flex items-center gap-1.5 text-sm">
            <span className="text-zinc-400">Δ vs</span>
            <select
              value={baseline}
              onChange={(e) => setBaseline(e.target.value as IsoDate | "prev")}
              className="rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-sm"
            >
              <option value="prev">precedente{prev ? ` (${prev})` : ""}</option>
              {[...st.dates].reverse().map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-1.5 text-sm">
            <span className="text-zinc-400">vista</span>
            <select
              value={groupBy}
              onChange={(e) => setGroupBy(e.target.value as GroupBy)}
              className="rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-sm"
            >
              <option value="globale">globale</option>
              <option value="assetclass">per asset class</option>
              <option value="tracciamento">per tracciamento</option>
              <option value="owner">per owner</option>
              <option value="portfolio">per portfolio</option>
            </select>
          </label>
          <div className="flex items-center gap-1.5 text-sm">
            <span className="text-zinc-400">grafico</span>
            <div className="flex overflow-hidden rounded border border-zinc-700">
              {CHART_RANGES.map((r) => (
                <button
                  key={r.key}
                  onClick={() => setRange(r.key)}
                  className={`px-2 py-1 text-xs tabular-nums ${
                    range === r.key
                      ? "bg-zinc-700 text-zinc-100"
                      : "bg-zinc-900 text-zinc-400 hover:bg-zinc-800"
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>
          {selected.size > 0 && (
            <div className="flex items-center gap-1">
              <button
                onClick={() => setComparing(true)}
                disabled={selected.size < 2}
                className="rounded bg-emerald-700 px-2.5 py-1 text-xs hover:bg-emerald-600 disabled:opacity-50"
              >
                Confronta ({selected.size})
              </button>
              <button
                onClick={() => setSelected(new Set())}
                title="Svuota selezione"
                className="rounded px-1.5 py-1 text-xs text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300"
              >
                ✕
              </button>
            </div>
          )}
          <span className="ml-auto text-sm tabular-nums text-zinc-400">
            {when === "live" ? "net worth" : `al ${when}`}{" "}
            {fmtEur(when === "live" ? st.liveTotal : st.totals.get(when))}
          </span>
        </div>

        <div className="flex h-6 w-full overflow-hidden rounded">
          {groups
            .filter((g) => g.total.gt(0))
            .map((g, i) => {
              const w = positiveTotal.gt(0) ? g.total.div(positiveTotal).toNumber() * 100 : 0;
              return (
                <div
                  key={g.key}
                  style={{ width: `${w}%`, background: COLORS[i % COLORS.length] }}
                  title={`${g.key}: ${fmtEur(g.total)}`}
                />
              );
            })}
        </div>

        <div className="flex items-center justify-between">
          <div className="flex gap-2">
            <button
              onClick={() => setEditing({ kind: "new" })}
              className="flex items-center gap-1.5 rounded bg-zinc-800 px-3 py-1.5 text-xs font-medium text-zinc-200 hover:bg-zinc-700"
            >
              <Plus size={14} /> Nuovo conto
            </button>
            <button
              onClick={() => setSnapEdit("new")}
              className="flex items-center gap-1.5 rounded bg-emerald-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-600"
            >
              <Plus size={14} /> Nuovo snapshot
            </button>
            {when !== "live" && (
              <button
                onClick={() => setSnapEdit(when)}
                title={`Modifica in blocco lo snapshot del ${when}`}
                className="flex items-center gap-1.5 rounded bg-zinc-800 px-3 py-1.5 text-xs font-medium text-zinc-200 hover:bg-zinc-700"
              >
                <Pencil size={14} /> Modifica snapshot
              </button>
            )}
          </div>
          <button
            onClick={() =>
              setCollapsed(allCollapsed ? new Set() : new Set(groups.map((g) => g.key)))
            }
            title={allCollapsed ? "Espandi tutto" : "Comprimi tutto"}
            className="rounded p-1 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300"
          >
            {allCollapsed ? <ChevronsUpDown size={16} /> : <ChevronsDownUp size={16} />}
          </button>
        </div>
      </div>

      <div className="space-y-2">
        {groups.map((g, i) => {
          const isCollapsed = collapsed.has(g.key);
          const share = positiveTotal.gt(0) ? g.total.div(positiveTotal).toNumber() : 0;
          const prevTot = prev ? groupTotalAt(g.rows, prev) : undefined;
          const dEur = prevTot !== undefined ? g.total.toNumber() - prevTot : undefined;
          const dPct = prevTot !== undefined ? pct(prevTot, g.total.toNumber()) : undefined;
          const extras = groupExtras.get(g.key);
          const gStats = extras?.stats;
          // punti del grafico Valore: taglio a destra su `when`, a sinistra su `range`
          const chartPoints = windowByRange(extras?.series ?? [], when, range);
          // modalità grafico + serie rendimento/investito (solo sugli asset del gruppo)
          const chartMode = groupChartMode.get(g.key) ?? "valore";
          const assetHoldings = g.rows
            .filter((r) => r.account.commodity)
            .map((r) => ({ commodity: r.account.commodity!, deposito: r.account.deposito }));
          const hasAssets = assetHoldings.length > 0;
          const returns =
            !isCollapsed && hasAssets && chartMode !== "valore"
              ? deriveReturns(assetHoldings, transactions, prices, asOf)
              : undefined;
          const retPoints = returns
            ? (() => {
                const w = windowByRange(returns.index, when, range);
                if (w.length < 2) return [];
                const base = w[0]!.index;
                return w.map((p) => ({ date: p.date, value: p.index / base - 1 }));
              })()
            : [];
          const invPoints = returns ? windowByRange(returns.invested, when, range) : [];
          return (
            <section key={g.key} className="rounded border border-zinc-800">
              <button
                onClick={() => {
                  const n = new Set(collapsed);
                  n.has(g.key) ? n.delete(g.key) : n.add(g.key);
                  setCollapsed(n);
                }}
                className="flex w-full items-center gap-3 px-3 py-2 text-sm hover:bg-zinc-900"
              >
                <span
                  className="h-3 w-3 shrink-0 rounded-sm"
                  style={{ background: COLORS[i % COLORS.length] }}
                />
                <span className="font-medium">
                  {isCollapsed ? "▸" : "▾"} {g.key}
                </span>
                <span className="ml-auto">
                  <Sparkline values={groupSeries(g.rows, st.dates)} />
                </span>
                <span className="w-28 text-right font-medium tabular-nums">{fmtEur(g.total)}</span>
                <span className="w-24 text-right text-xs tabular-nums">
                  {dEur !== undefined && Math.round(dEur) !== 0 ? (
                    <span className={deltaClass(dEur)}>
                      {eurSigned.format(dEur)}
                      {dPct !== undefined && (
                        <span className="ml-1 opacity-70">{pctFmt.format(dPct)}</span>
                      )}
                    </span>
                  ) : (
                    ""
                  )}
                </span>
                <span
                  className="w-32 text-right text-xs tabular-nums text-zinc-500"
                  title="Rendimento degli strumenti del gruppo · MWRR (money-weighted) / TWRR (time-weighted)"
                >
                  {gStats ? (
                    <>
                      M{" "}
                      <span className="text-zinc-300">
                        {gStats.mwrr !== undefined ? fmtPct(gStats.mwrr) : "—"}
                      </span>{" "}
                      · T{" "}
                      <span className="text-zinc-300">
                        {gStats.twrr !== undefined ? fmtPct(gStats.twrr) : "—"}
                      </span>
                    </>
                  ) : (
                    ""
                  )}
                </span>
                <span className="w-10 text-right text-xs tabular-nums text-zinc-500">
                  {g.total.gt(0) ? `${Math.round(share * 100)}%` : ""}
                </span>
              </button>

              {!isCollapsed && (
                <>
                  {(chartPoints.length >= 2 || hasAssets) && (
                    <div className="border-t border-zinc-800/60 px-6 py-3">
                      {hasAssets && (
                        <div className="mb-2 flex justify-end">
                          <ChartModeToggle
                            mode={chartMode}
                            onChange={(m) =>
                              setGroupChartMode((prev) => new Map(prev).set(g.key, m))
                            }
                          />
                        </div>
                      )}
                      {chartMode === "valore" &&
                        (chartPoints.length >= 2 ? (
                          <LineChart points={chartPoints} />
                        ) : (
                          <EmptyChartNote>nessuno storico di valore</EmptyChartNote>
                        ))}
                      {chartMode === "rendimento" &&
                        (retPoints.length >= 2 ? (
                          <LineChart points={retPoints} format="pct" />
                        ) : (
                          <EmptyChartNote>storico insufficiente per il rendimento</EmptyChartNote>
                        ))}
                      {chartMode === "investito" &&
                        (invPoints.length >= 2 ? (
                          <InvestedValueChart points={invPoints} />
                        ) : (
                          <EmptyChartNote>storico insufficiente</EmptyChartNote>
                        ))}
                    </div>
                  )}
                  <table className="w-full text-sm">
                    <tbody>
                      {g.rows
                        .slice()
                        .sort(
                          (a, b) =>
                            (valueAt(b, when)?.toNumber() ?? 0) -
                            (valueAt(a, when)?.toNumber() ?? 0),
                        )
                        .map((r) => {
                          const v = valueAt(r, when);
                          const pv = prev ? r.values.get(prev) : undefined;
                          const dEur =
                            v !== undefined && pv !== undefined
                              ? v.toNumber() - pv.toNumber()
                              : undefined;
                          const dPct =
                            v !== undefined && pv !== undefined
                              ? pct(pv.toNumber(), v.toNumber())
                              : undefined;
                          const isOpen = expanded === r.account.id;
                          const asset = assetFor(r.account);
                          // conti manuali con `carico`: rendimento a due numeri
                          const manualRet = asset
                            ? undefined
                            : deriveManualReturn(r.account, s.snapshots, asOf);
                          return (
                            <Fragment key={r.account.id}>
                              <tr
                                onClick={() => setExpanded(isOpen ? undefined : r.account.id)}
                                className={`group cursor-pointer border-t border-zinc-800/60 hover:bg-zinc-900 [&>td]:px-3 [&>td]:py-1.5 ${r.account.inNetWorth ? "" : "opacity-50"}`}
                              >
                                <td className="pl-6">
                                  <span className="inline-flex items-center gap-2">
                                    {asset ? (
                                      <span>
                                        <span className="font-medium">{r.account.nome}</span>
                                        <span className="ml-2 text-xs text-zinc-500">
                                          {asset.name}
                                        </span>
                                      </span>
                                    ) : (
                                      <span>
                                        {r.account.nome}
                                        <span className="ml-2 text-xs text-zinc-600">
                                          {groupBy === "owner"
                                            ? (r.account.portfolio ?? "")
                                            : r.account.owner}
                                        </span>
                                      </span>
                                    )}
                                    {asset &&
                                      (() => {
                                        const hk = holdingKey(asset.deposito, asset.commodity);
                                        const inCompare = selected.has(hk);
                                        return (
                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              toggleSelected(hk);
                                            }}
                                            title="Confronto"
                                            className={`rounded px-1.5 py-0.5 text-xs transition-opacity ${
                                              inCompare
                                                ? "bg-emerald-700 text-white hover:bg-emerald-600"
                                                : "bg-zinc-800 text-zinc-300 opacity-0 hover:bg-zinc-700 focus:opacity-100 group-hover:opacity-100"
                                            }`}
                                          >
                                            {inCompare ? "Nel compare ✓" : "Aggiungi al compare"}
                                          </button>
                                        );
                                      })()}
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setEditing({ kind: "edit", conto: r.account });
                                      }}
                                      title="Modifica conto"
                                      className="rounded px-1 text-zinc-500 opacity-0 transition-opacity hover:bg-zinc-800 hover:text-zinc-300 focus:opacity-100 group-hover:opacity-100"
                                    >
                                      ✎
                                    </button>
                                  </span>
                                </td>
                                <td className="text-right tabular-nums">{fmtEur(v)}</td>
                                <td className="w-24 text-right text-xs tabular-nums">
                                  {dEur !== undefined && dEur !== 0 ? (
                                    <span className={deltaClass(dEur)}>
                                      {eurSigned.format(dEur)}
                                      {dPct !== undefined && (
                                        <span className="ml-1 opacity-70">
                                          {pctFmt.format(dPct)}
                                        </span>
                                      )}
                                    </span>
                                  ) : (
                                    <span className="text-zinc-600">—</span>
                                  )}
                                </td>
                                <td className="w-24 text-right">
                                  <Sparkline values={rowSeries(r, st.dates)} />
                                </td>
                              </tr>
                              {isOpen && (
                                <tr className="bg-zinc-950">
                                  <td colSpan={4} className="px-8 py-3">
                                    {(() => {
                                      const acct = r.account;
                                      // strumento: toggle Prezzo (%) / Investito vs Valore
                                      if (acct.commodity) {
                                        const mode = assetChartMode.get(acct.id) ?? "prezzo";
                                        const priceSeries = (prices.get(acct.commodity) ?? []).map(
                                          (pp) => ({ date: pp.date, value: pp.price.toNumber() }),
                                        );
                                        const pw = windowByRange(priceSeries, when, range);
                                        const pricePts =
                                          pw.length >= 2
                                            ? pw.map((p) => ({
                                                date: p.date,
                                                value: p.value / pw[0]!.value - 1,
                                              }))
                                            : [];
                                        const ret =
                                          mode === "investito"
                                            ? deriveReturns(
                                                [
                                                  {
                                                    commodity: acct.commodity,
                                                    deposito: acct.deposito,
                                                  },
                                                ],
                                                transactions,
                                                prices,
                                                asOf,
                                              )
                                            : undefined;
                                        const invPts = ret
                                          ? windowByRange(ret.invested, when, range)
                                          : [];
                                        return (
                                          <div className="mb-3 border-b border-zinc-800/60 pb-3">
                                            <div className="mb-2 flex justify-end">
                                              <AssetChartToggle
                                                mode={mode}
                                                onChange={(m) =>
                                                  setAssetChartMode((prev) =>
                                                    new Map(prev).set(acct.id, m),
                                                  )
                                                }
                                              />
                                            </div>
                                            {mode === "prezzo" &&
                                              (pricePts.length >= 2 ? (
                                                <LineChart points={pricePts} format="pct" />
                                              ) : (
                                                <EmptyChartNote>
                                                  storico prezzi insufficiente
                                                </EmptyChartNote>
                                              ))}
                                            {mode === "investito" &&
                                              (invPts.length >= 2 ? (
                                                <InvestedValueChart points={invPts} />
                                              ) : (
                                                <EmptyChartNote>
                                                  storico insufficiente
                                                </EmptyChartNote>
                                              ))}
                                          </div>
                                        );
                                      }
                                      // conto manuale: serie di valore (come prima)
                                      const full = deriveValueSeries({
                                        // forza inNetWorth: la serie del singolo conto va
                                        // mostrata anche per i conti esclusi dal net worth
                                        accounts: [{ ...acct, inNetWorth: true }],
                                        snapshots: s.snapshots,
                                        directives: allDirectives(s),
                                        prices,
                                        asOf,
                                      }).global;
                                      const points = windowByRange(full, when, range);
                                      return points.length >= 2 ? (
                                        <div className="mb-3 border-b border-zinc-800/60 pb-3">
                                          <LineChart points={points} />
                                        </div>
                                      ) : null;
                                    })()}
                                    {asset && (
                                      <div className="mb-3">
                                        {asset.units.isZero() ? (
                                          <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 text-sm">
                                            <span className="text-xs text-amber-500/80">
                                              Posizione chiusa
                                            </span>
                                            <SummaryMetric
                                              label="Realizzato"
                                              value={fmtEur(asset.totalNetGain)}
                                              className={gainColor(asset.totalNetGain)}
                                              title="P&L realizzato di ciclo vita: prezzo + cedole/dividendi + commissioni + ritenute"
                                            />
                                            <SummaryMetric
                                              label="Resa totale"
                                              value={fmtPct(asset.yieldNetPct)}
                                              title="gain totale netto / cash investito"
                                            />
                                            <SummaryMetric
                                              label="MWRR ciclo vita"
                                              value={
                                                asset.xirrAnnual !== undefined
                                                  ? fmtPct(asset.xirrAnnual)
                                                  : "—"
                                              }
                                              title="money-weighted annualizzato sull'intera storia dei flussi (acquisti→vendite)"
                                            />
                                            <SummaryMetric
                                              label="TWRR periodo"
                                              value={
                                                asset.twrr
                                                  ? fmtPct(
                                                      asset.twrr.annualized ??
                                                        asset.twrr.cumulative,
                                                    )
                                                  : "—"
                                              }
                                              title="time-weighted sulla finestra di detenzione"
                                            />
                                            {asset.firstFlowDate && asset.lastFlowDate && (
                                              <span
                                                className="text-xs text-zinc-500"
                                                title={`${asset.firstFlowDate} → ${asset.lastFlowDate}`}
                                              >
                                                {holdingLabel(
                                                  asset.firstFlowDate,
                                                  asset.lastFlowDate,
                                                )}{" "}
                                                · {asset.firstFlowDate} → {asset.lastFlowDate}
                                              </span>
                                            )}
                                          </div>
                                        ) : (
                                          <>
                                            <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 text-sm">
                                              <SummaryMetric
                                                label="Quantità"
                                                value={fmtNum(asset.units)}
                                              />
                                              {!asset.fees.isZero() && (
                                                <SummaryMetric
                                                  label="Commissioni"
                                                  value={fmtEur(asset.fees)}
                                                />
                                              )}
                                              <SummaryMetric
                                                label="Carico"
                                                value={fmtEur(asset.costBasis)}
                                                title={
                                                  asset.costBasis.equals(asset.buyCost.abs())
                                                    ? "cash investito"
                                                    : `costo dei lotti residui dopo le vendite · cash investito totale ${fmtEur(asset.buyCost.abs())}`
                                                }
                                              />
                                              <SummaryMetric
                                                label="Valore l/n"
                                                value={`${fmtEur(asset.value)} / ${fmtEur(asset.netValue)}`}
                                                title="valore lordo / al netto della tassa CG se vendessi"
                                              />
                                              <SummaryMetric
                                                label="Gain l/n"
                                                value={`${fmtEur(asset.unrealizedGain)} / ${fmtEur(asset.totalNetGain)}`}
                                                className={gainColor(asset.totalNetGain)}
                                                title="gain di prezzo lordo / gain totale netto (cedole, commissioni, ritenute, realizzato, tassa)"
                                              />
                                              <SummaryMetric
                                                label="Yield l/n"
                                                value={`${fmtPct(asset.yieldPct)} / ${fmtPct(asset.yieldNetPct)}`}
                                                title="gain prezzo / carico · gain totale netto / cash investito"
                                              />
                                              <SummaryMetric
                                                label="MWRR"
                                                value={
                                                  asset.xirrAnnual !== undefined
                                                    ? fmtPct(asset.xirrAnnual)
                                                    : "—"
                                                }
                                              />
                                              <SummaryMetric
                                                label="TWRR"
                                                value={
                                                  asset.twrr
                                                    ? fmtPct(
                                                        asset.twrr.annualized ??
                                                          asset.twrr.cumulative,
                                                      )
                                                    : "—"
                                                }
                                              />
                                              {asset.firstFlowDate && (
                                                <span
                                                  className="text-xs text-zinc-500"
                                                  title={`dal ${asset.firstFlowDate}`}
                                                >
                                                  {holdingLabel(
                                                    asset.firstFlowDate,
                                                    when === "live" ? undefined : when,
                                                  )}
                                                </span>
                                              )}
                                            </div>
                                            {asset.bond && (
                                              <div className="mt-1 flex flex-wrap items-baseline gap-x-4 gap-y-1 text-sm">
                                                <SummaryMetric
                                                  label="Cedole rimanenti"
                                                  value={`${asset.bond.remainingCoupons} (${fmtEur(asset.bond.remainingCouponValue)})`}
                                                />
                                                <SummaryMetric
                                                  label="Netto a maturazione"
                                                  value={fmtEur(asset.bond.netValueAtMaturity)}
                                                />
                                                <SummaryMetric
                                                  label="Vendi ora vs scadenza"
                                                  value={fmtEur(asset.bond.sellNowVsMaturity)}
                                                  className={gainColor(
                                                    asset.bond.sellNowVsMaturity,
                                                  )}
                                                />
                                              </div>
                                            )}
                                          </>
                                        )}
                                        <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
                                          <span className="flex items-center gap-2">
                                            <span className="text-zinc-600">Descrizione:</span>
                                            <NameEditor asset={asset} />
                                          </span>
                                          {!asset.units.isZero() && <TaxEditInline asset={asset} />}
                                        </div>
                                      </div>
                                    )}
                                    {manualRet && (
                                      <div className="mb-3 flex flex-wrap items-baseline gap-x-4 gap-y-1 text-sm">
                                        {manualRet.closed && (
                                          <span className="text-xs text-amber-500/80">
                                            Posizione chiusa
                                          </span>
                                        )}
                                        <SummaryMetric
                                          label="Carico"
                                          value={fmtEur(manualRet.carico)}
                                        />
                                        {manualRet.closed ? (
                                          <SummaryMetric
                                            label="Ricavato l/n"
                                            value={`${fmtEur(manualRet.valoreLordo)} / ${fmtEur(manualRet.valoreNetto)}`}
                                          />
                                        ) : (
                                          <SummaryMetric
                                            label="Valore"
                                            value={fmtEur(manualRet.valoreLordo)}
                                          />
                                        )}
                                        <SummaryMetric
                                          label={manualRet.closed ? "P&L l/n" : "P&L"}
                                          value={
                                            manualRet.closed
                                              ? `${fmtEur(manualRet.plLordo)} / ${fmtEur(manualRet.plNetto)}`
                                              : fmtEur(manualRet.plNetto)
                                          }
                                          className={
                                            manualRet.plNetto < 0
                                              ? "text-red-400"
                                              : "text-emerald-400"
                                          }
                                        />
                                        <SummaryMetric
                                          label={manualRet.closed ? "Resa l/n" : "Resa"}
                                          value={
                                            manualRet.closed
                                              ? `${fmtPct(manualRet.resaLorda)} / ${fmtPct(manualRet.resaNetta)}`
                                              : fmtPct(manualRet.resaLorda)
                                          }
                                        />
                                        {manualRet.cagrLordo !== undefined && (
                                          <SummaryMetric
                                            label="CAGR l/n"
                                            value={
                                              manualRet.closed
                                                ? `${fmtPct(manualRet.cagrLordo)} / ${fmtPct(manualRet.cagrNetto ?? manualRet.cagrLordo)}`
                                                : fmtPct(manualRet.cagrLordo)
                                            }
                                            title="annualizzato — stima lump-sum (assume il carico entrato a inizio periodo)"
                                          />
                                        )}
                                        <span
                                          className="text-xs text-zinc-500"
                                          title={`${manualRet.from} → ${manualRet.to}`}
                                        >
                                          {holdingLabel(manualRet.from, manualRet.to)} ·{" "}
                                          {manualRet.from} → {manualRet.to}
                                        </span>
                                      </div>
                                    )}
                                    <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-xs text-zinc-400">
                                      {asset ? (
                                        st.dates.map((d) => (
                                          <span key={d} className="tabular-nums">
                                            <span className="text-zinc-600">{d}</span>{" "}
                                            {fmtEur(r.values.get(d))}
                                          </span>
                                        ))
                                      ) : (
                                        <ManualSnapshotEditor
                                          account={r.account}
                                          snapshots={s.snapshots}
                                        />
                                      )}
                                      <span className="tabular-nums">
                                        <span className="text-zinc-600">Live</span> {fmtEur(r.live)}
                                      </span>
                                      {r.account.split && groupBy !== "assetclass" && (
                                        <span className="text-zinc-500">
                                          split:{" "}
                                          {r.account.split
                                            .map(
                                              (sp) => `${Math.round(sp.peso * 100)}% ${sp.classe}`,
                                            )
                                            .join(" / ")}
                                        </span>
                                      )}
                                    </div>
                                  </td>
                                </tr>
                              )}
                            </Fragment>
                          );
                        })}
                    </tbody>
                  </table>
                  {(() => {
                    const breakdown = breakdownOf(g.rows, breakdownDim, when);
                    if (breakdown.size === 0) return null;
                    return (
                      <div className="border-t border-zinc-800/60 px-6 py-3">
                        <div className="mb-2 flex items-center gap-2 text-xs font-medium text-zinc-500">
                          <span>Suddivisione per</span>
                          <div className="flex gap-1">
                            {breakdownDims.map((d) => (
                              <button
                                key={d}
                                onClick={() => setBreakdownBy(d)}
                                className={`rounded px-1.5 py-0.5 text-xs ${breakdownDim === d ? "bg-zinc-200 text-zinc-900" : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"}`}
                              >
                                {GROUP_LABELS[d]}
                              </button>
                            ))}
                          </div>
                        </div>
                        <AllocationBars allocation={breakdown} />
                      </div>
                    );
                  })()}
                </>
              )}
            </section>
          );
        })}
      </div>

      {bollo.righe.length > 0 && (
        <section className="rounded border border-zinc-800">
          <div className="flex items-center gap-3 px-3 py-2 text-sm">
            <span className="font-medium">Bollo titoli stimato</span>
            <span
              className="text-xs text-zinc-500"
              title="Stima prospettica: valore dei titoli × aliquota annua per conto titoli. Distinta dal bollo storico già pagato (Expenses:Taxes:Bollo). Gestisci i conti titoli nella tab Movimenti."
            >
              {when === "live" ? "su valore live" : `al ${when}`} · annuo · conti titoli in
              Movimenti
            </span>
            <span className="ml-auto font-medium tabular-nums">{fmtEur(bollo.totale)}</span>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-t border-zinc-800/60 text-xs text-zinc-500 [&>th]:px-3 [&>th]:py-1.5">
                <th className="text-left font-medium">Conto titoli</th>
                <th className="text-right font-medium">Valore</th>
                <th className="text-right font-medium">Aliquota</th>
                <th className="text-right font-medium">Addebito</th>
                <th className="text-right font-medium">Bollo/anno</th>
              </tr>
            </thead>
            <tbody>
              {bollo.righe.map((r) => (
                <tr key={r.id} className="border-t border-zinc-800/60 [&>td]:px-3 [&>td]:py-1.5">
                  <td>
                    {r.nome}
                    {r.owner && <span className="ml-2 text-xs text-zinc-600">{r.owner}</span>}
                  </td>
                  <td className="text-right tabular-nums">{fmtEur(r.valore)}</td>
                  <td className="text-right tabular-nums text-zinc-400">
                    {(r.aliquota * 100).toFixed(2).replace(".", ",")}%
                  </td>
                  <td className="text-right text-xs tabular-nums text-zinc-400">
                    {r.periodi > 1 ? `${fmtEur(r.bolloPeriodo)} × ${r.periodi}` : "annuale"}
                  </td>
                  <td className="text-right tabular-nums">{fmtEur(r.bollo)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {editing && (
        <Modal onClose={() => setEditing(undefined)}>
          <ContoForm
            conto={editing.kind === "edit" ? editing.conto : undefined}
            portfolios={portfolios}
            onClose={() => setEditing(undefined)}
          />
        </Modal>
      )}

      {snapEdit && (
        <Modal onClose={() => setSnapEdit(null)}>
          <SnapshotForm
            accounts={s.accounts.filter((a) => !a.commodity)}
            snapshots={s.snapshots}
            onClose={() => setSnapEdit(null)}
            initialDate={snapEdit === "new" ? undefined : snapEdit}
          />
        </Modal>
      )}

      {comparing && (
        <Modal onClose={() => setComparing(false)}>
          <ComparePanel
            items={[...selected].map((c) => assetAt.get(c)).filter((a): a is AssetRow => !!a)}
            when={when}
          />
        </Modal>
      )}
    </div>
  );
}

function SummaryMetric({
  label,
  value,
  className,
  title,
}: {
  label: string;
  value: string;
  className?: string;
  title?: string;
}) {
  return (
    <span className="tabular-nums" {...(title ? { title } : {})}>
      <span className="text-xs text-zinc-500">{label} </span>
      <span className={className}>{value}</span>
    </span>
  );
}

const COMPARE_METRICS: {
  label: string;
  get: (a: AssetRow, asOf?: string) => string;
  color?: (a: AssetRow) => string;
}[] = [
  { label: "Classe", get: (a) => a.assetClass },
  { label: "Valore", get: (a) => fmtEur(a.value) },
  {
    label: "Gain prezzo",
    get: (a) => fmtEur(a.unrealizedGain),
    color: (a) => gainColor(a.unrealizedGain),
  },
  { label: "Yield prezzo", get: (a) => fmtPct(a.yieldPct) },
  {
    label: "Gain totale netto",
    get: (a) => fmtEur(a.totalNetGain),
    color: (a) => gainColor(a.totalNetGain),
  },
  { label: "MWRR", get: (a) => (a.xirrAnnual !== undefined ? fmtPct(a.xirrAnnual) : "—") },
  {
    label: "TWRR",
    get: (a) => (a.twrr ? fmtPct(a.twrr.annualized ?? a.twrr.cumulative) : "—"),
  },
  {
    label: "Detenzione",
    get: (a, asOf) => (a.firstFlowDate ? holdingLabel(a.firstFlowDate, asOf) : "—"),
  },
];

function ComparePanel({ items, when }: { items: AssetRow[]; when: IsoDate | "live" }) {
  const s = useApp();
  // commodity → nome del conto (etichetta visualizzata, come nelle altre viste)
  const nomeByCommodity = new Map(
    s.accounts.filter((a) => a.commodity).map((a) => [a.commodity!, a.nome]),
  );

  return (
    <div className="w-full rounded border border-zinc-700 bg-zinc-900 p-4">
      <div className="mb-3 flex items-baseline gap-2">
        <h2 className="text-lg font-semibold">Confronto strumenti</h2>
        <span className="text-xs text-zinc-500">{when === "live" ? "Live" : `al ${when}`}</span>
      </div>
      {items.length < 2 ? (
        <p className="text-sm text-zinc-500">Seleziona almeno due strumenti.</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-700 text-zinc-400">
              <th className="py-1.5 text-left font-medium">Metrica</th>
              {items.map((a) => (
                <th key={a.commodity} className="px-2 py-1.5 text-right font-medium">
                  <div>{nomeByCommodity.get(a.commodity) ?? a.commodity}</div>
                  <div className="max-w-32 truncate text-xs font-normal text-zinc-600">
                    {a.name}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {COMPARE_METRICS.map((m) => (
              <tr key={m.label} className="border-b border-zinc-800/60">
                <td className="py-1.5 text-xs text-zinc-500">{m.label}</td>
                {items.map((a) => (
                  <td
                    key={a.commodity}
                    className={`px-2 py-1.5 text-right tabular-nums ${m.color?.(a) ?? ""}`}
                  >
                    {m.get(a, when === "live" ? undefined : when)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

export function PatrimonioView() {
  const { patrimonio, booked, prices, asOf, assets, commodities } = useDerived();
  return (
    <PatrimonioMisto
      st={patrimonio}
      booked={booked}
      prices={prices}
      asOf={asOf}
      assets={assets}
      commodities={commodities}
    />
  );
}
