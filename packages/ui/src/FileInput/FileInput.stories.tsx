import type { Meta, StoryObj } from "@storybook/react-vite";
import { FileInput } from "./FileInput";

const meta: Meta<typeof FileInput> = {
  title: "Components/FileInput",
  component: FileInput,
  tags: ["autodocs"],
  args: {
    label: "File CSV da importare",
    accept: ".csv",
  },
  argTypes: {
    label: { control: "text" },
    accept: { control: "text" },
    multiple: { control: "boolean" },
    disabled: { control: "boolean" },
  },
};

export default meta;
type Story = StoryObj<typeof FileInput>;

export const Default: Story = {};

export const WithoutLabel: Story = { args: { label: undefined } };

export const Multiple: Story = {
  args: { label: "File CSV multipli", multiple: true },
};

export const Disabled: Story = { args: { disabled: true } };
