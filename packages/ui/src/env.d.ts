/**
 * Tipizzazione dei CSS Modules per il typecheck standalone di @unportfolio/ui
 * (ADR-0006). Ogni `import styles from "./X.module.css"` è un oggetto di classi.
 */
declare module "*.module.css" {
  const classes: Record<string, string>;
  export default classes;
}
