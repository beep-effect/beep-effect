# Cache baseline review: W7b (command-group git and gh sites onto the kits)

Reviewed 2026-11-03 for the W7b lane of `goals/repo-cli-gh-git-consolidation` (SPEC D-19).

`bun run beep lint policy-fingerprint` reported drift on two seals after W7b moved the goals completion and doctor
reads onto `@beep/git` and `@beep/github`: `@beep/repo-cli#lint:policy-fingerprint:goals-doctor` and `:knowledge`.
The cause is the import graph, not a task configuration change. `Goals/CompletionEvidence.ts` now reads hosted
manifests through `GitHubContent.getFileOption`, so `packages/drivers/github/src/GitHubContent.ts` joins both
closures; `Goals/Doctor.ts` no longer folds git failures into `GoalsGitError`, so `Goals/Goals.errors.ts` leaves
them. `bun run beep lint policy-fingerprint --write` adds that one input and drops that one input in the two seals of
`turbo.json` and `standards/policy-tools.fingerprint.json`, and changes nothing else.

`bun run beep quality cache-policy` reports 0 blocking findings and one `configuration-source-drift: turbo.json`
review note. Commands, outputs, cache flags and environment are unchanged, and no manifest changes. Recording the `//`
and `@beep/repo-cli` subjects accepts the new input lists. No qualification is granted, and no other subject changes.
