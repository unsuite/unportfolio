import type { Meta, StoryObj } from "@storybook/react-vite";
import { Button } from "../Button/Button";
import { Tooltip } from "./Tooltip";

const meta: Meta<typeof Tooltip> = {
  title: "Components/Tooltip",
  component: Tooltip,
  tags: ["autodocs"],
  args: {
    content: "Stima prospettica, non un valore realizzato.",
    placement: "top",
  },
  argTypes: {
    placement: { control: "inline-radio", options: ["top", "bottom"] },
    content: { control: "text" },
  },
};

export default meta;
type Story = StoryObj<typeof Tooltip>;

export const SuTesto: Story = {
  render: (args) => (
    <p style={{ fontFamily: "var(--font-sans)", color: "var(--color-text)" }}>
      Rendimento{" "}
      <Tooltip {...args}>
        <span
          style={{
            textDecoration: "underline dotted",
            textUnderlineOffset: 3,
            cursor: "help",
          }}
        >
          MWRR
        </span>
      </Tooltip>{" "}
      del periodo.
    </p>
  ),
};

export const SuBottone: Story = {
  render: (args) => (
    <Tooltip {...args} content="Ricalcola i prezzi dal terminale.">
      <Button variant="neutral">Aggiorna prezzi</Button>
    </Tooltip>
  ),
};

export const Bottom: Story = {
  args: { placement: "bottom", content: "Compare sotto il trigger." },
  render: (args) => (
    <Tooltip {...args}>
      <Button variant="accent">Passa il mouse</Button>
    </Tooltip>
  ),
};
