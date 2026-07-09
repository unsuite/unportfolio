import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { StorybookConfig } from "@storybook/react-vite";

// Le pagine Product/* importano i PDR markdown dalla root docs/product/ (?raw),
// che sta fuori da questa app: apri l'accesso fs del dev server alla root.
const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");

/**
 * Storybook è la vetrina dei design token e la superficie di revisione dei
 * prodotti (ADR-0006, ADR-0007). Aggrega le pagine locali (Foundations,
 * Product/) e — quando esisteranno — le storie co-locate in apps/web.
 */
const config: StorybookConfig = {
  stories: [
    "../src/**/*.mdx",
    "../src/**/*.stories.@(ts|tsx)",
    "../../web/src/**/*.mdx",
    "../../web/src/**/*.stories.@(ts|tsx)",
    "../../../packages/ui/src/**/*.mdx",
    "../../../packages/ui/src/**/*.stories.@(ts|tsx)",
  ],
  addons: [
    "@storybook/addon-docs",
    "@storybook/addon-a11y",
    {
      name: "storybook-design-token",
      options: {
        designTokenGlob: "../../packages/ui-tokens/**/*.css",
      },
    },
  ],
  framework: {
    name: "@storybook/react-vite",
    options: {},
  },
  viteFinal: (config) => ({
    ...config,
    server: {
      ...config.server,
      fs: { ...config.server?.fs, allow: [...(config.server?.fs?.allow ?? []), repoRoot] },
    },
  }),
  typescript: {
    reactDocgen: "react-docgen-typescript",
  },
};

export default config;
