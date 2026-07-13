import type { Meta, StoryObj } from "@storybook/react-vite";
import { TextInput } from "./TextInput";

const meta: Meta<typeof TextInput> = {
  title: "Components/TextInput",
  component: TextInput,
  tags: ["autodocs"],
  args: {
    placeholder: "Scrivi qui…",
    numeric: false,
    mono: false,
    invalid: false,
  },
  argTypes: {
    numeric: { control: "boolean" },
    mono: { control: "boolean" },
    invalid: { control: "boolean" },
    disabled: { control: "boolean" },
  },
};

export default meta;
type Story = StoryObj<typeof TextInput>;

export const Default: Story = { args: { defaultValue: "Conto corrente" } };

export const Numeric: Story = {
  args: { numeric: true, defaultValue: "12.345,67" },
};

export const Mono: Story = {
  args: { mono: true, defaultValue: "IE00B4L5Y983" },
};

export const Disabled: Story = {
  args: { defaultValue: "Non modificabile", disabled: true },
};

export const Invalid: Story = {
  args: { invalid: true, defaultValue: "valore@non valido" },
};

export const WithPlaceholder: Story = {
  args: { placeholder: "Nome del conto" },
};
