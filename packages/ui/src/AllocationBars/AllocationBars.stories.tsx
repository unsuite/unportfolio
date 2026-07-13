import type { Meta, StoryObj } from "@storybook/react-vite";
import { AllocationBars } from "./AllocationBars";

const meta: Meta<typeof AllocationBars> = {
  title: "Components/AllocationBars",
  component: AllocationBars,
  tags: ["autodocs"],
  args: {
    items: [
      { label: "Azioni", value: 42000 },
      { label: "Obbligazioni", value: 18000 },
      { label: "Liquidità", value: 9500 },
      { label: "Immobili", value: 6000 },
    ],
  },
  argTypes: {
    items: { control: "object" },
  },
};

export default meta;
type Story = StoryObj<typeof AllocationBars>;

export const Default: Story = {};

export const ColoriEspliciti: Story = {
  args: {
    items: [
      { label: "Azioni", value: 42000, color: "var(--color-positive)" },
      { label: "Obbligazioni", value: 18000, color: "var(--color-info)" },
      { label: "Liquidità", value: 9500, color: "var(--color-warning)" },
      { label: "Immobili", value: 6000, color: "var(--color-negative)" },
    ],
  },
};

export const ValoreFormattato: Story = {
  args: {
    formatValue: (value) => value.toLocaleString("it-IT", { style: "currency", currency: "EUR" }),
  },
};

export const ManyCategorie: Story = {
  args: {
    items: [
      { label: "Categoria 1", value: 3200 },
      { label: "Categoria 2", value: 2800 },
      { label: "Categoria 3", value: 2400 },
      { label: "Categoria 4", value: 2000 },
      { label: "Categoria 5", value: 1600 },
      { label: "Categoria 6", value: 1200 },
      { label: "Categoria 7", value: 800 },
      { label: "Categoria 8", value: 400 },
    ],
  },
};

export const Vuoto: Story = {
  args: { items: [] },
};
