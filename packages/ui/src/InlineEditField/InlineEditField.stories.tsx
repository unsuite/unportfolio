import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { InlineEditField } from "./InlineEditField";

const meta: Meta<typeof InlineEditField> = {
  title: "Components/InlineEditField",
  component: InlineEditField,
  tags: ["autodocs"],
  args: {
    value: "Azioni Acme S.p.A.",
    numeric: false,
  },
  argTypes: {
    numeric: { control: "boolean" },
    label: { control: "text" },
    suffix: { control: "text" },
    placeholder: { control: "text" },
  },
  render: (args) => {
    const [value, setValue] = useState(args.value);
    return <InlineEditField {...args} value={value} onCommit={(v) => setValue(v)} />;
  },
};

export default meta;
type Story = StoryObj<typeof InlineEditField>;

export const Testo: Story = {
  args: { value: "Azioni Acme S.p.A." },
};

export const Numerico: Story = {
  args: { value: 26, numeric: true, suffix: "%" },
};

export const ConEtichetta: Story = {
  args: { value: 26, numeric: true, label: "Tassa CG", suffix: "%" },
};

export const Formattato: Story = {
  args: {
    value: 12500,
    numeric: true,
    format: (v) => `${Number(v).toLocaleString("it-IT")} €`,
  },
};

export const Vuoto: Story = {
  args: { value: "", placeholder: "Aggiungi una descrizione…" },
};
