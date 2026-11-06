# Cache baseline review: W7 runner retirement (census rows X1-X10)

Reviewed 2026-11-06 for the runner-retirement lane of `goals/repo-cli-gh-git-consolidation` (SPEC D-21).

`bun run beep lint policy-fingerprint` reported drift on two seals after the retirement deleted the generic runners
(`runGitOutput`, `runGitPathList`, `runGitLines`, `runGitRawOutput` and their private capture helpers) from
`internal/repo-run/GitExec.ts`: `@beep/repo-cli#lint:policy-fingerprint:goals-doctor` and `:knowledge`. The cause is
the import graph, not a task configuration change. `Goals/Doctor.ts` moved its one `ls-files --others --ignored`
read onto `runRepoCommandCaptureRaw` (KEEP, no kit member) and dropped the `GoalsGitError` adapter that read went
through, so `Goals/Goals.errors.ts` leaves both closures. `bun run beep lint policy-fingerprint --write` drops that
one input in the two seals of `turbo.json` and `standards/policy-tools.fingerprint.json`, and changes nothing else.

`bun run beep quality cache-policy` reports 0 blocking findings and one `configuration-source-drift: turbo.json`
review note. Commands, outputs, cache flags and environment are unchanged, and no manifest changes. Recording the `//`
and `@beep/repo-cli` subjects accepts the new input lists. No qualification is granted, and no other subject changes.
