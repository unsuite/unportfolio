import type { Decorator, Preview } from "@storybook/react-vite";
import "@unportfolio/ui-tokens/fonts.css";
import "@unportfolio/ui-tokens/tokens.css";

/**
 * Applica il tema (light/carta · dark/terminale) scelto dalla toolbar allo scope
 * [data-theme] della root del preview, e imposta sfondo/testo dai token così i
 * componenti su superficie trasparente si vedono sul fondo giusto (PDR-0001).
 */
const withTheme: Decorator = (Story, context) => {
  const theme = context.globals.theme ?? "light";
  const root = document.documentElement;
  if (theme === "dark") root.setAttribute("data-theme", "dark");
  else root.removeAttribute("data-theme");
  document.body.style.background = "var(--color-bg)";
  document.body.style.color = "var(--color-text)";
  return <Story />;
};

const preview: Preview = {
  decorators: [withTheme],
  globalTypes: {
    theme: {
      description: "Tema (Registro)",
      defaultValue: "light",
      toolbar: {
        title: "Tema",
        icon: "contrast",
        items: [
          { value: "light", title: "Carta (light)" },
          { value: "dark", title: "Terminale (dark)" },
        ],
        dynamicTitle: true,
      },
    },
  },
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
