import type { Meta, StoryObj } from "@storybook/react-vite";
import { Badge } from "./Badge";

const meta: Meta<typeof Badge> = {
  title: "Components/Badge",
  component: Badge,
  tags: ["autodocs"],
  args: {
    children: "Etichetta",
    variant: "neutral",
  },
  argTypes: {
    variant: {
      control: "inline-radio",
      options: ["neutral", "status", "swatch"],
    },
    tone: {
      control: "select",
      options: ["positive", "warning", "negative", "info", "muted"],
    },
    color: { control: "color" },
  },
};

export default meta;
type Story = StoryObj<typeof Badge>;

export const Neutral: Story = {
  args: { variant: "neutral", children: "assets:cash" },
};

export const StatusChiusa: Story = {
  args: { variant: "status", tone: "warning", children: "chiusa" },
};

export const StatusConferma: Story = {
  args: { variant: "status", tone: "positive", children: "✓ verificata" },
};

export const StatusInfo: Story = {
  args: { variant: "status", tone: "info", children: "in aggiornamento" },
};

export const StatusNegative: Story = {
  args: { variant: "status", tone: "negative", children: "errore" },
};

export const StatusMuted: Story = {
  args: { variant: "status", tone: "muted", children: "bozza" },
};

export const Swatch: Story = {
  args: { variant: "swatch", color: "var(--chart-1)", children: undefined },
};

export const SwatchGroup: Story = {
  render: () => (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {[
        { color: "var(--chart-1)", label: "Azioni" },
        { color: "var(--chart-2)", label: "Obbligazioni" },
        { color: "var(--chart-3)", label: "Liquidità" },
        { color: "var(--chart-4)", label: "Immobili" },
      ].map((item) => (
        <div key={item.label} style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Badge variant="swatch" color={item.color} />
          <span>{item.label}</span>
        </div>
      ))}
    </div>
  ),
};

export const AllStatuses: Story = {
  render: () => (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 16 }}>
      <Badge variant="status" tone="positive">
        ✓ verificata
      </Badge>
      <Badge variant="status" tone="warning">
        chiusa
      </Badge>
      <Badge variant="status" tone="negative">
        errore
      </Badge>
      <Badge variant="status" tone="info">
        in aggiornamento
      </Badge>
      <Badge variant="status" tone="muted">
        bozza
      </Badge>
    </div>
  ),
};
