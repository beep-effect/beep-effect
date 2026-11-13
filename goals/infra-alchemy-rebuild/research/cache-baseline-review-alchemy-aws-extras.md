# Cache baseline review: new package @beep/alchemy-aws-extras (2026-11-13)

Reviewer: Claude Opus 5.5 (`goals/infra-alchemy-rebuild-p2-aws-extras`). No qualification is granted.

`@beep/alchemy-aws-extras` is a new tooling library created with `bun run beep create-package`. Its
computations have no recorded baseline, so `bun run beep quality cache-policy` reports
`unreviewed-expansion` for each of them: `build`, `check`, `docgen`, `lint`, `lint:deprecated-apis`,
`lint:jsdoc`, `lint:laws` and `test`.

The scripts block is the generated one (`bun run beep lint package-scripts` passes); the package adds no
script, output or environment variable of its own. Its `vitest.config.ts` only inlines `alchemy` and
`@alchemy.run/*` for the test run, which changes no cache input outside the package. The opt-in live
check under `test/integration` is excluded from `test` and reads `BEEP_ALCHEMY_AWS_EXTRAS_LIVE` only when
run by hand. Recording the package adopts its digests at the generated defaults; no task becomes cacheable,
no exception row is added, and scope, profile and epoch are unchanged.

The registration in `packages/foundation/modeling/identity/src/packages.ts` changes `@beep/identity`
source only, and the audit reports no drift for `@beep/identity`.

## Root subject `//`, inherited from `main`

The baseline was last recorded at `3e822c71c5d` (#3242). Since then #3263, #3271, #3274 and #3276 regenerated
root `turbo.json`, which the audit reports as `REVIEW configuration-source-drift: turbo.json` on `main` itself.
Only the generated `inputs` lists of ten root-declared tasks differ:
`@beep/repo-cli#lint:policy-fingerprint:goals-doctor`, `:knowledge`, `:lint-roadmap-refs`, `:quality`,
`:quality-bun-audit`, `:quality-changeset-graph`, `:quality-jsdoc-inventory`, `:quality-jsdoc-module-tags`,
`:quality-jsdoc-ratchet` and `:quality-tsgo-rules`. They follow source files those PRs added, moved or removed;
no task, command, output, environment or dependency edge changed. This lane's diff does not touch `turbo.json`.

## Root subject `//`, this lane

`bun run beep lint policy-fingerprint --write` adds
`packages/tooling/library/alchemy-aws-extras/package.json` to the generated `inputs` list of
`//#lint:policy-fingerprint` in `turbo.json` and to `standards/policy-tools.fingerprint.json`, because the
fingerprint covers every workspace manifest. That task's command, outputs, environment and dependency edges are
unchanged; it only reads one more manifest.
