import type { PortfolioStatus } from "@unportfolio/core/derive/goalStatus";
import { hasCycle, linearChain, singleOutgoing } from "@unportfolio/core/derive/goalStatus";
import {
  autoLayout,
  layoutBounds,
  NODE_H,
  NODE_W,
  type Pos,
} from "@unportfolio/core/derive/graphLayout";
import type { EsuberoFlusso } from "@unportfolio/core/model/config";
import { useEffect, useMemo, useRef, useState } from "react";
import { fmtEur, useApp } from "../store/selectors";
import { updateConfig } from "../store/store";

interface DragNode {
  kind: "node";
  portfolio: string;
  offsetX: number;
  offsetY: number;
  x: number;
  y: number;
}
interface DragLink {
  kind: "link";
  from: string;
  cursorX: number;
  cursorY: number;
}
type DragState = DragNode | DragLink | undefined;

export function EsuberoGraph({ statuses }: { statuses: PortfolioStatus[] }) {
  const s = useApp();
  const svgRef = useRef<SVGSVGElement>(null);
  const [drag, setDrag] = useState<DragState>();
  const [rejected, setRejected] = useState<string>();

  const nodes = useMemo(() => statuses.map((st) => st.portfolio), [statuses]);
  // un solo esubero in uscita per nodo (coerente col motore)
  const flussi = useMemo(() => singleOutgoing(s.config.esuberoFlussi), [s.config.esuberoFlussi]);

  // Posizioni stabili: si ricalcolano SOLO quando cambia l'insieme dei nodi
  // (nuovo/rimosso portfolio) o su "Riordina" — non a ogni arco aggiunto.
  // Seed = posizioni salvate ∪ auto-layout per i nodi senza posizione.
  const [basePos, setBasePos] = useState<Map<string, Pos>>(new Map());
  const nodeKey = nodes.slice().sort().join("|");
  useEffect(() => {
    const auto = autoLayout(nodes, s.config.esuberoFlussi);
    const saved = new Map(
      s.config.esuberoLayout
        .filter((p) => nodes.includes(p.portfolio))
        .map((p) => [p.portfolio, { x: p.x, y: p.y } as Pos]),
    );
    const merged = new Map<string, Pos>();
    for (const n of nodes) merged.set(n, saved.get(n) ?? auto.get(n) ?? { x: 0, y: 0 });
    setBasePos(merged);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodeKey]);

  // posizione effettiva (durante il drag di un nodo si usa quella locale)
  const posOf = (portfolio: string): Pos => {
    if (drag?.kind === "node" && drag.portfolio === portfolio) return { x: drag.x, y: drag.y };
    return basePos.get(portfolio) ?? { x: 0, y: 0 };
  };

  const statusOf = useMemo(() => new Map(statuses.map((st) => [st.portfolio, st])), [statuses]);

  const bounds = layoutBounds(nodes.map(posOf));
  const width = Math.max(bounds.width, 640);
  const height = Math.max(bounds.height, 280);

  function toSvg(e: { clientX: number; clientY: number }): Pos {
    const r = svgRef.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  function startNodeDrag(e: React.PointerEvent, portfolio: string) {
    e.stopPropagation();
    const p = toSvg(e);
    const np = posOf(portfolio);
    svgRef.current?.setPointerCapture(e.pointerId);
    setDrag({
      kind: "node",
      portfolio,
      offsetX: p.x - np.x,
      offsetY: p.y - np.y,
      x: np.x,
      y: np.y,
    });
  }

  function startLinkDrag(e: React.PointerEvent, from: string) {
    e.stopPropagation();
    const p = toSvg(e);
    svgRef.current?.setPointerCapture(e.pointerId);
    setDrag({ kind: "link", from, cursorX: p.x, cursorY: p.y });
  }

  function onMove(e: React.PointerEvent) {
    if (!drag) return;
    const p = toSvg(e);
    if (drag.kind === "node") setDrag({ ...drag, x: p.x - drag.offsetX, y: p.y - drag.offsetY });
    else setDrag({ ...drag, cursorX: p.x, cursorY: p.y });
  }

  function nodeAt(p: Pos): string | undefined {
    for (const n of nodes) {
      const np = posOf(n);
      if (p.x >= np.x && p.x <= np.x + NODE_W && p.y >= np.y && p.y <= np.y + NODE_H) return n;
    }
    return undefined;
  }

  async function onUp(e: React.PointerEvent) {
    if (!drag) return;
    const current = drag;
    setDrag(undefined);
    if (current.kind === "node") {
      // aggiorna subito la posizione locale (no salto in attesa del config)
      setBasePos((prev) => {
        const next = new Map(prev);
        next.set(current.portfolio, { x: current.x, y: current.y });
        return next;
      });
      // persisti
      const others = s.config.esuberoLayout.filter((p) => p.portfolio !== current.portfolio);
      await updateConfig({
        esuberoLayout: [...others, { portfolio: current.portfolio, x: current.x, y: current.y }],
      });
    } else {
      const target = nodeAt(toSvg(e));
      if (!target || target === current.from) return;
      // un nodo ha un solo esubero in uscita: l'eventuale arco esistente da
      // `from` viene sostituito (ridirezione), così l'esubero non si duplica.
      const next: EsuberoFlusso[] = [
        ...flussi.filter((f) => f.da !== current.from),
        { da: current.from, verso: target },
      ];
      if (hasCycle(nodes, next)) {
        setRejected(target);
        setTimeout(() => setRejected(undefined), 1200);
        return;
      }
      await updateConfig({ esuberoFlussi: next });
    }
  }

  async function removeEdge(da: string, verso: string) {
    await updateConfig({
      esuberoFlussi: flussi.filter((f) => !(f.da === da && f.verso === verso)),
    });
  }

  async function riordina() {
    const auto = autoLayout(nodes, flussi);
    setBasePos(new Map(nodes.map((n) => [n, auto.get(n) ?? { x: 0, y: 0 }])));
    await updateConfig({ esuberoLayout: [] });
  }

  async function seedDaPriorita() {
    const order = [
      ...s.config.priorita.filter((p) => nodes.includes(p)),
      ...nodes.filter((n) => !s.config.priorita.includes(n)).sort(),
    ];
    await updateConfig({ esuberoFlussi: linearChain(order), esuberoLayout: [] });
  }

  if (nodes.length === 0)
    return (
      <p className="text-sm text-zinc-500">
        Nessun portfolio: definisci dei goal per vedere il grafo.
      </p>
    );

  // flusso verticale: l'esubero esce dal lato superiore della sorgente ed
  // entra dal lato inferiore del target (sopra di essa).
  const topMid = (p: Pos) => ({ x: p.x + NODE_W / 2, y: p.y });
  const bottomMid = (p: Pos) => ({ x: p.x + NODE_W / 2, y: p.y + NODE_H });

  return (
    <div>
      <div className="mb-2 flex items-center gap-3">
        <button
          onClick={() => void riordina()}
          className="rounded bg-zinc-700 px-3 py-1 text-sm hover:bg-zinc-600"
        >
          Riordina
        </button>
        {flussi.length === 0 && s.config.priorita.length > 1 && (
          <button
            onClick={() => void seedDaPriorita()}
            className="rounded bg-zinc-700 px-3 py-1 text-sm hover:bg-zinc-600"
          >
            Catena da priorità
          </button>
        )}
        <span className="text-xs text-zinc-500">
          la liquidità è in basso, l'esubero sale verso gli obiettivi · trascina da ⚬ (in alto) al
          nodo soprastante per collegare (un solo esubero in uscita per nodo: ricollegando si
          sostituisce) · click su un arco per rimuoverlo · trascina un nodo per spostarlo
        </span>
      </div>
      <div className="max-h-[600px] overflow-auto rounded border border-zinc-800 bg-zinc-950">
        <svg
          ref={svgRef}
          width={width}
          height={height}
          className="touch-none select-none"
          onPointerMove={onMove}
          onPointerUp={(e) => void onUp(e)}
          onPointerLeave={() => drag?.kind === "link" && setDrag(undefined)}
        >
          <defs>
            <marker
              id="arrow"
              viewBox="0 0 10 10"
              refX="9"
              refY="5"
              markerWidth="7"
              markerHeight="7"
              orient="auto-start-reverse"
            >
              <path d="M0,0 L10,5 L0,10 z" fill="#52525b" />
            </marker>
          </defs>

          {/* archi ortogonali: su dalla sorgente, orizzontale nel corridoio
              appena sotto il target, su nel target — restano nei vuoti */}
          {flussi.map((f, i) => {
            if (!nodes.includes(f.da) || !nodes.includes(f.verso)) return null;
            const a = topMid(posOf(f.da)); // cima sorgente
            const b = bottomMid(posOf(f.verso)); // fondo target
            const chY = b.y + 28; // corridoio appena sotto il target
            const d = `M ${a.x},${a.y} V ${chY} H ${b.x} V ${b.y}`;
            const esubero = statusOf.get(f.da)?.esubero;
            return (
              <g key={i}>
                <path d={d} fill="none" stroke="#52525b" strokeWidth={2} markerEnd="url(#arrow)" />
                <path
                  d={d}
                  fill="none"
                  stroke="transparent"
                  strokeWidth={14}
                  className="cursor-pointer"
                  onClick={() => void removeEdge(f.da, f.verso)}
                />
                <g
                  className="pointer-events-none"
                  transform={`translate(${(a.x + b.x) / 2},${chY})`}
                >
                  <rect x={-32} y={-9} width={64} height={18} rx={4} fill="#18181b" />
                  <text textAnchor="middle" dy={4} className="fill-zinc-400" fontSize={10}>
                    {esubero ? fmtEur(esubero) : ""}
                  </text>
                </g>
              </g>
            );
          })}

          {/* link in costruzione */}
          {drag?.kind === "link" &&
            (() => {
              const a = topMid(posOf(drag.from));
              return (
                <line
                  x1={a.x}
                  y1={a.y}
                  x2={drag.cursorX}
                  y2={drag.cursorY}
                  stroke="#10b981"
                  strokeWidth={2}
                  strokeDasharray="4 3"
                />
              );
            })()}

          {/* nodi */}
          {nodes.map((n) => {
            const p = posOf(n);
            const st = statusOf.get(n);
            const esubero = st?.esubero;
            const negativo = esubero?.isNegative() ?? false;
            const compl = st ? Math.min(st.completionWithSurplus.toNumber(), 1) : 0;
            const isRejected = rejected === n;
            return (
              <g key={n} transform={`translate(${p.x},${p.y})`}>
                <foreignObject width={NODE_W} height={NODE_H}>
                  <div
                    onPointerDown={(e) => startNodeDrag(e, n)}
                    className={`flex h-full cursor-grab flex-col gap-1 rounded-lg border p-2.5 ${
                      isRejected ? "border-red-500 bg-red-950" : "border-zinc-600 bg-zinc-800"
                    }`}
                  >
                    <div
                      className="overflow-hidden text-xs leading-tight font-semibold text-zinc-100"
                      style={{
                        display: "-webkit-box",
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: "vertical",
                      }}
                      title={n}
                    >
                      {n}
                    </div>
                    <div
                      className={`mt-auto text-xs tabular-nums ${negativo ? "text-red-400" : "text-emerald-400"}`}
                    >
                      esubero {esubero ? fmtEur(esubero) : "—"}
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-700">
                      <div
                        className={`h-full rounded-full ${compl >= 1 ? "bg-emerald-500" : "bg-amber-500"}`}
                        style={{ width: `${compl * 100}%` }}
                      />
                    </div>
                  </div>
                </foreignObject>
                {/* handle output: in alto, da cui sale l'esubero */}
                <circle
                  cx={NODE_W / 2}
                  cy={0}
                  r={7}
                  className="cursor-crosshair"
                  fill="#10b981"
                  stroke="#18181b"
                  strokeWidth={2}
                  onPointerDown={(e) => startLinkDrag(e, n)}
                />
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}
