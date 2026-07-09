import type { Meta, StoryObj } from "@storybook/react-vite";
import { CodeBlock } from "./CodeBlock";

const meta: Meta<typeof CodeBlock> = {
  title: "Components/CodeBlock",
  component: CodeBlock,
  tags: ["autodocs"],
  args: {
    variant: "block",
    children: "bun run scripts/prices.ts",
  },
  argTypes: {
    variant: { control: "inline-radio", options: ["block", "inline"] },
    selectAll: { control: "boolean" },
  },
};

export default meta;
type Story = StoryObj<typeof CodeBlock>;

export const Block: Story = {
  args: {
    variant: "block",
    children: "bun run scripts/prices.ts --file ledger/prices.beancount",
  },
};

export const BlockMultiline: Story = {
  args: {
    variant: "block",
    children: "cd unportfolio\nsh init.sh\nbun run scripts/prices.ts",
  },
};

export const SelectAll: Story = {
  args: {
    variant: "block",
    selectAll: true,
    children: "curl -fsSL https://unportfolio.app/init.sh | sh",
  },
};

export const Inline: Story = {
  args: { variant: "inline", children: "accounts.toml" },
};

export const InlineInText: Story = {
  render: () => (
    <p style={{ fontFamily: "var(--font-sans)", color: "var(--color-text)" }}>
      Il movimento tocca il conto <CodeBlock variant="inline">Assets:Bank:Checking</CodeBlock> con
      divisa <CodeBlock variant="inline">EUR</CodeBlock>.
    </p>
  ),
};
