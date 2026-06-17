import { parse as parseToml, stringify as stringifyToml } from "smol-toml";
import {
  type AppConfig,
  DEFAULT_BOLLO_ALIQUOTA,
  type Deposito,
  type Goal,
  type PatrimonioAccount,
  type RebalanceTarget,
  type Sezione,
  type SnapshotEntry,
} from "../model/config";

/** Plain-text codecs for the non-ledger data files. Tolerant on read, canonical on write. */

function asString(v: unknown): string | undefined {
  if (typeof v === "string") return v;
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  // smol-toml local dates are objects with toString → ISO
  if (v != null && typeof v === "object" && "toString" in v) {
    const s = String(v);
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  }
  return undefined;
}

function asNumber(v: unknown): number | undefined {
  if (typeof v === "number") return v;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    if (!Number.isNaN(n)) return n;
  }
  return undefined;
}

// ---------- goals.toml ----------

export function parseGoals(text: string): Goal[] {
  const doc = parseToml(text) as { goal?: Record<string, unknown>[] };
  const out: Goal[] = [];
  for (const g of doc.goal ?? []) {
    const id = asString(g["id"]);
    if (!id) continue;
    const goal: Goal = {
      id,
      attivo: g["attivo"] !== false,
      tipo: asString(g["tipo"]) ?? "",
      owner: asString(g["owner"]) ?? "",
      portfolio: asString(g["portfolio"]) ?? "",
    };
    const descrizione = asString(g["descrizione"]);
    if (descrizione) goal.descrizione = descrizione;
    const target = asNumber(g["target"]);
    if (target !== undefined) goal.target = target;
    const costo = asNumber(g["costo_stimato"]);
    if (costo !== undefined) goal.costoStimato = costo;
    const prob = asNumber(g["probabilita"]);
    if (prob !== undefined) goal.probabilita = prob;
    const data = asString(g["data_target"]);
    if (data) goal.dataTarget = data;
    out.push(goal);
  }
  return out;
}

export function serializeGoals(goals: Goal[]): string {
  return (
    stringifyToml({
      goal: goals.map((g) => {
        const o: Record<string, unknown> = {
          id: g.id,
          attivo: g.attivo,
          tipo: g.tipo,
          owner: g.owner,
          portfolio: g.portfolio,
        };
        if (g.descrizione) o["descrizione"] = g.descrizione;
        if (g.target !== undefined) o["target"] = g.target;
        if (g.costoStimato !== undefined) o["costo_stimato"] = g.costoStimato;
        if (g.probabilita !== undefined) o["probabilita"] = g.probabilita;
        if (g.dataTarget) o["data_target"] = g.dataTarget;
        return o;
      }),
    }) + "\n"
  );
}

/** Effective target: explicit, or estimated cost × probability. */
export function goalTarget(g: Goal): number {
  if (g.target !== undefined) return g.target;
  if (g.costoStimato !== undefined) return g.costoStimato * (g.probabilita ?? 1);
  return 0;
}

// ---------- patrimonio.toml ----------

const SEZIONI: Sezione[] = ["debt", "credit", "cash", "asset"];

export function parseAccounts(text: string): PatrimonioAccount[] {
  const doc = parseToml(text) as { account?: Record<string, unknown>[] };
  const out: PatrimonioAccount[] = [];
  for (const a of doc.account ?? []) {
    const id = asString(a["id"]);
    if (!id) continue;
    const sezione = asString(a["sezione"]) as Sezione | undefined;
    const acc: PatrimonioAccount = {
      id,
      nome: asString(a["nome"]) ?? id,
      sezione: sezione && SEZIONI.includes(sezione) ? sezione : "cash",
      tipo: asString(a["tipo"]) ?? "Liquidity",
      owner: asString(a["owner"]) ?? "",
      inNetWorth: a["in_net_worth"] !== false,
      valuta: asString(a["valuta"]) ?? "EUR",
    };
    const portfolio = asString(a["portfolio"]);
    if (portfolio) acc.portfolio = portfolio;
    const deposito = asString(a["deposito"]);
    if (deposito) acc.deposito = deposito;
    const commodity = asString(a["commodity"]);
    if (commodity) acc.commodity = commodity;
    if (Array.isArray(a["split"])) {
      const split = (a["split"] as Record<string, unknown>[])
        .map((s) => ({
          classe: asString(s["classe"]) ?? "",
          peso: asNumber(s["peso"]) ?? 0,
        }))
        .filter((s) => s.classe && s.peso > 0);
      if (split.length > 0) acc.split = split;
    }
    const carico = asNumber(a["carico"]);
    if (carico !== undefined) acc.carico = carico;
    const caricoDal = asString(a["carico_dal"]);
    if (caricoDal) acc.caricoDal = caricoDal;
    const uscitaLordo = asNumber(a["uscita_lordo"]);
    if (uscitaLordo !== undefined) acc.uscitaLordo = uscitaLordo;
    const uscitaNetto = asNumber(a["uscita_netto"]);
    if (uscitaNetto !== undefined) acc.uscitaNetto = uscitaNetto;
    const uscitaIl = asString(a["uscita_il"]);
    if (uscitaIl) acc.uscitaIl = uscitaIl;
    out.push(acc);
  }
  return out;
}

export function serializeAccounts(accounts: PatrimonioAccount[]): string {
  return (
    stringifyToml({
      account: accounts.map((a) => {
        const o: Record<string, unknown> = {
          id: a.id,
          nome: a.nome,
          sezione: a.sezione,
          tipo: a.tipo,
          owner: a.owner,
          in_net_worth: a.inNetWorth,
          valuta: a.valuta,
        };
        if (a.portfolio) o["portfolio"] = a.portfolio;
        if (a.deposito) o["deposito"] = a.deposito;
        if (a.commodity) o["commodity"] = a.commodity;
        if (a.split && a.split.length > 0)
          o["split"] = a.split.map((s) => ({ classe: s.classe, peso: s.peso }));
        if (a.carico !== undefined) o["carico"] = a.carico;
        if (a.caricoDal) o["carico_dal"] = a.caricoDal;
        if (a.uscitaLordo !== undefined) o["uscita_lordo"] = a.uscitaLordo;
        if (a.uscitaNetto !== undefined) o["uscita_netto"] = a.uscitaNetto;
        if (a.uscitaIl) o["uscita_il"] = a.uscitaIl;
        return o;
      }),
    }) + "\n"
  );
}

/** id leggibile e stabile per una nuova riga di patrimonio.toml */
export function accountSlug(nome: string, owner: string): string {
  return `${nome}-${owner}`
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// ---------- targets.toml ----------

export function parseTargets(text: string): RebalanceTarget[] {
  const doc = parseToml(text) as { target?: Record<string, unknown>[] };
  const out: RebalanceTarget[] = [];
  for (const t of doc.target ?? []) {
    const portfolio = asString(t["portfolio"]);
    const commodity = asString(t["commodity"]);
    const peso = asNumber(t["peso"]);
    if (portfolio && commodity && peso !== undefined && peso > 0)
      out.push({ portfolio, commodity, peso });
  }
  return out;
}

export function serializeTargets(targets: RebalanceTarget[]): string {
  return (
    stringifyToml({
      target: targets.map((t) => ({
        portfolio: t.portfolio,
        commodity: t.commodity,
        peso: t.peso,
      })),
    }) + "\n"
  );
}

// ---------- snapshots.csv ----------

export function parseSnapshots(text: string): SnapshotEntry[] {
  const out: SnapshotEntry[] = [];
  for (const line of text.split("\n")) {
    const t = line.trim();
    if (t === "" || t.startsWith("#") || t.toLowerCase().startsWith("date,")) continue;
    const [date, accountId, value, currency] = t.split(",").map((s) => s.trim());
    if (!date || !accountId || value === undefined) continue;
    const n = Number(value);
    if (Number.isNaN(n)) continue;
    out.push({ date, accountId, value: n, currency: currency || "EUR" });
  }
  return out;
}

export function serializeSnapshots(entries: SnapshotEntry[]): string {
  const lines = ["date,account_id,value,currency"];
  const sorted = entries
    .slice()
    .sort((a, b) =>
      a.date === b.date ? a.accountId.localeCompare(b.accountId) : a.date.localeCompare(b.date),
    );
  for (const e of sorted) lines.push(`${e.date},${e.accountId},${e.value},${e.currency}`);
  return lines.join("\n") + "\n";
}

// ---------- config.toml ----------

export function parseConfig(text: string): AppConfig {
  const doc = parseToml(text) as Record<string, unknown>;
  const prezzi = (doc["prezzi"] ?? {}) as Record<string, unknown>;
  const cfg: AppConfig = {
    operatingCurrency: asString(doc["operating_currency"]) ?? "EUR",
    priorita: Array.isArray(doc["priorita"]) ? doc["priorita"].map((p) => String(p)) : [],
    defaultBroker: asString(doc["default_broker"]) ?? "Directa",
    depositi: Array.isArray(doc["deposito"])
      ? (doc["deposito"] as Record<string, unknown>[])
          .map((d) => {
            const id = asString(d["id"]);
            const dep: Deposito = {
              id: id ?? "",
              nome: asString(d["nome"]) ?? id ?? "",
              owner: asString(d["owner"]) ?? "",
              broker: asString(d["broker"]) ?? "",
              aliquota: asNumber(d["aliquota"]) ?? DEFAULT_BOLLO_ALIQUOTA,
            };
            return dep;
          })
          .filter((d) => d.id)
      : [],
    esuberoFlussi: Array.isArray(doc["esubero"])
      ? (doc["esubero"] as Record<string, unknown>[])
          .map((e) => ({
            da: asString(e["da"]) ?? "",
            verso: asString(e["verso"]) ?? "",
          }))
          .filter((e) => e.da && e.verso)
      : [],
    esuberoLayout: Array.isArray(doc["esubero_pos"])
      ? (doc["esubero_pos"] as Record<string, unknown>[])
          .map((p) => ({
            portfolio: asString(p["portfolio"]) ?? "",
            x: asNumber(p["x"]) ?? 0,
            y: asNumber(p["y"]) ?? 0,
          }))
          .filter((p) => p.portfolio)
      : [],
    storicoAnni: asNumber(prezzi["anni"]) ?? 2,
    storicoIntervallo: asString(prezzi["intervallo"]) ?? "1wk",
    pensioni: [],
    pensionePortafogli: Array.isArray(doc["pensione_portafogli"])
      ? doc["pensione_portafogli"].map((p) => String(p))
      : [],
  };
  const percorso = asString(doc["percorso_dati"]);
  if (percorso) cfg.percorsoDati = percorso;
  // [[pensione]] (array) o, per retro-compatibilità, [pensione] (tabella singola)
  const rawPens = doc["pensione"];
  const pensRows = Array.isArray(rawPens)
    ? (rawPens as Record<string, unknown>[])
    : rawPens
      ? [rawPens as Record<string, unknown>]
      : [];
  cfg.pensioni = pensRows
    .map((p, i) => ({
      nome: asString(p["nome"]) ?? `Persona ${i + 1}`,
      dataNascita: asString(p["data_nascita"]) ?? "",
      etaPensionamento: asNumber(p["eta_pensionamento"]) ?? 67,
      etaDecesso: asNumber(p["eta_decesso"]) ?? 100,
      speseAnnuali: asNumber(p["spese_annuali"]) ?? 0,
      rendimentoPre: asNumber(p["rendimento_pre"]) ?? 0,
      rendimentoPost: asNumber(p["rendimento_post"]) ?? 0,
      portafogli: Array.isArray(p["portafogli"]) ? p["portafogli"].map((x) => String(x)) : [],
    }))
    .filter((p) => p.dataNascita !== "");
  return cfg;
}

export function serializeConfig(cfg: AppConfig): string {
  const o: Record<string, unknown> = {
    operating_currency: cfg.operatingCurrency,
    default_broker: cfg.defaultBroker,
    priorita: cfg.priorita,
  };
  // chiavi scalari/array-inline prima delle tabelle (smol-toml emette in ordine
  // di inserimento: una chiave top-level dopo una tabella finirebbe dentro)
  if (cfg.pensionePortafogli.length > 0) o["pensione_portafogli"] = cfg.pensionePortafogli;
  if (cfg.percorsoDati) o["percorso_dati"] = cfg.percorsoDati;
  // le tabelle per ultime: smol-toml emette le chiavi in ordine di inserimento
  // e una chiave top-level dopo una tabella finirebbe dentro di essa
  if (cfg.esuberoFlussi.length > 0)
    o["esubero"] = cfg.esuberoFlussi.map((e) => ({ da: e.da, verso: e.verso }));
  if (cfg.esuberoLayout.length > 0)
    o["esubero_pos"] = cfg.esuberoLayout.map((p) => ({
      portfolio: p.portfolio,
      x: Math.round(p.x),
      y: Math.round(p.y),
    }));
  if (cfg.depositi.length > 0) {
    o["deposito"] = cfg.depositi.map((d) => ({
      id: d.id,
      nome: d.nome,
      owner: d.owner,
      broker: d.broker,
      aliquota: d.aliquota,
    }));
  }
  o["prezzi"] = { anni: cfg.storicoAnni, intervallo: cfg.storicoIntervallo };
  if (cfg.pensioni.length > 0) {
    o["pensione"] = cfg.pensioni.map((p) => {
      const row: Record<string, unknown> = {
        nome: p.nome,
        data_nascita: p.dataNascita,
        eta_pensionamento: p.etaPensionamento,
        eta_decesso: p.etaDecesso,
        spese_annuali: p.speseAnnuali,
        rendimento_pre: p.rendimentoPre,
        rendimento_post: p.rendimentoPost,
      };
      if (p.portafogli.length > 0) row["portafogli"] = p.portafogli;
      return row;
    });
  }
  return stringifyToml(o) + "\n";
}
