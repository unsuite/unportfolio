import type { EsuberoEdge } from "./goalStatus";

export interface Pos {
  x: number;
  y: number;
}

export const NODE_W = 210;
export const NODE_H = 84;
const COL_GAP = 240; // distanza orizzontale tra nodi dello stesso livello
const ROW_GAP = 150; // distanza verticale tra livelli (spazio per gli archi)
const PAD = 24;

/**
 * Layout ad albero/piramide verticale: l'esubero fluisce dal basso verso
 * l'alto. Le sorgenti (la liquidità, senza archi entranti) stanno in basso e
 * formano la base larga; salendo, i flussi convergono verso gli obiettivi
 * (i nodi terminali) in cima. La profondità è il cammino più lungo dalle
 * sorgenti; ogni livello è centrato orizzontalmente per dare la forma a
 * piramide. In presenza di ciclo i nodi coinvolti cadono in profondità 0
 * (degradazione benigna; l'editor comunque impedisce i cicli a monte).
 */
export function autoLayout(nodes: string[], edges: EsuberoEdge[]): Map<string, Pos> {
  const present = new Set(nodes);
  const incoming = new Map<string, string[]>(); // verso → [da] (rami sottostanti)
  const outgoing = new Map<string, string[]>(); // da → [verso]
  for (const e of edges) {
    if (!present.has(e.da) || !present.has(e.verso)) continue;
    incoming.set(e.verso, [...(incoming.get(e.verso) ?? []), e.da]);
    outgoing.set(e.da, [...(outgoing.get(e.da) ?? []), e.verso]);
  }

  // --- y: profondità = cammino più lungo dalle sorgenti (sorgenti in basso) ---
  const depthOf = new Map<string, number>();
  const vy = new Set<string>();
  const depth = (n: string): number => {
    const cached = depthOf.get(n);
    if (cached !== undefined) return cached;
    if (vy.has(n)) return 0; // ciclo: spezza
    vy.add(n);
    const preds = incoming.get(n) ?? [];
    const d = preds.length === 0 ? 0 : Math.max(...preds.map((p) => depth(p) + 1));
    vy.delete(n);
    depthOf.set(n, d);
    return d;
  };
  for (const n of nodes) depth(n);
  const maxDepth = Math.max(0, ...nodes.map((n) => depthOf.get(n) ?? 0));

  // --- x: layout ad albero — ogni ramo nella sua colonna, giunzione centrata
  // sopra i rami che vi confluiscono. Visita top-down dai sink (in cima) lungo
  // gli archi entranti; le foglie (sorgenti) prendono colonne consecutive, i
  // nodi interni si centrano sulla media delle colonne dei rami sotto di loro.
  const xOf = new Map<string, number>();
  const vx = new Set<string>();
  let slot = 0;
  const assignX = (n: string): number => {
    const cached = xOf.get(n);
    if (cached !== undefined) return cached;
    if (vx.has(n)) {
      const x = slot++ * COL_GAP; // ciclo: colonna nuova
      xOf.set(n, x);
      return x;
    }
    vx.add(n);
    const kids = incoming.get(n) ?? [];
    const x =
      kids.length === 0
        ? slot++ * COL_GAP
        : kids.map(assignX).reduce((a, b) => a + b, 0) / kids.length;
    xOf.set(n, x);
    return x;
  };
  // radici = sink (nessun arco uscente): da lì scende l'albero
  for (const n of nodes) if (!outgoing.get(n)?.length) assignX(n);
  for (const n of nodes) if (!xOf.has(n)) assignX(n); // eventuali disconnessi

  const pos = new Map<string, Pos>();
  for (const n of nodes) {
    const row = maxDepth - (depthOf.get(n) ?? 0); // sorgenti in basso
    pos.set(n, { x: PAD + (xOf.get(n) ?? 0), y: PAD + row * ROW_GAP });
  }
  return pos;
}

/** dimensione del canvas che contiene tutti i nodi (con margine). */
export function layoutBounds(positions: Iterable<Pos>): {
  width: number;
  height: number;
} {
  let maxX = 0;
  let maxY = 0;
  for (const p of positions) {
    maxX = Math.max(maxX, p.x + NODE_W);
    maxY = Math.max(maxY, p.y + NODE_H);
  }
  return { width: maxX + PAD, height: maxY + PAD };
}
