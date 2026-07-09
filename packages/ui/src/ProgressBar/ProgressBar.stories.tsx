import type { Meta, StoryObj } from "@storybook/react-vite";
import { ProgressBar } from "./ProgressBar";

const meta: Meta<typeof ProgressBar> = {
  title: "Components/ProgressBar",
  component: ProgressBar,
  tags: ["autodocs"],
  args: {
    value: 0.6,
    tone: "auto",
    showLabel: true,
    height: "md",
    rounded: "full",
  },
  argTypes: {
    value: { control: { type: "range", min: 0, max: 1, step: 0.01 } },
    tone: { control: "inline-radio", options: ["auto", "positive", "warning"] },
    showLabel: { control: "boolean" },
    height: { control: "inline-radio", options: ["sm", "md"] },
    rounded: { control: "inline-radio", options: ["md", "full"] },
  },
  decorators: [
    (Story) => (
      <div style={{ width: 320 }}>
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof ProgressBar>;

export const AutoInCorso: Story = { args: { value: 0.6, tone: "auto" } };
export const AutoCompleta: Story = { args: { value: 1, tone: "auto" } };
export const Positive: Story = { args: { value: 0.75, tone: "positive" } };
export const Warning: Story = { args: { value: 0.4, tone: "warning" } };

export const SenzaEtichetta: Story = { args: { value: 0.6, showLabel: false } };

export const AltezzaSm: Story = { args: { value: 0.6, height: "sm" } };
export const RaggioMd: Story = { args: { value: 0.6, rounded: "md" } };

export const Eccesso: Story = { args: { value: 1.4, tone: "auto" } };

export const Scala: Story = {
  render: () => (
    <div style={{ display: "flex", flexDirection: "column", gap: 12, width: 320 }}>
      <ProgressBar value={0.25} showLabel />
      <ProgressBar value={0.5} showLabel />
      <ProgressBar value={0.75} showLabel />
      <ProgressBar value={1} showLabel />
    </div>
  ),
};
