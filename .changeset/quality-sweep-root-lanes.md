---
"@beep/identity": patch
"@beep/repo-configs": patch
---

Repair the findings surfaced by running every root quality and
CI script end to end.

- `beep codegen barrel` now preserves the module header and the per-export
  JSDoc blocks already authored on a committed `index.ts` barrel instead of
  replacing them with a bare `@since` stub, so `bun run codegen` is
  idempotent and no longer strips the `@beep/identity` barrel documentation.
- The deprecated-apis ESLint profile ignores `storybook-static/**`, the
  gitignored Storybook bundle whose vendored disable comments reference rules
  the profile does not register.
- The private root package moves its Impeccable detector dependencies to
  `devDependencies` (with a matching fallow `ignoreDependencies` entry),
  `@beep/ciops` declares empty `build` outputs so turbo stops warning, and
  Biome's `noUndeclaredEnvVars` allowlist names the `BEEP_*` variables that
  turbo declares under `global.passThroughEnv`, which Biome cannot read.
- Two skill documents drop incidental triple-backticks that unbalanced the
  markdown fence count for `lint:effect-imports-markdown`.
