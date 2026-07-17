---
"@beep/storybook": patch
"@beep/oip-web": patch
"@beep/professional-desktop": patch
"@beep/acp": patch
"@beep/box": patch
---

Make portless the only dev-server path and enable react-grab in Storybook.

- Storybook loads react-grab in the preview iframe during `storybook dev`,
  with an explicit `bippy.installRDTHook()` first (react-grab's bundled copy
  skips the install inside iframes); guarded out of `storybook build` and
  addon-vitest browser-mode runs, with a leak-guard assertion in the vitest
  setup file.
- oip-web: portless route renamed to `oip-web.beep`, `dev:raw` removed,
  `next start` wrapped; dev now rides the shared HTTP proxy
  (`PORTLESS_HTTPS` dropped — the HTTPS/h2 proxy mode breaks vite HMR
  websockets and hard-conflicts with the proxy the other apps need);
  react-grab unpkg pin bumped to catalog 0.1.48.
- professional-desktop: dev server runs through `professional-desktop.beep`
  with a 1421 fallback for the `PORTLESS=0` diagnostic bypass; tauri devUrl
  and the ontology MCP origin allowlist point at the named origin, and the
  webview CSP splits into `devCsp` (named dev origins) vs a production `csp`
  without dev-server origins but with the loopback OTLP collector (:4318)
  that packaged-build exports actually target.
- @beep/acp and @beep/box codegen scripts migrate from the `typescript`
  compiler API to `ts-morph`'s bundled `ts` (part of the same TS6/TS7 split
  below), with `ts-morph` added to their devDependencies.
- Repo-level fallout fixes from the accompanying dependency update:
  `@effect/tsgo` stays at 0.19 (0.23 ships three new lint rules whose
  mandatory global enforcement surfaces ~756 violations — adopting it is
  its own campaign); `typescript` stays at ^6 (the catalog deliberately splits classic
  `typescript` for JS-API consumers like typescript-eslint from
  `@typescript/native` at ^7 — the update had collapsed the split and broke
  `@beep/repo-configs` tests); `vitest.shared.ts` no longer uses the
  TypeScript compiler API at all — root tsconfig paths are read via
  `jsonc-parser`; and `fast-xml-validator` is pinned to 1.2.0 (its 1.3+
  range pulls a Node-only parser that references `Buffer` at module scope
  and kills every browser bundle).
