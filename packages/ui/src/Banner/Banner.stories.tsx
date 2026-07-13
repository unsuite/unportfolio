import type { Meta, StoryObj } from "@storybook/react-vite";
import { Button } from "../Button/Button";
import { Banner } from "./Banner";

const meta: Meta<typeof Banner> = {
  title: "Components/Banner",
  component: Banner,
  tags: ["autodocs"],
  args: {
    tone: "info",
    children: "Messaggio informativo per l'utente.",
  },
  argTypes: {
    tone: {
      control: "select",
      options: ["error", "warning", "success", "info"],
    },
    inline: { control: "boolean" },
    title: { control: "text" },
  },
};

export default meta;
type Story = StoryObj<typeof Banner>;

export const ErrorTone: Story = {
  name: "Error",
  args: {
    tone: "error",
    title: "Salvataggio non riuscito",
    children: "Impossibile scrivere sul ledger. Controlla i permessi della cartella.",
  },
};

export const Warning: Story = {
  args: {
    tone: "warning",
    title: "File riallineato",
    children: "accounts.toml è stato riportato alla forma canonica.",
  },
};

export const Success: Story = {
  args: {
    tone: "success",
    title: "Movimento registrato",
    children: "La transazione è stata aggiunta al ledger.",
  },
};

export const Info: Story = {
  args: {
    tone: "info",
    title: "Ribilanciamento suggerito",
    children: "Il portafoglio si discosta dai target: valuta un ribilanciamento.",
  },
};

export const Inline: Story = {
  args: {
    tone: "error",
    inline: true,
    title: undefined,
    children: "Importo non valido.",
  },
};

export const WithIcon: Story = {
  args: {
    tone: "info",
    icon: "ℹ️",
    title: "Prezzi non aggiornati",
    children: "Aggiorna i prezzi dal terminale con lo script prices.ts.",
  },
};

export const WithAction: Story = {
  args: {
    tone: "error",
    title: "Connessione alla cartella persa",
    children: "L'accesso al filesystem è scaduto.",
    action: (
      <Button variant="danger" size="sm">
        Riprova
      </Button>
    ),
  },
};

export const AllTones: Story = {
  render: () => (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <Banner tone="error" title="Errore">
        Qualcosa è andato storto.
      </Banner>
      <Banner tone="warning" title="Attenzione">
        Verifica i dati inseriti.
      </Banner>
      <Banner tone="success" title="Fatto">
        Operazione completata.
      </Banner>
      <Banner tone="info" title="Nota">
        Informazione utile.
      </Banner>
    </div>
  ),
};
