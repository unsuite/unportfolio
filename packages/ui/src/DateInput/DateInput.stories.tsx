import type { Meta, StoryObj } from "@storybook/react-vite";
import { DateInput } from "./DateInput";

const meta: Meta<typeof DateInput> = {
  title: "Components/DateInput",
  component: DateInput,
  tags: ["autodocs"],
  args: {
    value: "2026-07-09",
  },
  argTypes: {
    value: { control: "text" },
    disabled: { control: "boolean" },
  },
};

export default meta;
type Story = StoryObj<typeof DateInput>;

export const Default: Story = { args: { value: "2026-07-09" } };
export const Empty: Story = { args: { value: "" } };
export const Disabled: Story = { args: { value: "2026-07-09", disabled: true } };
