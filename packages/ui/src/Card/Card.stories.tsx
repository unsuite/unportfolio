import type { Meta, StoryObj } from "@storybook/react-vite";
import { Card } from "./Card";

const meta: Meta<typeof Card> = {
  title: "Components/Card",
  component: Card,
  tags: ["autodocs"],
  args: {
    variant: "panel",
    padding: "md",
    children: "Contenuto della card",
  },
  argTypes: {
    variant: {
      control: "select",
      options: ["section", "panel", "subtle"],
    },
    padding: { control: "inline-radio", options: ["none", "sm", "md"] },
  },
};

export default meta;
type Story = StoryObj<typeof Card>;

export const Section: Story = {
  args: { variant: "section", children: "Riquadro con bordo" },
};
export const Panel: Story = {
  args: { variant: "panel", children: "Superficie piena" },
};
export const Subtle: Story = {
  args: { variant: "subtle", children: "Superficie semitrasparente" },
};

export const PaddingNone: Story = {
  args: { padding: "none", children: "Senza padding" },
};
export const PaddingSm: Story = {
  args: { padding: "sm", children: "Padding piccolo" },
};

export const AllVariants: Story = {
  render: () => (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 16 }}>
      <Card variant="section">Section</Card>
      <Card variant="panel">Panel</Card>
      <Card variant="subtle">Subtle</Card>
    </div>
  ),
};
