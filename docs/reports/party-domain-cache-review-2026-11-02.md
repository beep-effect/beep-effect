# Cache baseline review: `@beep/party-domain` admission (2026-11-02)

#2588 added the workspace package `@beep/party-domain` (`packages/party/domain`)
and registered `packages/party/domain/package.json` as an input of the root
`//#lint:policy-fingerprint` task in `turbo.json`. It did not re-record the cache
baseline, so `bun run beep cache audit` on main `ff06c7acb8` reports nine
blocking findings, and every pull request's cheap-gates `quality:cache-policy`
lane fails:

- `unreviewed-expansion` for the eight `@beep/party-domain` tasks: `build`,
  `check`, `docgen`, `lint`, `lint:deprecated-apis`, `lint:jsdoc`, `lint:laws`
  and `test`;
- `configuration-drift` for `//#lint:policy-fingerprint`, whose input list
  gained the new manifest.

## What this records

The new package's tasks come from the generated package-scripts block and the
shared per-package Turbo task definitions, the same shape as every other
`packages/*/domain` workspace. The root task changed only by one input path. No
command, output, cache flag or environment key changed. The review re-records
the legacy posture of `//` and `@beep/party-domain` at the current bytes and
grants no qualification.
