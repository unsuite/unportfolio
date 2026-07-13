import type { Meta, StoryObj } from "@storybook/react-vite";
import { Button } from "./Button";

const meta: Meta<typeof Button> = {
  title: "Components/Button",
  component: Button,
  tags: ["autodocs"],
  args: {
    children: "Azione",
    variant: "neutral",
    size: "md",
  },
  argTypes: {
    variant: {
      control: "select",
      options: ["accent", "neutral", "danger", "dangerSolid", "info", "warning", "ghost"],
    },
    size: { control: "inline-radio", options: ["sm", "md", "lg"] },
    fullWidth: { control: "boolean" },
    busy: { control: "boolean" },
    disabled: { control: "boolean" },
  },
};

export default meta;
type Story = StoryObj<typeof Button>;

export const Accent: Story = { args: { variant: "accent", children: "Salva" } };
export const Neutral: Story = { args: { variant: "neutral", children: "Annulla" } };
export const Danger: Story = { args: { variant: "danger", children: "Elimina" } };
export const DangerSolid: Story = {
  args: { variant: "dangerSolid", children: "Esci senza salvare" },
};
export const Info: Story = { args: { variant: "info", children: "Installa" } };
export const Warning: Story = { args: { variant: "warning", children: "Aggiorna" } };
export const Ghost: Story = { args: { variant: "ghost", children: "Dettagli" } };

export const Disabled: Story = { args: { variant: "accent", children: "Salva", disabled: true } };
export const Busy: Story = { args: { variant: "accent", children: "Aggiorno…", busy: true } };

export const Sizes: Story = {
  render: (args) => (
    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
      <Button {...args} size="sm">
        Piccolo
      </Button>
      <Button {...args} size="md">
        Medio
      </Button>
      <Button {...args} size="lg">
        Grande
      </Button>
    </div>
  ),
  args: { variant: "accent" },
};

export const AllVariants: Story = {
  render: () => (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
      <Button variant="accent">Accent</Button>
      <Button variant="neutral">Neutral</Button>
      <Button variant="danger">Danger</Button>
      <Button variant="dangerSolid">Danger solid</Button>
      <Button variant="info">Info</Button>
      <Button variant="warning">Warning</Button>
      <Button variant="ghost">Ghost</Button>
    </div>
  ),
};
