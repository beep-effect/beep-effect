# Cache qualification baseline re-record (2026-10-14)

Reviewer: Claude Opus 5.5 (`feat/ts7-ts-native-api`).

## What changed

Three subjects change posture because their manifests change; no turbo input,
output, environment key or cache flag changes, and no qualification is granted.

- `@beep/repo-utils`: new dependencies `@typescript/native` and `@effect/tsgo`
  (the `TsNativeApi` service), and `beep:test` splits so `test/TsNativeApi.test.ts`
  runs under Node vitest, because TypeScript 7's unstable sync API does not run
  under Bun.
- `@beep/effect-drizzle`: new dev dependencies `@beep/repo-utils`,
  `@typescript/native` and `@effect/platform-node`; `typescript` is dropped
  (tstyche 8 loads its targets from its own store); `beep:test` splits the
  import-boundary test onto Node vitest for the same reason; tsconfig-sync adds
  the `@beep/repo-utils` project reference.
- `@beep/scratchpad`: the `audit:effect-ontology-docs` script and its deleted
  script go away; `typescript` becomes `@typescript/native`.

## Why the baseline needs a new record

The baseline binds each subject's scripts and dependency edges, so the
manifest edits above read as configuration drift for every task of the three
subjects. The tasks' commands, inputs, outputs and cache flags are otherwise
unchanged.

## Evidence

`bun run beep cache audit` before the record: 18 `configuration-drift`
blocks, all on these three subjects (9 repo-utils, 8 effect-drizzle,
1 scratchpad).
