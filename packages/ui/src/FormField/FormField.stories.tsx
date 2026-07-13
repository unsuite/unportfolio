import type { Meta, StoryObj } from "@storybook/react-vite";
import { TextInput } from "../TextInput/TextInput";
import { FormField } from "./FormField";

const meta: Meta<typeof FormField> = {
  title: "Components/FormField",
  component: FormField,
  tags: ["autodocs"],
  args: {
    label: "Nome del conto",
    layout: "stacked",
    required: false,
  },
  argTypes: {
    layout: { control: "inline-radio", options: ["stacked", "inline"] },
    required: { control: "boolean" },
  },
  render: (args) => (
    <FormField {...args}>
      <TextInput placeholder="Conto corrente" />
    </FormField>
  ),
};

export default meta;
type Story = StoryObj<typeof FormField>;

export const Stacked: Story = { args: { layout: "stacked" } };

export const Inline: Story = {
  args: { label: "Valore attuale", layout: "inline" },
};

export const Required: Story = {
  args: { label: "Nome del conto", required: true },
};

export const WithHint: Story = {
  args: {
    label: "IBAN",
    hint: "Serve per abbinare i movimenti importati.",
  },
};

export const InlineWithHint: Story = {
  args: {
    label: "Rendita mensile",
    layout: "inline",
    hint: "Stima al lordo dell'imposta sostitutiva.",
  },
};
