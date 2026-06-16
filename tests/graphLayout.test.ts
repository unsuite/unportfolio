import { describe, expect, it } from "vitest";
import { hasCycle } from "../src/core/derive/goalStatus";
import { autoLayout, layoutBounds, NODE_W } from "../src/core/derive/graphLayout";

describe("autoLayout (verticale, piramide)", () => {
  it("sorgenti in basso, il flusso sale: y decresce con la profondità", () => {
    // A → B → D, C → D (confluenza)
    const nodes = ["A", "B", "C", "D"];
    const edges = [
      { da: "A", verso: "B" },
      { da: "B", verso: "D" },
      { da: "C", verso: "D" },
    ];
    const pos = autoLayout(nodes, edges);
    const yOf = (n: string) => pos.get(n)!.y;
    // A e C sono sorgenti (profondità 0) → stessa riga, in basso
    expect(yOf("A")).toBe(yOf("C"));
    // B sale sopra A
    expect(yOf("B")).toBeLessThan(yOf("A"));
    // D (cammino più lungo A→B→D = 2) è il più in alto
    expect(yOf("D")).toBeLessThan(yOf("B"));
    // due sorgenti sulla stessa riga hanno x diverse
    expect(pos.get("A")!.x).not.toBe(pos.get("C")!.x);
  });

  it("nodi isolati: stessa riga (base), x diverse", () => {
    const pos = autoLayout(["X", "Y", "Z"], []);
    expect(pos.get("X")!.y).toBe(pos.get("Y")!.y);
    expect(pos.get("X")!.x).not.toBe(pos.get("Y")!.x);
  });

  it("ogni livello è centrato (forma a piramide)", () => {
    // base larga A,B,C → cima singola D (tutti confluiscono)
    const pos = autoLayout(
      ["A", "B", "C", "D"],
      [
        { da: "A", verso: "D" },
        { da: "B", verso: "D" },
        { da: "C", verso: "D" },
      ],
    );
    const baseCenter = (pos.get("A")!.x + pos.get("C")!.x) / 2 + NODE_W / 2;
    const topCenter = pos.get("D")!.x + NODE_W / 2;
    expect(topCenter).toBeCloseTo(baseCenter, 5);
  });

  it("non va in loop infinito su un ciclo", () => {
    const pos = autoLayout(
      ["A", "B"],
      [
        { da: "A", verso: "B" },
        { da: "B", verso: "A" },
      ],
    );
    expect(pos.size).toBe(2);
  });

  it("layoutBounds copre tutti i nodi", () => {
    const pos = autoLayout(["A", "B"], [{ da: "A", verso: "B" }]);
    const b = layoutBounds(pos.values());
    const maxX = Math.max(...[...pos.values()].map((p) => p.x));
    expect(b.width).toBeGreaterThanOrEqual(maxX + NODE_W);
  });
});

describe("hasCycle", () => {
  const nodes = ["A", "B", "C"];
  it("falso su DAG", () => {
    expect(
      hasCycle(nodes, [
        { da: "A", verso: "B" },
        { da: "B", verso: "C" },
        { da: "A", verso: "C" },
      ]),
    ).toBe(false);
  });
  it("vero su ciclo", () => {
    expect(
      hasCycle(nodes, [
        { da: "A", verso: "B" },
        { da: "B", verso: "C" },
        { da: "C", verso: "A" },
      ]),
    ).toBe(true);
  });
  it("vero su self-loop", () => {
    expect(hasCycle(nodes, [{ da: "A", verso: "A" }])).toBe(true);
  });
});
