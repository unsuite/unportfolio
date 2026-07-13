import type { Meta, StoryObj } from "@storybook/react-vite";
import { Modal } from "./Modal";

const meta: Meta<typeof Modal> = {
  title: "Components/Modal",
  component: Modal,
  tags: ["autodocs"],
  args: {
    title: "Conferma operazione",
    maxWidth: 480,
    onClose: () => {},
    children:
      "Sei sicuro di voler procedere? Questa azione aggiorna il ledger " +
      "e riallinea i file gestiti alla loro forma canonica.",
  },
  argTypes: {
    title: { control: "text" },
    maxWidth: { control: "number" },
    onClose: { action: "close" },
  },
};

export default meta;
type Story = StoryObj<typeof Modal>;

export const WithTitle: Story = {};

export const WithoutTitle: Story = {
  args: {
    title: undefined,
    children: "Dialog senza titolo: l'etichetta accessibile ricade su aria-label.",
  },
};

export const Wide: Story = {
  args: {
    title: "Dettaglio posizione",
    maxWidth: 800,
    children: "Pannello più largo per contenuti tabellari o form con molte colonne.",
  },
};
