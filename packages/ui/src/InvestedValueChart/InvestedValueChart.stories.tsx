import type { Meta, StoryObj } from "@storybook/react-vite";
import { InvestedValueChart, type InvestedValuePoint } from "./InvestedValueChart";

const eur = new Intl.NumberFormat("it-IT", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});

/** Serie a 12 mesi: investito che cresce a gradini, valore che lo supera. */
const growth: InvestedValuePoint[] = [
  { label: "2025-01", invested: 10000, value: 10000 },
  { label: "2025-02", invested: 11000, value: 11250 },
  { label: "2025-03", invested: 12000, value: 12800 },
  { label: "2025-04", invested: 12000, value: 12300 },
  { label: "2025-05", invested: 13000, value: 14100 },
  { label: "2025-06", invested: 14000, value: 15600 },
  { label: "2025-07", invested: 14000, value: 15200 },
  { label: "2025-08", invested: 15000, value: 17000 },
  { label: "2025-09", invested: 16000, value: 18400 },
  { label: "2025-10", invested: 16000, value: 17900 },
  { label: "2025-11", invested: 17000, value: 19800 },
  { label: "2025-12", invested: 18000, value: 21500 },
];

/** Fase di perdita: il valore scende sotto il capitale versato. */
const loss: InvestedValuePoint[] = [
  { label: "2025-01", invested: 10000, value: 10000 },
  { label: "2025-02", invested: 11000, value: 10400 },
  { label: "2025-03", invested: 12000, value: 11100 },
  { label: "2025-04", invested: 13000, value: 11800 },
  { label: "2025-05", invested: 14000, value: 12600 },
  { label: "2025-06", invested: 15000, value: 13200 },
];

const meta: Meta<typeof InvestedValueChart> = {
  title: "Components/InvestedValueChart",
  component: InvestedValueChart,
  tags: ["autodocs"],
  args: {
    points: growth,
    formatValue: (value: number) => eur.format(value),
  },
  argTypes: {
    points: { control: "object" },
  },
};

export default meta;
type Story = StoryObj<typeof InvestedValueChart>;

export const Guadagno: Story = { args: { points: growth } };

export const Perdita: Story = { args: { points: loss } };

export const DueSoliPunti: Story = {
  args: {
    points: [
      { label: "2025-01", invested: 10000, value: 10000 },
      { label: "2025-06", invested: 15000, value: 16800 },
    ],
  },
};

export const PuntoUnico: Story = {
  args: { points: [{ label: "2025-01", invested: 10000, value: 10000 }] },
};

export const FormatoDefault: Story = {
  args: { points: growth, formatValue: undefined },
};
