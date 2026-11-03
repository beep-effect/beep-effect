# Cache baseline review: the W7 kit (`@beep/git` members, `patientGit` moved to repo-run)

Reviewed 2026-11-03 for the W7 kit PR of `goals/repo-cli-gh-git-consolidation` (SPEC D-17).

`bun run beep lint policy-fingerprint` reported drift on four seals after the kit PR moved `patientGit` and
`PATIENT_GIT_OPTIONS` out of `commands/Yeet/internal/GitExec.ts` into the new library file
`internal/repo-run/PatientGit.ts`, re-exported from the repo-run barrel: `@beep/repo-cli#lint:policy-fingerprint:goals-doctor`,
`:holds`, `:knowledge` and `:quality`. The cause is the new file, not a task configuration change. Those closures
already reach `internal/repo-run/index.ts`, and the barrel now re-exports `PatientGit.ts`, so the file joins them.
`bun run beep lint policy-fingerprint --write` adds that one input to the four seals in `turbo.json` and
`standards/policy-tools.fingerprint.json`, and changes nothing else.

`bun run beep quality cache-policy` reports 0 blocking findings and one `configuration-source-drift: turbo.json`
review note. Commands, outputs, cache flags and environment are unchanged, and no manifest changes. Recording the `//`
and `@beep/repo-cli` subjects accepts the new input lists. No qualification is granted, and no other subject changes.
