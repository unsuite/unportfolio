import type { Meta, StoryObj } from "@storybook/react-vite";
import { LedgerHeader } from "./LedgerHeader";

const trend = [8, 10, 9, 13, 12, 16, 15, 19, 22, 21, 26];

const meta: Meta<typeof LedgerHeader> = {
  title: "Components/LedgerHeader",
  component: LedgerHeader,
  tags: ["autodocs"],
  parameters: { layout: "padded" },
  args: {
    label: "Patrimonio netto",
    value: "€ 248.320,50",
    delta: "+2,4% · +5.780 €",
    deltaTone: "positive",
    sub: "ledger/*.beancount · aggiornato ora",
    trend,
  },
  argTypes: {
    deltaTone: { control: "inline-radio", options: ["positive", "negative", "neutral"] },
  },
};

export default meta;
type Story = StoryObj<typeof LedgerHeader>;

export const Guadagno: Story = {};

export const Perdita: Story = {
  args: {
    value: "€ 241.010,00",
    delta: "−1,3% · −3.180 €",
    deltaTone: "negative",
    trend: [26, 24, 25, 21, 22, 18, 19, 16, 14, 15, 13],
  },
};

export const Essenziale: Story = {
  args: { delta: undefined, sub: undefined, trend: undefined },
};
