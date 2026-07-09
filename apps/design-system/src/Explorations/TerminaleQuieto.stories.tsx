import type { Meta, StoryObj } from "@storybook/react-vite";

/**
 * Esplorazione di design (prototipo throwaway, non usa i token). Direzione C —
 * "Terminale quieto": omaggio alle radici plain-text/beancount. Mono-forward,
 * fosforo tenue (cyan/ambra smorzati), NON il neon acid-green da cliché.
 */

const palette = {
  bg: "#0C0F0E",
  surface: "#121615",
  raised: "#171D1B",
  border: "#232B28",
  text: "#D6DEDA",
  muted1: "#8A968F",
  muted2: "#5C665F",
  cyan: "#6FB7B0",
  amber: "#D6A65B",
  positive: "#63B98A",
  negative: "#D6706A",
};

const mono = '"Berkeley Mono", "Commit Mono", ui-monospace, "SF Mono", Menlo, monospace';

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
          borderRadius: 6,
          background: hex,
          border: "1px solid rgba(255,255,255,0.08)",
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
        fontFamily: mono,
        padding: 40,
        minHeight: "100vh",
      }}
    >
      <div style={{ maxWidth: 880, margin: "0 auto", display: "grid", gap: 40 }}>
        <header>
          <div
            style={{
              fontSize: 12,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              color: palette.cyan,
            }}
          >
            Direzione C
          </div>
          <h1 style={{ fontSize: 30, fontWeight: 600, margin: "8px 0 4px" }}>Terminale quieto</h1>
          <p style={{ color: palette.muted1, fontSize: 14, margin: 0 }}>
            Le radici plain-text del ledger, rese calme: griglia mono, fosforo smorzato, niente
            neon.
          </p>
        </header>

        {/* Elemento firma: il ledger header, stile terminale */}
        <section
          style={{
            background: palette.surface,
            border: `1px solid ${palette.border}`,
            borderRadius: 10,
            padding: 24,
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "space-between",
            gap: 24,
            flexWrap: "wrap",
          }}
        >
          <div>
            <div
              style={{
                fontSize: 12,
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                color: palette.muted2,
              }}
            >
              patrimonio_netto
            </div>
            <div
              style={{
                fontSize: 46,
                fontWeight: 600,
                fontVariantNumeric: "tabular-nums",
                margin: "6px 0",
                display: "flex",
                alignItems: "center",
              }}
            >
              €&nbsp;248.320<span style={{ color: palette.muted2 }}>,50</span>
              <span
                style={{
                  display: "inline-block",
                  width: 12,
                  height: 34,
                  marginLeft: 8,
                  background: palette.cyan,
                  opacity: 0.7,
                }}
              />
            </div>
            <div style={{ fontSize: 12, color: palette.muted2 }}>
              ledger/*.beancount · aggiornato ora
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8 }}>
            <span
              style={{
                fontSize: 14,
                fontWeight: 600,
                color: palette.positive,
                border: `1px solid ${palette.positive}`,
                borderRadius: 6,
                padding: "3px 10px",
                fontVariantNumeric: "tabular-nums",
              }}
            >
              +2,4% +5.780€
            </span>
            <Sparkline color={palette.cyan} />
          </div>
        </section>

        {/* Palette */}
        <section>
          <h2
            style={{
              fontSize: 12,
              color: palette.muted1,
              textTransform: "uppercase",
              letterSpacing: "0.14em",
            }}
          >
            Palette (dark · fosforo tenue)
          </h2>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 16, marginTop: 12 }}>
            <Swatch name="bg" hex={palette.bg} />
            <Swatch name="surface" hex={palette.surface} />
            <Swatch name="raised" hex={palette.raised} />
            <Swatch name="border" hex={palette.border} />
            <Swatch name="text" hex={palette.text} />
            <Swatch name="muted-1" hex={palette.muted1} />
            <Swatch name="muted-2" hex={palette.muted2} />
            <Swatch name="accent · cyan" hex={palette.cyan} />
            <Swatch name="highlight · ambra" hex={palette.amber} />
            <Swatch name="positive" hex={palette.positive} />
            <Swatch name="negative" hex={palette.negative} />
          </div>
        </section>

        {/* Tipografia */}
        <section>
          <h2
            style={{
              fontSize: 12,
              color: palette.muted1,
              textTransform: "uppercase",
              letterSpacing: "0.14em",
            }}
          >
            Tipografia · mono-forward
          </h2>
          <div style={{ display: "grid", gap: 14, marginTop: 12 }}>
            <div>
              <div style={{ fontSize: 24, fontWeight: 600 }}>
                Display = lo stesso mono, in grande
              </div>
              <div style={{ fontSize: 11, color: palette.muted2 }}>
                Berkeley Mono / Commit Mono (da bundlare woff2)
              </div>
            </div>
            <div style={{ fontSize: 14, color: palette.muted1, lineHeight: 1.6 }}>
              2026-07-09 Assets:Bank:Checking +1.250,00 EUR
              <br />
              2026-07-09 Assets:Broker:ETF-World +3.980,50 EUR
            </div>
            <div>
              <div style={{ fontSize: 22, fontVariantNumeric: "tabular-nums" }}>
                1.234.567,89 € · −3,17% · 0,00
              </div>
              <div style={{ fontSize: 11, color: palette.muted2 }}>
                Le cifre sono già tabellari per natura del mono
              </div>
            </div>
          </div>
        </section>

        <footer
          style={{
            borderTop: `1px solid ${palette.border}`,
            paddingTop: 16,
            color: palette.muted1,
            fontSize: 13,
          }}
        >
          <strong style={{ color: palette.text }}>Tesi.</strong> Onora il fatto che sotto c'è testo
          semplice (beancount): un terminale, ma calmo e leggibile.{" "}
          <strong style={{ color: palette.text }}>Rischio.</strong> Il mono-forward è denso e
          "tecnico" — può intimidire chi arriva dal foglio di calcolo.
        </footer>
      </div>
    </div>
  );
}

const meta: Meta<typeof Overview> = {
  title: "Explorations/C · Terminale quieto",
  component: Overview,
  parameters: { layout: "fullscreen" },
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof Overview>;

export const Direzione: Story = {};
