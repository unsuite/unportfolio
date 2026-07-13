import type { Meta, StoryObj } from "@storybook/react-vite";
import { Link } from "./Link";

const meta: Meta<typeof Link> = {
  title: "Components/Link",
  component: Link,
  tags: ["autodocs"],
  args: {
    children: "Apri le impostazioni",
    href: "#",
    variant: "accent",
    external: false,
  },
  argTypes: {
    variant: { control: "inline-radio", options: ["accent", "muted"] },
    external: { control: "boolean" },
  },
};

export default meta;
type Story = StoryObj<typeof Link>;

export const Accent: Story = {
  args: { variant: "accent", children: "Apri le impostazioni" },
};

export const Muted: Story = {
  args: { variant: "muted", children: "unportfolio v2.1.0" },
};

export const External: Story = {
  args: {
    variant: "accent",
    external: true,
    href: "https://beancount.github.io",
    children: "Documentazione beancount",
  },
};

export const AllVariants: Story = {
  render: () => (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <Link variant="accent" href="#">
        Apri le impostazioni
      </Link>
      <Link variant="muted" href="#">
        unportfolio v2.1.0
      </Link>
    </div>
  ),
};
