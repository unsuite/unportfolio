import type { Meta, StoryObj } from "@storybook/react-vite";
import { StatTile } from "./StatTile";

const meta: Meta<typeof StatTile> = {
  title: "Components/StatTile",
  component: StatTile,
  tags: ["autodocs"],
  args: {
    label: "Patrimonio netto",
    value: "€ 128.450,00",
    tone: "default",
    size: "sm",
  },
  argTypes: {
    tone: {
      control: "select",
      options: ["default", "positive", "negative", "muted"],
    },
    size: { control: "inline-radio", options: ["sm", "lg"] },
  },
};

export default meta;
type Story = StoryObj<typeof StatTile>;

export const Default: Story = {
  args: { label: "Patrimonio netto", value: "€ 128.450,00" },
};
export const Positive: Story = {
  args: { label: "Rendimento YTD", value: "+7,2%", tone: "positive" },
};
export const Negative: Story = {
  args: { label: "Variazione mese", value: "−3,1%", tone: "negative" },
};
export const Muted: Story = {
  args: { label: "Liquidità", value: "€ 4.200,00", tone: "muted" },
};

export const Large: Story = {
  args: { label: "Totale portafoglio", value: "€ 128.450,00", size: "lg" },
};

export const Sizes: Story = {
  render: (args) => (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 32 }}>
      <StatTile {...args} size="sm" value="€ 128.450,00" />
      <StatTile {...args} size="lg" value="€ 128.450,00" />
    </div>
  ),
  args: { label: "Patrimonio netto" },
};

export const AllTones: Story = {
  render: () => (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 32 }}>
      <StatTile label="Default" value="€ 1.000,00" tone="default" />
      <StatTile label="Positivo" value="+7,2%" tone="positive" />
      <StatTile label="Negativo" value="−3,1%" tone="negative" />
      <StatTile label="Muted" value="€ 4.200,00" tone="muted" />
    </div>
  ),
};
