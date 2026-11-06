# Cache-policy baseline re-record for the alchemy vault-sync foundations (2026-11-06)

Reviewer: Claude Fable 5.1 (`goals/alchemy-vault-sync-slice`, lane `alchemy-vault-sync-slice`).

## What changed

1. One root computation is added: `//#lint:entity-kit-freeze`, running
   `bun run beep laws entity-kit-freeze --check`. It is cloned from
   `//#lint:retired-effect-paths`: `cache: true`, the same whole-tree inputs
   minus the generated-artifact directories, and the
   `@beep/repo-cli#lint:policy-fingerprint:laws` edge. It joins the medium
   policy phase and runs as its own cheap-gates lane in the preflight wave.
2. One workspace package is added: `@beep/alchemy-postgres`
   (`packages/drivers/alchemy-postgres`), created with
   `bun run beep create-package --family drivers`. Its `build`, `check`,
   `docgen`, `lint`, `lint:deprecated-apis`, `lint:jsdoc`, `lint:laws` and
   `test` computations are the generated per-package defaults; nothing is
   hand-edited.
3. The new root script changes the complete-workspace-script digest of every
   root computation (the 44 `configuration-drift` rows), as the
   retired-effect-paths re-record of 2026-10-14 documented for the same cause.

No other command, input, output, environment key, dependency edge or cache
flag changes, and no qualification is granted.

## Evidence

- `bun run lint:entity-kit-freeze`: 0 findings against a 64-file baseline
  (`standards/entity-kit-freeze.baseline.jsonc`); a tracked scratch importer
  failed with `findings=1`, exit 1, and was removed.
- `bun run beep quality package-verify @beep/alchemy-postgres`: lint, audit,
  docgen ok. `bun run beep quality package-verify @beep/repo-cli --quick`: ok.
- `bun run beep quality cache-policy` before this record: 53 blocking findings,
  all of the three kinds above.
