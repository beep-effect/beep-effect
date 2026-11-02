# Cache baseline review: shared goal completion receipts

Reviewed 2026-11-02 for `feat/shared-completion-receipts`.

`bun run beep cache audit` reported 4 blocking findings, all introduced by this
branch: configuration drift for the root subject `//` tasks
`//#lint:policy-fingerprint:goals-doctor`, `//#lint:policy-fingerprint:goals-index`,
`//#lint:policy-fingerprint:knowledge` and
`//#lint:policy-fingerprint:lint-roadmap-refs`, plus the matching
`configuration-source-drift` review row for `turbo.json`.

`goals completion refresh` and `storedGoalCompletion` now read and write
receipts through the new
`packages/tooling/tool/cli/src/commands/Goals/CompletionReceiptStore.service.ts`,
which imports `internal/state/JsonLinesStore.ts` and
`internal/state/WorkstationState.ts`. Those three files joined the import
closure of the goals doctor, goals index, knowledge and roadmap-refs policy
commands. `bun run beep lint policy-fingerprint --write` regenerated
`standards/policy-tools.fingerprint.json` and added those three paths to the
input lists of the four seal tasks in root `turbo.json`.

Commands, outputs, cache flags and dependency edges are unchanged. The only
change is the three added input paths. No qualification is granted, and no
other subject changes.

## Main merge (2026-11-02)

Merging `origin/main` took main's `standards/cache-qualification-baseline.json`
and re-ran `bun run beep lint policy-fingerprint --write`. The audit reported
the same four `//#lint:policy-fingerprint:*` configuration-drift subjects for
the same three added input paths; nothing else drifted. The re-recorded request
binds `previous` to main's baseline bytes.

## Main merge (2026-11-02, origin/main 3ceb6833db)

Merging `origin/main` brought #2516 (derived completion rendering), #2526 and others. The baseline,
`turbo.json` and `standards/policy-tools.fingerprint.json` were taken from `main` and the fingerprint
was regenerated with `bun run beep lint policy-fingerprint --write`. #2516 removed the `PortfolioIndex.ts`
→ `Completion.ts` edge, so the `goals-index` and `lint-roadmap-refs` seals no longer reach this branch's
store; the regenerated seals that do gain the three paths are `//#lint:policy-fingerprint:goals-doctor`
and `//#lint:policy-fingerprint:knowledge` (6 added input lines in `turbo.json`). `bun run beep cache audit`
then reported exactly those 2 `configuration-drift` BLOCKs on the root `//` subject. Commands, outputs and
cache settings are unchanged and no qualification is granted.
