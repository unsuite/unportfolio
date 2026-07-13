import type { Meta, StoryObj } from "@storybook/react-vite";
import { HelpText } from "./HelpText";

const meta: Meta<typeof HelpText> = {
  title: "Components/HelpText",
  component: HelpText,
  tags: ["autodocs"],
  args: {
    children: "Formato accettato: IT60X0542811101000000123456.",
    tone: "muted",
    size: "xs",
  },
  argTypes: {
    tone: { control: "inline-radio", options: ["muted", "warning"] },
    size: { control: "inline-radio", options: ["xs", "sm"] },
  },
};

export default meta;
type Story = StoryObj<typeof HelpText>;

export const Muted: Story = {
  args: { tone: "muted", children: "Facoltativo: usato solo per le note interne." },
};

export const Warning: Story = {
  args: {
    tone: "warning",
    children: "Il file è stato riallineato alla sua forma canonica.",
  },
};

export const Small: Story = {
  args: { size: "sm", children: "Nota più leggibile, dimensione sm." },
};

export const Sizes: Story = {
  render: (args) => (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <HelpText {...args} size="xs">
        Caption xs (default), la più compatta.
      </HelpText>
      <HelpText {...args} size="sm">
        Caption sm, leggermente più grande.
      </HelpText>
    </div>
  ),
  args: { tone: "muted" },
};
