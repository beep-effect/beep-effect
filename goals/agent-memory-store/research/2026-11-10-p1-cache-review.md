# P1 cache baseline review — 2026-11-10

Subjects: `//`, `@beep/agent-memory-store`. Reviewer: Claude Opus 5.5 medium, lane
`feat/agent-memory-store-p1`.

`bun run beep quality cache-policy` on the P1 head reports eight blocking
findings, all introduced by this branch:

- `BLOCK configuration-drift` for the eight cached task slots of
  `@beep/agent-memory-store`: `build`, `check`, `docgen`, `lint`,
  `lint:deprecated-apis`, `lint:jsdoc`, `lint:laws`, `test`

It also reports `REVIEW configuration-source-drift: turbo.json`, which is not
blocking and is inherited: this branch leaves `turbo.json` byte-identical to
`origin/main`.

## What drifted

Two manifest edits change the reviewed projection of every task slot:

- `dependencies`: P1 adds the workspace dependency `@beep/sqlite` (the memory
  log and the projector open their database through it), so every `^build`
  task gains `@beep/sqlite#build` as an upstream computation.
- `commandDigest`: the digest covers the whole scripts block, and the
  `coverage` script now runs `bunx --bun vitest` so the Bun-only SQLite suites
  count toward coverage, the form `@beep/sqlite` already uses.
  `bun run beep lint package-scripts` reports no drift for the manifest.

Commands, cache flags, inputs, outputs, environment declarations, epoch and
qualification scope are unchanged. This review grants no qualification, no
reuse and no exception; it records the new dependency edge and script digest.

## Root source drift

The baseline on `origin/main` (written by #3041) records `turbo.json` at
`d952d9ac43e96765c0f84bc1c5f66a13930e6adf5ecb3dfa093f5e3ade7cbc8b`, while
`origin/main`'s `turbo.json` is
`1e94137a09bb8421dbdd73a876d51bdbfef9f8d45cc61073c45fdf19171d6ef2`: #3038
changed `turbo.json` and #3041 re-recorded the baseline against its own copy.
That non-blocking `configuration-source-drift` is inherited, and the
baseline writer refuses to record the `@beep/agent-memory-store` subject
without also stamping `//` while it stands. No root task node changed: the
census differs from the baseline only in the twelve
`@beep/agent-memory-store` task slots (eight cached) and in that one source
digest. The `//` stamp records `origin/main`'s `turbo.json` bytes unchanged
and grants nothing.

Exact reviewed input bytes (SHA-256):

- `turbo.json` (identical to `origin/main`):
  `1e94137a09bb8421dbdd73a876d51bdbfef9f8d45cc61073c45fdf19171d6ef2`

- `packages/tooling/library/agent-memory-store/package.json`:
  `35ef95e4b51cfe8cb3fce39e65c2dc36cfc515a954dd3d9d1367bf42c5bb882e`
- prior `standards/cache-qualification-baseline.json`:
  `1a7673542165eb6fda16ace9680f269af954238add9a0f4e98417378530e242e`
