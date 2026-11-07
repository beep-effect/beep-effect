# Cache-policy baseline re-record for PR 2a (2026-11-06)

Reviewer: Claude Opus 5.5 (`goals/alchemy-postgres-driver`, PR 2a of `goals/alchemy-vault-sync-slice`).

## What changed

`@beep/alchemy-postgres` gained one workspace dev dependency, `@beep/pglite`,
for its PGlite conformance project. `bun run beep tsconfig-sync` adds the
matching project reference, which moves the dependency-edge digest of the
package's `build`, `check`, `lint:deprecated-apis` and `test` computations
(the four `configuration-drift` rows). No command, input glob, output,
environment key or cache flag changes, and no qualification is granted.

The record also re-stamps the `configuration-source-drift` review row on
`packages/foundation/primitive/types/turbo.json` (subject `@beep/types`) and
the root subject. That drift is inherited from `main`: this branch does not
edit the file. Recording it here accepts main's current `@beep/types` turbo
configuration as reviewed; it changes no command, input, output or cache flag.

## Evidence

- `bun run beep quality cache-policy` before this record: 4 blocking
  findings, all `configuration-drift` on `@beep/alchemy-postgres#*`.
- `bun run beep quality package-verify @beep/alchemy-postgres`: lint, audit,
  docgen ok; conformance suite 26 tests green on `Domain.InMemory` and PGlite.
