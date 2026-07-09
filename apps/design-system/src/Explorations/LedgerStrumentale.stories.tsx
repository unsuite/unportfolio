import type { Meta, StoryObj } from "@storybook/react-vite";

/**
 * Esplorazione di design (prototipo throwaway, non usa i token: qui si SCEGLIE
 * la palette). Direzione A — "Ledger strumentale": pannello scuro da strumento
 * di precisione, accento ottone usato con parsimonia come highlight del valore.
 */

const palette = {
  bg: "#0E1216",
  surface: "#161C22",
  raised: "#1D242C",
  border: "#2A333C",
  text: "#EAEEF2",
  muted1: "#A7B2BD",
  muted2: "#79848F",
  muted3: "#566069",
  brass: "#C9A24A",
  positive: "#4FBE86",
  negative: "#E5675C",
};

const display = '"Neue Haas Grotesk Display", "Inter", system-ui, sans-serif';
const mono = '"Commit Mono", ui-monospace, "SF Mono", Menlo, monospace';

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
              color: palette.brass,
            }}
          >
            Direzione A
          </div>
          <h1
            style={{ fontSize: 34, fontWeight: 600, margin: "8px 0 4px", letterSpacing: "-0.01em" }}
          >
            Ledger strumentale
          </h1>
          <p style={{ color: palette.muted1, fontSize: 15, margin: 0 }}>
            Strumento privato e preciso. L'ottone è l'unico lusso: segna il valore, tutto il resto
            resta quieto.
          </p>
        </header>

        {/* Elemento firma: il ledger header */}
        <section
          style={{
            background: `linear-gradient(180deg, ${palette.raised}, ${palette.surface})`,
            border: `1px solid ${palette.border}`,
            borderRadius: 16,
            padding: 28,
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
                fontFamily: mono,
                fontSize: 12,
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                color: palette.muted2,
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
            <div style={{ height: 2, width: 72, background: palette.brass, borderRadius: 2 }} />
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8 }}>
            <span
              style={{
                fontFamily: mono,
                fontSize: 14,
                fontWeight: 600,
                color: palette.positive,
                background: "rgba(79,190,134,0.12)",
                border: `1px solid ${palette.positive}`,
                borderRadius: 999,
                padding: "4px 12px",
                fontVariantNumeric: "tabular-nums",
              }}
            >
              +2,4% · +5.780 €
            </span>
            <Sparkline color={palette.brass} />
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
            Palette (dark-first)
          </h2>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 16, marginTop: 12 }}>
            <Swatch name="bg" hex={palette.bg} />
            <Swatch name="surface" hex={palette.surface} />
            <Swatch name="raised" hex={palette.raised} />
            <Swatch name="border" hex={palette.border} />
            <Swatch name="text" hex={palette.text} />
            <Swatch name="muted-1" hex={palette.muted1} />
            <Swatch name="muted-2" hex={palette.muted2} />
            <Swatch name="muted-3" hex={palette.muted3} />
            <Swatch name="accent · ottone" hex={palette.brass} />
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
                Display · grotesk stretta
              </div>
              <div style={{ fontFamily: mono, fontSize: 11, color: palette.muted2 }}>
                Neue Haas Grotesk Display (da bundlare woff2)
              </div>
            </div>
            <div>
              <div style={{ fontFamily: display, fontSize: 16, color: palette.muted1 }}>
                Body · leggibile ad alta densità, per righe di tabella e descrizioni.
              </div>
            </div>
            <div>
              <div style={{ fontFamily: mono, fontSize: 22, fontVariantNumeric: "tabular-nums" }}>
                1.234.567,89 € · −3,17% · 0,00
              </div>
              <div style={{ fontFamily: mono, fontSize: 11, color: palette.muted2 }}>
                Numeric/mono · cifre tabellari (Commit Mono)
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
          <strong style={{ color: palette.text }}>Tesi.</strong> Un pannello da strumento: scuro,
          denso ma leggibile, con l'ottone riservato al valore.{" "}
          <strong style={{ color: palette.text }}>Rischio.</strong> Accento ottone al posto del blu
          di default — deve reggere il contrasto e non scadere nel "lussuoso".
        </footer>
      </div>
    </div>
  );
}

const meta: Meta<typeof Overview> = {
  title: "Explorations/A · Ledger strumentale",
  component: Overview,
  parameters: { layout: "fullscreen" },
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof Overview>;

export const Direzione: Story = {};
