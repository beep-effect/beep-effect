# Cache baseline review: @beep/infra-github is a new workspace (2026-11-13)

Reviewer: Claude Opus 5.5 (the P3 GitHub lane of `goals/infra-alchemy-rebuild`). No qualification is
granted.

`@beep/infra-github` is created by `bun run beep create-package` with the generated scripts block, so
`bun run beep quality cache-policy` reports `unreviewed-expansion` for its eight cached computations:
`build`, `check`, `docgen`, `lint`, `lint:deprecated-apis`, `lint:jsdoc`, `lint:laws` and `test`. They are
the same generated tasks every tooling package carries; no script was hand-edited.

What the package adds to their inputs beyond the generated shape:

- `tsconfig.json` includes `alchemy.run.ts` and `ruleset-guard.ts` beside `src` (`rootDir` is the package
  root), the shape of the sibling turbo cache and cost-controls stacks, so `build` and `check` typecheck the
  stack entry and the pre-write guard command;
- `test/fixtures/census.json` is a committed snapshot of non-secret repository settings that `test` reads;
- dependencies `@alchemy.run/aws`, `@alchemy.run/github`, `@distilled.cloud/github` (the pre-write re-read of
  the ruleset), `@effect/platform-bun` (the guard command's runtime),
  `alchemy`, `@beep/identity`, `@beep/schema`, `effect`, and dev dependency `@alchemy.run/test`.

Re-recorded 2026-11-14 after merging `main` at Alchemy 2.0.0-beta.87, and again after merging #3322 and #3299:
each merge took main's baseline, so both subjects are stamped again. The review-round-1 wave adds the
`@distilled.cloud/github` dependency and new source and test files inside the package's default inputs; no
command, output or environment changes.

Re-recorded again 2026-11-14 after merging `main` with #3325 (`@beep/infra-hosts`, 6d366333e22), which took main's
baseline. The create-guard wave adds source and test files inside the package's default inputs only; no command,
output or environment changes.

No task reads the network or a credential: the stack tests serve GitHub from an in-memory fake, and nothing
writes outside the declared outputs. Recording `@beep/infra-github` adds its computations to the reviewed
baseline as legacy settings. No task becomes cacheable, no exception row is added, and scope, profile and
epoch are unchanged.

## Root subject `//`

The root manifest changes in two places only: the `workspaces` list gains
`packages/tooling/infra/github` (written by `create-package`), and the catalog gains
`"@alchemy.run/github": "2.0.0-beta.86"`, the Alchemy version already pinned. No root script, Turbo task,
output or environment changes. One generated input list changes:
`bun run beep lint policy-fingerprint --write` adds `packages/tooling/infra/github/package.json` to the
inputs of `//#lint:policy-fingerprint` in `turbo.json` (and the matching entry in
`standards/policy-tools.fingerprint.json`), because the fingerprint covers every workspace manifest. The
task's command, outputs and environment are unchanged.
