# Cache baseline review: new package @beep/alchemy-vercel (2026-11-13)

Reviewer: Claude Opus 5.5 (`goals/infra-alchemy-rebuild-p2-vercel`). No qualification is granted.

`bun run beep create-package` added the tooling library `@beep/alchemy-vercel`, so
`bun run beep quality cache-policy` reports `unreviewed-expansion` for each of its cached Turbo
computations: `build`, `check`, `docgen`, `lint`, `lint:deprecated-apis`, `lint:jsdoc`, `lint:laws`
and `test`. They are the generated scripts block every `create-package` tooling library carries
(declaration-only `tsrs` build and check, Biome lint, docgen, the three `beep-cli lint` laws and the
Vitest suite); none is hand-edited, and no command, output or environment differs from a sibling
tooling library. The package's inputs are its `src/`, `test/`, config files and manifest. Its tests
run against an in-memory Vercel API and read no environment variable, so the `test` computation has
no hidden input. Its dependencies are `@beep/identity`, `@beep/schema`, `@beep/utils`, `alchemy`,
`effect` and the new root catalog pin `@distilled.cloud/vercel@1.0.0-rc.18`.

Recording `@beep/alchemy-vercel` adopts its digest as a new subject. No task becomes cacheable, no
exception row is added, and scope, profile and epoch are unchanged.

## Root subject `//`, inherited from `main`

The baseline was last recorded at `3e822c71c5d` (#3242). Since then #3263, #3271, #3274 and #3276
regenerated root `turbo.json`, which the audit reports as `REVIEW configuration-source-drift:
turbo.json` on `main` itself. Comparing `turbo.json` at `3e822c71c5d` with this head, only the
generated `inputs` lists of ten root-declared tasks differ:
`@beep/repo-cli#lint:policy-fingerprint:goals-doctor`, `:knowledge`, `:lint-roadmap-refs`,
`:quality`, `:quality-bun-audit`, `:quality-changeset-graph`, `:quality-jsdoc-inventory`,
`:quality-jsdoc-module-tags`, `:quality-jsdoc-ratchet` and `:quality-tsgo-rules`, following source
files those PRs added, moved or removed. No task was added or removed, and no command, output,
environment or dependency edge changed. This lane's diff does not touch `turbo.json`; it changes the
root `package.json` catalog by one pin, which no root task's command, output or environment reads.
