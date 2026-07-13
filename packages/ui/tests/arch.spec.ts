import { resolve } from "node:path";
import { assertLayerBoundaries } from "@unportfolio/test-utils";
import { describe, it } from "vitest";

/**
 * Rete CI gemella della regola Biome `noRestrictedImports` (ADR-0002, ADR-0006):
 * il catalogo presentazionale in packages/ui deve restare puro. Riceve i dati via
 * props e non importa il dominio (`@unportfolio/core`), lo store, il router o il
 * filesystem (tutto sotto `apps/web/src/app/**`). Cattura anche gli import dinamici
 * che una regex inline si perde.
 */
describe("packages/ui — confini di layer", () => {
  it("il catalogo resta presentazionale (niente core, store, router, fs)", async () => {
    await assertLayerBoundaries({
      pattern: resolve(__dirname, "../src/**/*.{ts,tsx}"),
      layer: "ui",
      forbidden: [
        /^@unportfolio\/core/,
        /^@unportfolio\/web/,
        /\/app(\/|$)/,
        /^@tanstack\//,
        /^react-router/,
      ],
      ignore: ["**/*.stories.tsx"],
    });
  });
});
