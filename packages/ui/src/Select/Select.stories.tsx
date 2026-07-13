import type { Meta, StoryObj } from "@storybook/react-vite";
import { Select } from "./Select";

const meta: Meta<typeof Select> = {
  title: "Components/Select",
  component: Select,
  tags: ["autodocs"],
  argTypes: {
    placeholder: { control: "text" },
    disabled: { control: "boolean" },
  },
};

export default meta;
type Story = StoryObj<typeof Select>;

/** Enum statico: valori fissi con un default selezionato. */
export const Default: Story = {
  args: { defaultValue: "EUR" },
  render: (args) => (
    <Select {...args}>
      <option value="EUR">Euro (EUR)</option>
      <option value="USD">Dollaro USA (USD)</option>
      <option value="GBP">Sterlina (GBP)</option>
      <option value="CHF">Franco svizzero (CHF)</option>
    </Select>
  ),
};

/** Con placeholder: voce guida mostrata quando nessun valore è scelto. */
export const WithPlaceholder: Story = {
  args: { placeholder: "Scegli una valuta…" },
  render: (args) => (
    <Select {...args}>
      <option value="EUR">Euro (EUR)</option>
      <option value="USD">Dollaro USA (USD)</option>
      <option value="GBP">Sterlina (GBP)</option>
    </Select>
  ),
};

/** Con opzione-azione: l'ultima voce avvia una creazione. */
export const WithActionOption: Story = {
  args: { defaultValue: "acc-1" },
  render: (args) => (
    <Select {...args}>
      <option value="acc-1">Conto corrente</option>
      <option value="acc-2">Deposito titoli</option>
      <option value="acc-3">Fondo pensione</option>
      <option value="__new">+ Nuovo conto…</option>
    </Select>
  ),
};

/** Stato disabilitato via attributo nativo. */
export const Disabled: Story = {
  args: { defaultValue: "EUR", disabled: true },
  render: (args) => (
    <Select {...args}>
      <option value="EUR">Euro (EUR)</option>
      <option value="USD">Dollaro USA (USD)</option>
    </Select>
  ),
};
