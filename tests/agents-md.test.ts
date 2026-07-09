import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * AGENTS.md è "gestito" e vive in tre copie che devono restare allineate:
 * src/app/fs/fileSystem.ts (AGENTS_MD), public/init.sh e public/init.ps1.
 * Se divergono, un agente che apre la cartella legge documentazione stantia
 * (è già successo col meccanismo fisso/escluso). Questo test le tiene in pari.
 */

const HEADING = "## Ribilanciamento (targets.toml)";

/** Estrae la sezione del ribilanciamento fino all'heading successivo,
 *  normalizzando i backtick escapati del template literal TS (\\` → `). */
function section(file: string): string {
  const text = readFileSync(resolve(__dirname, "..", file), "utf8").replaceAll("\\`", "`");
  const start = text.indexOf(HEADING);
  if (start === -1) throw new Error(`sezione mancante in ${file}`);
  const rest = text.slice(start);
  const next = rest.indexOf("\n## ", 1);
  return (next === -1 ? rest : rest.slice(0, next)).trim();
}

describe("AGENTS.md — sezione Ribilanciamento allineata", () => {
  const sources = ["src/app/fs/fileSystem.ts", "public/init.sh", "public/init.ps1"];

  it("presente in tutte e tre le copie", () => {
    for (const f of sources) expect(section(f), f).toContain("fisso = true");
  });

  it("documenta la semantica corretta di fisso/escluso", () => {
    const ref = section(sources[0]!);
    expect(ref).toContain("non si compra **né si vende**");
    expect(ref).toContain("fuori da tutta la matematica");
    expect(ref).toContain("mutuamente esclusivi");
  });

  it("identica nei tre file (niente drift)", () => {
    const [ts, sh, ps1] = sources.map(section);
    expect(sh).toBe(ts);
    expect(ps1).toBe(ts);
  });
});
