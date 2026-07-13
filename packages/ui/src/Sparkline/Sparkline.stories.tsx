import type { Meta, StoryObj } from "@storybook/react-vite";
import { Sparkline } from "./Sparkline";

const meta: Meta<typeof Sparkline> = {
  title: "Components/Sparkline",
  component: Sparkline,
  tags: ["autodocs"],
  args: {
    values: [10, 12, 9, 14, 13, 17, 16, 20],
    width: 80,
    height: 22,
    strokeWidth: 1.5,
  },
  argTypes: {
    width: { control: "number" },
    height: { control: "number" },
    strokeWidth: { control: "number" },
  },
};

export default meta;
type Story = StoryObj<typeof Sparkline>;

export const Positive: Story = {
  args: { values: [10, 12, 9, 14, 13, 17, 16, 20] },
};

export const Negative: Story = {
  args: { values: [20, 18, 19, 15, 16, 12, 11, 8] },
};

export const Empty: Story = {
  args: { values: [] },
};

export const SinglePoint: Story = {
  args: { values: [42] },
};

export const Large: Story = {
  args: {
    values: [10, 12, 9, 14, 13, 17, 16, 20],
    width: 200,
    height: 48,
    strokeWidth: 2,
  },
};
