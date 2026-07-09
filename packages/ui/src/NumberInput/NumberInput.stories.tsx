import type { Meta, StoryObj } from "@storybook/react-vite";
import { NumberInput } from "./NumberInput";

const meta: Meta<typeof NumberInput> = {
  title: "Components/NumberInput",
  component: NumberInput,
  tags: ["autodocs"],
  args: {
    placeholder: "0",
    invalid: false,
    disabled: false,
  },
  argTypes: {
    invalid: { control: "boolean" },
    disabled: { control: "boolean" },
    step: { control: "text" },
    min: { control: "text" },
    max: { control: "text" },
    inputMode: {
      control: "select",
      options: ["numeric", "decimal"],
    },
  },
};

export default meta;
type Story = StoryObj<typeof NumberInput>;

/** Intero — step 1, tastiera numerica (es. numero di quote). */
export const Intero: Story = {
  args: { defaultValue: 42, step: 1, inputMode: "numeric" },
};

/** Decimale — step 0.1 (es. importo di Pensione/SnapshotForm). */
export const Decimale: Story = {
  args: { defaultValue: 1234.5, step: 0.1, inputMode: "decimal" },
};

/** Con limiti min/max (es. percentuale 0–100). */
export const ConLimiti: Story = {
  args: { defaultValue: 50, step: 1, min: 0, max: 100, inputMode: "numeric" },
};

export const Invalid: Story = {
  args: { defaultValue: -5, step: 0.1, invalid: true },
};

export const Disabled: Story = {
  args: { defaultValue: 1234.5, step: 0.1, disabled: true },
};
