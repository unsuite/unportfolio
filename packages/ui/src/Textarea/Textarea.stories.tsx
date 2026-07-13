import type { Meta, StoryObj } from "@storybook/react-vite";
import { Textarea } from "./Textarea";

const meta: Meta<typeof Textarea> = {
  title: "Components/Textarea",
  component: Textarea,
  tags: ["autodocs"],
  args: {
    placeholder: "Scrivi una nota…",
    rows: 2,
    mono: false,
  },
  argTypes: {
    mono: { control: "boolean" },
    rows: { control: "number" },
    disabled: { control: "boolean" },
  },
};

export default meta;
type Story = StoryObj<typeof Textarea>;

export const Default: Story = {};

export const WithValue: Story = {
  args: { defaultValue: "Conto corrente principale, aperto nel 2019." },
};

export const Mono: Story = {
  args: {
    mono: true,
    defaultValue: "IBAN IT60 X054 2811 1010 0000 0123 456",
  },
};

export const Disabled: Story = {
  args: { disabled: true, defaultValue: "Campo non modificabile." },
};
