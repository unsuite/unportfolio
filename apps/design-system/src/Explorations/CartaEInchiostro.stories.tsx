import type { Meta, StoryObj } from "@storybook/react-vite";

/**
 * Esplorazione di design (prototipo throwaway, non usa i token). Direzione B —
 * "Carta e inchiostro": chiaro, calmo, da estratto conto ben composto. Display
 * grotesk + inchiostro teal per evitare il cliché cream+serif+terracotta.
 */

const palette = {
  bg: "#FAFAF7",
  surface: "#FFFFFF",
  border: "#E4E4DE",
  text: "#1B1F23",
  muted1: "#5A6169",
  muted2: "#8A9098",
  teal: "#0F766E",
  positive: "#12805C",
  negative: "#C2413B",
};

const display = '"Founders Grotesk", "Inter", system-ui, sans-serif';
const mono = '"GT America Mono", ui-monospace, "SF Mono", Menlo, monospace';

function Sparkline({ color }: { color: string }) {
  const pts = [8, 10, 9, 13, 12, 16, 15, 19, 22, 21, 26];
  const w = 220;
  const h = 44;
  const max = Math.max(...pts);
  const min = Math.min(...pts);
  const d = pts
    .map((v, i) => {
      const x = (i / (pts.length - 1)) * w;
      const y = h - ((v - min) / (max - min)) * h;
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ");
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden="true">
      <path d={d} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" />
    </svg>
  );
}

function Swatch({ name, hex }: { name: string; hex: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 92 }}>
      <div
        style={{
          height: 48,
          borderRadius: 8,
          background: hex,
          border: "1px solid rgba(0,0,0,0.08)",
        }}
      />
      <div style={{ fontFamily: mono, fontSize: 11, color: palette.muted1 }}>{name}</div>
      <div style={{ fontFamily: mono, fontSize: 11, color: palette.muted2 }}>{hex}</div>
    </div>
  );
}

function Overview() {
  return (
    <div
      style={{
        background: palette.bg,
        color: palette.text,
        fontFamily: display,
        padding: 40,
        minHeight: "100vh",
      }}
    >
      <div style={{ maxWidth: 880, margin: "0 auto", display: "grid", gap: 40 }}>
        <header>
          <div
            style={{
              fontFamily: mono,
              fontSize: 12,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              color: palette.teal,
            }}
          >
            Direzione B
          </div>
          <h1
            style={{ fontSize: 34, fontWeight: 600, margin: "8px 0 4px", letterSpacing: "-0.01em" }}
          >
            Carta e inchiostro
          </h1>
          <p style={{ color: palette.muted1, fontSize: 15, margin: 0 }}>
            Un estratto conto ben composto: chiaro, arioso, con un solo inchiostro teal a fare da
            guida.
          </p>
        </header>

        {/* Elemento firma: il ledger header */}
        <section
          style={{
            background: palette.surface,
            border: `1px solid ${palette.border}`,
            borderRadius: 16,
            padding: 28,
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "space-between",
            gap: 24,
            flexWrap: "wrap",
            boxShadow: "0 1px 2px rgba(16,24,32,0.04)",
          }}
        >
          <div>
            <div
              style={{
                fontFamily: mono,
                fontSize: 12,
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                color: palette.muted1,
              }}
            >
              Patrimonio netto
            </div>
            <div
              style={{
                fontFamily: display,
                fontSize: 52,
                fontWeight: 600,
                letterSpacing: "-0.02em",
                fontVariantNumeric: "tabular-nums",
                margin: "6px 0",
              }}
            >
              € 248.320<span style={{ color: palette.muted2 }}>,50</span>
            </div>
            <div style={{ height: 2, width: 72, background: palette.teal, borderRadius: 2 }} />
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8 }}>
            <span
              style={{
                fontFamily: mono,
                fontSize: 14,
                fontWeight: 600,
                color: palette.positive,
                background: "rgba(18,128,92,0.08)",
                border: `1px solid ${palette.positive}`,
                borderRadius: 999,
                padding: "4px 12px",
                fontVariantNumeric: "tabular-nums",
              }}
            >
              +2,4% · +5.780 €
            </span>
            <Sparkline color={palette.teal} />
          </div>
        </section>

        {/* Palette */}
        <section>
          <h2
            style={{
              fontSize: 13,
              color: palette.muted1,
              textTransform: "uppercase",
              letterSpacing: "0.14em",
            }}
          >
            Palette (light)
          </h2>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 16, marginTop: 12 }}>
            <Swatch name="bg · carta" hex={palette.bg} />
            <Swatch name="surface" hex={palette.surface} />
            <Swatch name="border" hex={palette.border} />
            <Swatch name="text" hex={palette.text} />
            <Swatch name="muted-1" hex={palette.muted1} />
            <Swatch name="muted-2" hex={palette.muted2} />
            <Swatch name="accent · teal" hex={palette.teal} />
            <Swatch name="positive" hex={palette.positive} />
            <Swatch name="negative" hex={palette.negative} />
          </div>
        </section>

        {/* Tipografia */}
        <section>
          <h2
            style={{
              fontSize: 13,
              color: palette.muted1,
              textTransform: "uppercase",
              letterSpacing: "0.14em",
            }}
          >
            Tipografia
          </h2>
          <div style={{ display: "grid", gap: 14, marginTop: 12 }}>
            <div>
              <div
                style={{
                  fontFamily: display,
                  fontSize: 30,
                  fontWeight: 600,
                  letterSpacing: "-0.01em",
                }}
              >
                Display · grotesk, non serif
              </div>
              <div style={{ fontFamily: mono, fontSize: 11, color: palette.muted2 }}>
                Founders Grotesk (da bundlare woff2)
              </div>
            </div>
            <div>
              <div style={{ fontFamily: display, fontSize: 16, color: palette.muted1 }}>
                Body · calmo e leggibile, con generosa aria tra le righe.
              </div>
            </div>
            <div>
              <div
                style={{
                  fontFamily: mono,
                  fontSize: 22,
                  fontVariantNumeric: "tabular-nums",
                  color: palette.text,
                }}
              >
                1.234.567,89 € · −3,17% · 0,00
              </div>
              <div style={{ fontFamily: mono, fontSize: 11, color: palette.muted2 }}>
                Numeric/mono · cifre tabellari
              </div>
            </div>
          </div>
        </section>

        <footer
          style={{
            borderTop: `1px solid ${palette.border}`,
            paddingTop: 16,
            color: palette.muted1,
            fontSize: 14,
          }}
        >
          <strong style={{ color: palette.text }}>Tesi.</strong> La fiducia della carta: chiaro,
          ordinato, come un documento finanziario ben impaginato.{" "}
          <strong style={{ color: palette.text }}>Rischio.</strong> Tema chiaro per un'app oggi
          scura; il grotesk+teal serve a non cadere nel cliché cream+serif.
        </footer>
      </div>
    </div>
  );
}

const meta: Meta<typeof Overview> = {
  title: "Explorations/B · Carta e inchiostro",
  component: Overview,
  parameters: { layout: "fullscreen" },
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof Overview>;

export const Direzione: Story = {};
