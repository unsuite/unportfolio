import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { SegmentedControl } from "./SegmentedControl";

const meta: Meta<typeof SegmentedControl> = {
  title: "Components/SegmentedControl",
  component: SegmentedControl,
  tags: ["autodocs"],
  argTypes: {
    size: { control: "inline-radio", options: ["sm", "md"] },
  },
};

export default meta;
type Story = StoryObj<typeof SegmentedControl>;

/** Serie del grafico patrimonio: Valore / Rendimento / Investito. */
export const Serie: Story = {
  render: (args) => {
    const [value, setValue] = useState("valore");
    return (
      <SegmentedControl
        {...args}
        aria-label="Serie"
        value={value}
        onChange={setValue}
        options={[
          { value: "valore", label: "Valore" },
          { value: "rendimento", label: "Rendimento" },
          { value: "investito", label: "Investito" },
        ]}
      />
    );
  },
};

/** Base grafico asset: Prezzo / Investito. */
export const PrezzoInvestito: Story = {
  render: (args) => {
    const [value, setValue] = useState("prezzo");
    return (
      <SegmentedControl
        {...args}
        aria-label="Base"
        value={value}
        onChange={setValue}
        options={[
          { value: "prezzo", label: "Prezzo" },
          { value: "investito", label: "Investito" },
        ]}
      />
    );
  },
};

/** Selettore intervallo temporale: 1M / 3M / 6M / 1A / YTD / Max. */
export const Range: Story = {
  render: (args) => {
    const [value, setValue] = useState("1M");
    return (
      <SegmentedControl
        {...args}
        aria-label="Intervallo"
        value={value}
        onChange={setValue}
        options={[
          { value: "1M", label: "1M" },
          { value: "3M", label: "3M" },
          { value: "6M", label: "6M" },
          { value: "1A", label: "1A" },
          { value: "YTD", label: "YTD" },
          { value: "Max", label: "Max" },
        ]}
      />
    );
  },
};

/** Dimensione compatta (sm). */
export const Small: Story = {
  args: { size: "sm" },
  render: (args) => {
    const [value, setValue] = useState("1M");
    return (
      <SegmentedControl
        {...args}
        aria-label="Intervallo"
        value={value}
        onChange={setValue}
        options={[
          { value: "1M", label: "1M" },
          { value: "3M", label: "3M" },
          { value: "6M", label: "6M" },
          { value: "1A", label: "1A" },
          { value: "YTD", label: "YTD" },
          { value: "Max", label: "Max" },
        ]}
      />
    );
  },
};
