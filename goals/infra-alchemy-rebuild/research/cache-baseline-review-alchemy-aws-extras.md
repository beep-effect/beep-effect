# Cache baseline review: new package @beep/alchemy-aws-extras (2026-11-13)

Reviewer: Claude Opus 5.5, P2 aws-extras lane. No qualification is granted.

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

## Root subject `//`, this lane

`bun run beep lint policy-fingerprint --write` adds
`packages/tooling/library/alchemy-aws-extras/package.json` to the generated `inputs` list of
`//#lint:policy-fingerprint` in `turbo.json` and to `standards/policy-tools.fingerprint.json`, because the
fingerprint covers every workspace manifest. That task's command, outputs, environment and dependency edges are
unchanged; it only reads one more manifest.

## Dependency edge `@beep/utils`

The package gains the workspace dependency `@beep/utils` (for `Option.getSomesStruct`), so `build`, `check`,
`lint:deprecated-apis` and `test` drift through the new upstream edge. Their commands, outputs and environment
are unchanged.
