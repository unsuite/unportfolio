import type { Meta, StoryObj } from "@storybook/react-vite";

/**
 * Esplorazione di design (prototipo throwaway, non usa i token). Direzione D —
 * "Registro": sintesi di B (carta chiara, display grotesk, inchiostro teal) e C
 * (anima plain-text/beancount, dati in mono). UNA sola identità, resa in due temi
 * light+dark: è esattamente ciò che farà lo scope [data-theme="dark"] sui token.
 */

type Theme = {
  name: string;
  bg: string;
  surface: string;
  border: string;
  text: string;
  muted1: string;
  muted2: string;
  teal: string;
  positive: string;
  negative: string;
};

const light: Theme = {
  name: "Light · carta",
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

const dark: Theme = {
  name: "Dark · terminale",
  bg: "#0C0F0E",
  surface: "#121615",
  border: "#232B28",
  text: "#D6DEDA",
  muted1: "#8A968F",
  muted2: "#5C665F",
  teal: "#3FB6A9",
  positive: "#63B98A",
  negative: "#D6706A",
};

const display = '"Founders Grotesk", "Inter", system-ui, sans-serif';
const mono = '"Berkeley Mono", "Commit Mono", ui-monospace, "SF Mono", Menlo, monospace';

function Sparkline({ color }: { color: string }) {
  const pts = [8, 10, 9, 13, 12, 16, 15, 19, 22, 21, 26];
  const w = 200;
  const h = 40;
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

const rows = [
  ["Assets:Broker:ETF-World", "138.420,00", "+3,1%", true],
  ["Assets:Bank:Checking", "24.900,50", "+0,2%", true],
  ["Assets:Pension:Fund", "61.000,00", "−1,4%", false],
  ["Assets:Crypto:BTC", "24.000,00", "+8,7%", true],
] as const;

function Panel({ t }: { t: Theme }) {
  return (
    <div
      style={{
        background: t.bg,
        color: t.text,
        border: `1px solid ${t.border}`,
        borderRadius: 16,
        padding: 28,
        fontFamily: display,
        display: "grid",
        gap: 22,
      }}
    >
      <div
        style={{
          fontFamily: mono,
          fontSize: 11,
          letterSpacing: "0.16em",
          textTransform: "uppercase",
          color: t.teal,
        }}
      >
        {t.name}
      </div>

      {/* Ledger header — la firma */}
      <div
        style={{
          background: t.surface,
          border: `1px solid ${t.border}`,
          borderRadius: 12,
          padding: 22,
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "space-between",
          gap: 20,
          flexWrap: "wrap",
        }}
      >
        <div>
          <div
            style={{
              fontFamily: mono,
              fontSize: 11,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              color: t.muted2,
            }}
          >
            Patrimonio netto
          </div>
          <div
            style={{
              fontFamily: display,
              fontSize: 44,
              fontWeight: 600,
              letterSpacing: "-0.02em",
              fontVariantNumeric: "tabular-nums",
              margin: "4px 0",
            }}
          >
            € 248.320<span style={{ color: t.muted2 }}>,50</span>
          </div>
          <div
            style={{ height: 2, width: 64, background: t.teal, borderRadius: 2, marginBottom: 8 }}
          />
          <div style={{ fontFamily: mono, fontSize: 12, color: t.muted1 }}>
            ledger/*.beancount · aggiornato ora
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8 }}>
          <span
            style={{
              fontFamily: mono,
              fontSize: 13,
              fontWeight: 600,
              color: t.positive,
              border: `1px solid ${t.positive}`,
              borderRadius: 999,
              padding: "3px 11px",
              fontVariantNumeric: "tabular-nums",
            }}
          >
            +2,4% · +5.780 €
          </span>
          <Sparkline color={t.teal} />
        </div>
      </div>

      {/* Righe dati in mono (anima beancount) */}
      <div style={{ fontFamily: mono, fontSize: 13 }}>
        {rows.map(([acc, val, delta, up]) => (
          <div
            key={acc}
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: 16,
              padding: "8px 0",
              borderTop: `1px solid ${t.border}`,
              fontVariantNumeric: "tabular-nums",
            }}
          >
            <span style={{ color: t.muted1 }}>{acc}</span>
            <span style={{ display: "flex", gap: 16 }}>
              <span>{val} €</span>
              <span style={{ color: up ? t.positive : t.negative, width: 56, textAlign: "right" }}>
                {delta}
              </span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Overview() {
  return (
    <div style={{ background: "#8A8A8A", padding: 32, minHeight: "100vh", fontFamily: display }}>
      <div style={{ maxWidth: 1120, margin: "0 auto", display: "grid", gap: 24 }}>
        <header style={{ color: "#111" }}>
          <div
            style={{
              fontFamily: mono,
              fontSize: 12,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              color: "#0F766E",
            }}
          >
            Direzione D · sintesi di B + C
          </div>
          <h1
            style={{ fontSize: 32, fontWeight: 600, margin: "8px 0 4px", letterSpacing: "-0.01em" }}
          >
            Registro
          </h1>
          <p style={{ color: "#333", fontSize: 15, margin: 0, maxWidth: 720 }}>
            Una sola identità in due temi: la <strong>carta chiara</strong> e il{" "}
            <strong>display grotesk</strong> di B, l'anima
            <strong> plain-text/beancount</strong> e i <strong>dati in mono</strong> di C, con un
            unico inchiostro <strong>teal</strong>. È già la coppia light/dark che vivrà nello scope
            dei token.
          </p>
        </header>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))",
            gap: 24,
          }}
        >
          <Panel t={light} />
          <Panel t={dark} />
        </div>

        <footer
          style={{
            color: "#111",
            fontSize: 14,
            background: "#EDEDEA",
            borderRadius: 12,
            padding: 18,
          }}
        >
          <strong>Tesi.</strong> Grotesk per il numero-protagonista, mono per i dati e il conto (il
          rispetto del testo semplice), teal come unica guida — e la stessa identità regge in chiaro
          e in scuro. <strong>Rischio.</strong> Due caratteri da mantenere in armonia; il teal deve
          reggere il contrasto AA in entrambi i temi.
          <br />
          <span style={{ fontFamily: mono, fontSize: 12, color: "#555" }}>
            Font da bundlare woff2 (offline): Founders Grotesk (display) · Berkeley/Commit Mono
            (dati).
          </span>
        </footer>
      </div>
    </div>
  );
}

const meta: Meta<typeof Overview> = {
  title: "Explorations/D · Registro (B+C)",
  component: Overview,
  parameters: { layout: "fullscreen" },
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof Overview>;

export const Direzione: Story = {};
