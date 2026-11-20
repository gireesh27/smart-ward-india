// Stylesheets are imported only for their side effect (Next.js bundles them). TypeScript 6, which
// recent VS Code versions use by default, checks such imports (noUncheckedSideEffectImports), so it
// needs to be told that .css files are modules.
declare module "*.css";
