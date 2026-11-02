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
