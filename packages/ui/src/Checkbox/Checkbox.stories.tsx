import type { Meta, StoryObj } from "@storybook/react-vite";
import { Checkbox } from "./Checkbox";

const meta: Meta<typeof Checkbox> = {
  title: "Components/Checkbox",
  component: Checkbox,
  tags: ["autodocs"],
  args: {
    label: "Includi conti chiusi",
    checked: false,
  },
  argTypes: {
    checked: { control: "boolean" },
    disabled: { control: "boolean" },
  },
};

export default meta;
type Story = StoryObj<typeof Checkbox>;

export const Unchecked: Story = { args: { checked: false } };
export const Checked: Story = { args: { checked: true } };

export const Disabled: Story = {
  args: { checked: false, disabled: true },
};
export const DisabledChecked: Story = {
  args: { checked: true, disabled: true },
};

export const NoLabel: Story = { args: { label: undefined } };

export const AllStates: Story = {
  render: () => (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <Checkbox checked={false} label="Non selezionata" />
      <Checkbox checked={true} label="Selezionata" />
      <Checkbox checked={false} disabled label="Disabilitata" />
      <Checkbox checked={true} disabled label="Disabilitata e selezionata" />
    </div>
  ),
};
