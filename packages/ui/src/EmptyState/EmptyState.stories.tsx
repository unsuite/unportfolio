import type { Meta, StoryObj } from "@storybook/react-vite";
import { Button } from "../Button/Button";
import { EmptyState } from "./EmptyState";

const meta: Meta<typeof EmptyState> = {
  title: "Components/EmptyState",
  component: EmptyState,
  tags: ["autodocs"],
  args: {
    variant: "inline",
    children: "Nessun dato disponibile.",
  },
  argTypes: {
    variant: { control: "inline-radio", options: ["box", "inline"] },
  },
};

export default meta;
type Story = StoryObj<typeof EmptyState>;

export const Inline: Story = {
  args: {
    variant: "inline",
    children: "Nessun movimento registrato in questo periodo.",
  },
};

export const Box: Story = {
  args: {
    variant: "box",
    children: "Dati insufficienti per tracciare il grafico.",
  },
};

/** EmptyChartNote reale: nota nei grafici di Patrimonio. */
export const EmptyChartNote: Story = {
  args: {
    variant: "box",
    children: "Aggiungi almeno due snapshot per vedere l'andamento del patrimonio.",
  },
};

/** no-goals reale: vista Goals vuota con azione. */
export const NoGoals: Story = {
  args: {
    variant: "box",
    children: "Non hai ancora definito obiettivi di risparmio.",
    action: <Button variant="accent">Aggiungi obiettivo</Button>,
  },
};

export const InlineWithAction: Story = {
  args: {
    variant: "inline",
    children: "Nessun conto collegato.",
    action: <Button variant="ghost">Collega un conto</Button>,
  },
};
