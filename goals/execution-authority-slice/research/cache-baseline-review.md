# Cache-policy baseline re-record for the execution-authority slice move (2026-11-07)

Reviewer: Claude Opus 5.5 (`goals/execution-authority-slice` P1, lane `execution-authority-slice`).

## What changed

1. Five workspace packages are added: `@beep/execution-authority-{domain,use-cases,tables,server,config}`
   under `packages/execution-authority/`, each created with `bun run beep create-package`. Their
   `build`, `check`, `docgen`, `lint`, `lint:deprecated-apis`, `lint:jsdoc`, `lint:laws` and `test`
   computations are the generated per-package defaults (the 40 `unreviewed-expansion` rows);
   `bun run beep lint package-scripts --write` reports 0 drifting manifests.
2. `@beep/epistemic-config` is deleted (`bun run beep delete-package`), and its source moves to
   `@beep/execution-authority-config`.
3. Manifest edges change for three existing packages, which is the input change behind their
   `configuration-drift` rows:
   - `@beep/epistemic-server`: drops `@beep/epistemic-config`, `@beep/api-transport` and
     `@beep/mcp-kit` (only the moved governed gate and egress used them) and its execution exports.
   - `@beep/db-admin`: adds `@beep/execution-authority-tables` and, for tests,
     `@beep/execution-authority-domain` and `@effect/platform-node`, plus the regenerated tsconfig
     references.
   - `@beep/professional-desktop`: replaces `@beep/epistemic-config` with the four
     `@beep/execution-authority-*` packages it imports, plus the regenerated tsconfig references.
4. Root `turbo.json`: the `globalEnv` keys `EPISTEMIC_EGRESS_DESTINATION_ALLOWLIST` and
   `EPISTEMIC_POLICY_REVISION` become `EXECUTION_AUTHORITY_*` (no fallback), and the
   `//#lint:policy-fingerprint` manifest input list swaps `packages/epistemic/config/package.json`
   for the five new manifests. Together these explain `global-configuration-drift`, the
   `//#lint:policy-fingerprint` row and the `configuration-source-drift` REVIEW rows.

No command, output, cache flag or qualification changes. Nothing is widened and no exception rows
are added.

## Evidence

- `bun run beep cache audit` before this record: 56 blocking findings, all of the kinds above.
- `bun run beep tsconfig-sync` and `bun run beep lint package-scripts --write`: no remaining drift.
