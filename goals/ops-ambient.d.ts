/**
 * Ambient module types for goals ops scripts, checked by `goals/tsconfig.ops.json`.
 *
 * They live here, not under a packet's `ops/`, because `beep goals doctor` requires every `*.ts`
 * under `ops/` to be a registered ops script.
 */

// effected-promotion/ops/github-reporting-gfm-differential.ts stamps its report with the oracle
// versions. Neither package lists `./package.json` in `exports`, so the compiler cannot resolve the
// subpath; Bun loads it anyway. Only `version` is read.
declare module "micromark/package.json" {
  const manifest: { readonly version: string };
  export default manifest;
}

declare module "micromark-extension-gfm/package.json" {
  const manifest: { readonly version: string };
  export default manifest;
}

// The frozen lexical-playground-capability-atlas P0 exercise harness (ops/exercise) imports
// fast-json-stable-stringify, which left the install with ESLint (#1813). The harness cannot run
// as-is; this declaration (the one call shape it uses) keeps the rest of it under the compiler gate.
declare module "fast-json-stable-stringify" {
  const stableStringify: (value: unknown) => string;
  export default stableStringify;
}
