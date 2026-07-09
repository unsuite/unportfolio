import type { Meta, StoryObj } from "@storybook/react-vite";
import { IconButton } from "./IconButton";

const Pencil = <span aria-hidden="true">✎</span>;
const Chevron = <span aria-hidden="true">›</span>;
const Cross = <span aria-hidden="true">✕</span>;

const meta: Meta<typeof IconButton> = {
  title: "Components/IconButton",
  component: IconButton,
  tags: ["autodocs"],
  args: {
    icon: Pencil,
    title: "Modifica",
    variant: "ghost",
    revealOnHover: false,
  },
  argTypes: {
    variant: { control: "inline-radio", options: ["ghost", "danger"] },
    revealOnHover: { control: "boolean" },
    disabled: { control: "boolean" },
  },
};

export default meta;
type Story = StoryObj<typeof IconButton>;

export const Ghost: Story = {
  args: { variant: "ghost", icon: Pencil, title: "Modifica" },
};

export const Danger: Story = {
  args: { variant: "danger", icon: Cross, title: "Rimuovi" },
};

export const ChevronIcon: Story = {
  args: { variant: "ghost", icon: Chevron, title: "Espandi" },
};

export const Disabled: Story = {
  args: { variant: "ghost", icon: Pencil, title: "Modifica", disabled: true },
};

export const RevealOnHover: Story = {
  render: (args) => (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        width: 220,
        padding: 12,
        border: "1px solid var(--color-border)",
        borderRadius: 8,
      }}
    >
      <span>Passa il mouse sulla riga</span>
      <IconButton {...args} />
    </div>
  ),
  args: { variant: "ghost", icon: Pencil, title: "Modifica", revealOnHover: true },
};

export const AllVariants: Story = {
  render: () => (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
      <IconButton variant="ghost" icon={Pencil} title="Modifica" />
      <IconButton variant="ghost" icon={Chevron} title="Espandi" />
      <IconButton variant="danger" icon={Cross} title="Rimuovi" />
    </div>
  ),
};
