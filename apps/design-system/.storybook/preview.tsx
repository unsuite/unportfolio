import type { Preview } from "@storybook/react-vite";
import "@unportfolio/ui-tokens/fonts.css";
import "@unportfolio/ui-tokens/tokens.css";

const preview: Preview = {
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    a11y: {
      // 'todo' = violazioni axe segnalate ma non bloccanti.
      // Passa a 'error' per far fallire la build sulle violazioni (ADR-0006).
      test: "todo",
    },
  },
};

export default preview;
