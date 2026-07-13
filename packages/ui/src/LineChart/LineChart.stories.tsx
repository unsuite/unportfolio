import type { Meta, StoryObj } from "@storybook/react-vite";
import { LineChart } from "./LineChart";

const eur = new Intl.NumberFormat("it-IT", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});

/** +12,3% con segno; il valore e una frazione (0,123 = +12,3%). */
const signedPct = (v: number) => `${v >= 0 ? "+" : "−"}${(Math.abs(v) * 100).toFixed(1)}%`;

const eurSeries = [
  { label: "gen", value: 42000 },
  { label: "feb", value: 43500 },
  { label: "mar", value: 41800 },
  { label: "apr", value: 45200 },
  { label: "mag", value: 47100 },
  { label: "giu", value: 46400 },
  { label: "lug", value: 49800 },
];

const pctSeries = [
  { label: "gen", value: 0.0 },
  { label: "feb", value: 0.035 },
  { label: "mar", value: -0.012 },
  { label: "apr", value: 0.058 },
  { label: "mag", value: 0.081 },
  { label: "giu", value: 0.064 },
  { label: "lug", value: 0.123 },
];

const meta: Meta<typeof LineChart> = {
  title: "Components/LineChart",
  component: LineChart,
  tags: ["autodocs"],
  args: {
    points: eurSeries,
    format: "eur",
  },
  argTypes: {
    format: { control: "inline-radio", options: ["eur", "pct"] },
  },
};

export default meta;
type Story = StoryObj<typeof LineChart>;

export const Eur: Story = {
  args: { points: eurSeries, format: "eur", formatValue: (v) => eur.format(v) },
};

export const Pct: Story = {
  args: { points: pctSeries, format: "pct", formatValue: signedPct },
};

export const NotEnoughPoints: Story = {
  args: { points: [{ label: "gen", value: 42000 }], format: "eur" },
};
