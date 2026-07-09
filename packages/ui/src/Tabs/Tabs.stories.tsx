import type { Meta, StoryObj } from "@storybook/react-vite";
import { Tabs } from "./Tabs";

const items = [
  { key: "patrimonio", label: "Patrimonio" },
  { key: "investimenti", label: "Investimenti" },
  { key: "obiettivi", label: "Obiettivi" },
  { key: "impostazioni", label: "Impostazioni" },
];

const meta: Meta<typeof Tabs> = {
  title: "Components/Tabs",
  component: Tabs,
  tags: ["autodocs"],
  args: {
    items,
    activeKey: "patrimonio",
  },
  argTypes: {
    activeKey: {
      control: "inline-radio",
      options: items.map((i) => i.key),
    },
  },
};

export default meta;
type Story = StoryObj<typeof Tabs>;

export const Default: Story = {};

export const SecondActive: Story = { args: { activeKey: "investimenti" } };

export const AsLinks: Story = {
  args: {
    items: items.map((i) => ({ ...i, href: `#${i.key}` })),
    activeKey: "obiettivi",
  },
};
