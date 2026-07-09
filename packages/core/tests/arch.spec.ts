import { resolve } from "node:path";
import { assertLayerBoundaries } from "@unportfolio/test-utils";
import { describe, it } from "vitest";

/**
 * Rete CI gemella della regola Biome `noRestrictedImports` (ADR-0002): il dominio
 * puro in packages/core non deve dipendere da apps/web né da React/DOM. Cattura
 * anche gli import dinamici (`import(...)`) che una regex inline si perde.
 */
describe("packages/core — confini di layer", () => {
  it("il dominio resta puro (niente apps/web, React, DOM)", async () => {
    await assertLayerBoundaries({
      pattern: resolve(__dirname, "../src/**/*.ts"),
      layer: "core",
      forbidden: [/^@unportfolio\/web/, /\/app(\/|$)/, /^react/, /^react-dom/],
    });
  });
});
