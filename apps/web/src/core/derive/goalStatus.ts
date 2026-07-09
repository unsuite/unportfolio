import { Decimal } from "decimal.js";
import { goalTarget } from "../config/codecs";
import type { Goal } from "../model/config";

/**
 * Goal Status with the "esubero a cascata": portfolios are evaluated in
 * priority order; each portfolio's surplus (current − target, can be negative)
 * carries over and is added to the next portfolio's effective amount —
 * exactly the spreadsheet's chain (E17 = E15 + E7 + E12, etc.).
 */

export interface PortfolioStatus {
  portfolio: string;
  goals: Goal[];
  target: Decimal;
  current: Decimal;
  /** min(current/target, 1) — without carried surplus */
  completion: Decimal;
  /** current + carried surplus from higher-priority portfolios */
  withSurplus: Decimal;
  /** min(withSurplus/target, 1) */
  completionWithSurplus: Decimal;
  /** withSurplus − target, carried to the next portfolio */
  esubero: Decimal;
  /** dove confluisce l'esubero (modalità grafo); vuoto = nodo terminale */
  verso: string[];
}

const ZERO = new Decimal(0);
const ONE = new Decimal(1);

export interface EsuberoEdge {
  da: string;
  verso: string;
}

export interface GoalStatusInput {
  goals: Goal[];
  /** portfolio → current value (from patrimonio) */
  currents: Map<string, Decimal>;
  /** waterfall order; portfolios not listed are appended alphabetically */
  priorita: string[];
  /** grafo esplicito: se presente e aciclico, prevale sulla lista lineare */
  flussi?: EsuberoEdge[];
}

/** ordina i nodi topologicamente (Kahn); undefined se c'è un ciclo */
function topoSort(nodes: string[], edges: EsuberoEdge[]): string[] | undefined {
  const present = new Set(nodes);
  const indegree = new Map(nodes.map((n) => [n, 0]));
  const outgoing = new Map<string, string[]>();
  for (const e of edges) {
    if (!present.has(e.da) || !present.has(e.verso)) continue;
    indegree.set(e.verso, (indegree.get(e.verso) ?? 0) + 1);
    let list = outgoing.get(e.da);
    if (!list) {
      list = [];
      outgoing.set(e.da, list);
    }
    list.push(e.verso);
  }
  const queue = nodes.filter((n) => indegree.get(n) === 0).sort();
  const out: string[] = [];
  while (queue.length > 0) {
    const n = queue.shift()!;
    out.push(n);
    for (const next of outgoing.get(n) ?? []) {
      const d = indegree.get(next)! - 1;
      indegree.set(next, d);
      if (d === 0) queue.push(next);
    }
  }
  return out.length === nodes.length ? out : undefined;
}

/** true se gli archi formano un ciclo tra i nodi dati (riusa topoSort). */
export function hasCycle(nodes: string[], edges: EsuberoEdge[]): boolean {
  return topoSort(nodes, edges) === undefined;
}

/**
 * Un nodo ha un solo esubero in uscita: tiene il primo arco per ogni `da`,
 * scartando eventuali uscite multiple (eviterebbero il doppio conteggio
 * dell'esubero). L'editor lo impone già; questa è una difesa per i config
 * modificati a mano.
 */
export function singleOutgoing(edges: EsuberoEdge[]): EsuberoEdge[] {
  const seen = new Set<string>();
  const out: EsuberoEdge[] = [];
  for (const e of edges) {
    if (seen.has(e.da)) continue;
    seen.add(e.da);
    out.push(e);
  }
  return out;
}

export function deriveGoalStatus(input: GoalStatusInput): PortfolioStatus[] {
  const active = input.goals.filter((g) => g.attivo);
  const byPortfolio = new Map<string, Goal[]>();
  for (const g of active) {
    let list = byPortfolio.get(g.portfolio);
    if (!list) {
      list = [];
      byPortfolio.set(g.portfolio, list);
    }
    list.push(g);
  }
  const nodes = [...byPortfolio.keys()];

  // --- modalità grafo: archi espliciti, confluenze multiple in entrata,
  // un solo esubero in uscita per nodo ---
  const edges = singleOutgoing(
    (input.flussi ?? []).filter((e) => byPortfolio.has(e.da) && byPortfolio.has(e.verso)),
  );
  if (edges.length > 0) {
    const order = topoSort(nodes, edges);
    if (order) {
      const versoOf = new Map<string, string[]>();
      const incoming = new Map<string, string[]>();
      for (const e of edges) {
        versoOf.set(e.da, [...(versoOf.get(e.da) ?? []), e.verso]);
        incoming.set(e.verso, [...(incoming.get(e.verso) ?? []), e.da]);
      }
      const esuberoOf = new Map<string, Decimal>();
      const out: PortfolioStatus[] = [];
      for (const portfolio of order) {
        const goals = byPortfolio.get(portfolio)!;
        const target = goals.reduce((s, g) => s.add(goalTarget(g)), ZERO);
        const current = input.currents.get(portfolio) ?? ZERO;
        // carry = somma degli esuberi dei nodi che confluiscono qui
        let carry = ZERO;
        for (const from of incoming.get(portfolio) ?? [])
          carry = carry.add(esuberoOf.get(from) ?? ZERO);
        const withSurplus = current.add(carry);
        const esubero = withSurplus.minus(target);
        // l'esubero esce solo se il nodo ha archi in uscita
        esuberoOf.set(portfolio, (versoOf.get(portfolio)?.length ?? 0) > 0 ? esubero : ZERO);
        out.push({
          portfolio,
          goals,
          target,
          current,
          completion: target.gt(0) ? Decimal.min(current.div(target), ONE) : ONE,
          withSurplus,
          completionWithSurplus: target.gt(0) ? Decimal.min(withSurplus.div(target), ONE) : ONE,
          esubero,
          verso: versoOf.get(portfolio) ?? [],
        });
      }
      return out;
    }
    // ciclo nel grafo: si ricade nella modalità piatta sotto
  }

  // --- nessun grafo (o ciclo): nodi terminali, nessuna propagazione ---
  // Il grafo è l'unica fonte di verità: senza archi ogni portfolio sta in
  // piedi da solo (esubero = corrente − target). `priorita` determina solo
  // l'ordine di visualizzazione, non la cascata.
  const ordered: string[] = [];
  for (const p of input.priorita) if (byPortfolio.has(p)) ordered.push(p);
  for (const p of [...nodes].sort()) if (!ordered.includes(p)) ordered.push(p);

  return ordered.map((portfolio) => {
    const goals = byPortfolio.get(portfolio)!;
    const target = goals.reduce((s, g) => s.add(goalTarget(g)), ZERO);
    const current = input.currents.get(portfolio) ?? ZERO;
    const completion = target.gt(0) ? Decimal.min(current.div(target), ONE) : ONE;
    return {
      portfolio,
      goals,
      target,
      current,
      completion,
      withSurplus: current,
      completionWithSurplus: completion,
      esubero: current.minus(target),
      verso: [],
    };
  });
}

/** Catena lineare di archi da una lista ordinata (per il seed dalla priorità). */
export function linearChain(order: string[]): EsuberoEdge[] {
  const out: EsuberoEdge[] = [];
  for (let i = 0; i + 1 < order.length; i++) out.push({ da: order[i]!, verso: order[i + 1]! });
  return out;
}
