import type { Meta, StoryObj } from "@storybook/react-vite";
import { DeltaText } from "./DeltaText";

const meta: Meta<typeof DeltaText> = {
  title: "Components/DeltaText",
  component: DeltaText,
  tags: ["autodocs"],
  args: {
    value: 1234.56,
    children: "+1.234,56 €",
    muted: false,
  },
  argTypes: {
    value: { control: "number" },
    sign: { control: "inline-radio", options: [-1, 0, 1] },
    muted: { control: "boolean" },
  },
};

export default meta;
type Story = StoryObj<typeof DeltaText>;

export const Positivo: Story = {
  args: { value: 1234.56, children: "+1.234,56 €" },
};
export const Negativo: Story = {
  args: { value: -842.1, children: "−842,10 €" },
};
export const Neutro: Story = {
  args: { value: 0, children: "0,00 €" },
};
export const Vuoto: Story = {
  args: { value: undefined, children: undefined },
};

export const Muted: Story = {
  args: { value: 1234.56, children: "+1.234,56 €", muted: true },
};

export const Tutti: Story = {
  render: () => (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <DeltaText value={1234.56}>+1.234,56 €</DeltaText>
      <DeltaText value={-842.1}>−842,10 €</DeltaText>
      <DeltaText value={0}>0,00 €</DeltaText>
      <DeltaText value={undefined}>{undefined}</DeltaText>
    </div>
  ),
};
