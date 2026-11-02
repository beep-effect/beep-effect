# Cache baseline review: W1b (Yeet's git layer onto `@beep/git`)

Reviewed 2026-11-02 for W1b of `goals/repo-cli-gh-git-consolidation` (SPEC D-09, PR #2546).

`bun run beep quality cache-policy` reported 2 blocking findings on the merged head, both introduced by this branch
and both configuration drift on the root's policy-fingerprint seals: `//#lint:policy-fingerprint:goals-doctor` and
`//#lint:policy-fingerprint:knowledge`.

The cause is one import move. `internal/repo-run/GitWorktree.ts` and `internal/repo-run/TmpfsReap.ts` lose their
leaf `Effect.provideServiceEffect(Git, Git.make)` provisions and take `Git` from their callers, and Yeet's
`internal/GitExec.ts` now exports the `adaptGitKitError`-based helpers (`captureGitKitExit`, `patientGit`,
`PATIENT_GIT_OPTIONS`) that those repo-run modules and the Yeet steps share, so the goals-doctor and knowledge
policy closures now reach `packages/tooling/tool/cli/src/commands/Yeet/internal/GitExec.ts`.
`bun run beep lint policy-fingerprint --write` adds that one input to each of the two seals in `turbo.json` and
`standards/policy-tools.fingerprint.json` (the W1a seal rows carry over unchanged). No package manifest changes and
no dependency is added or removed; `tsconfig-sync --check` reports no drift.

Recording the root subject accepts the existing posture for the two re-sealed tasks. No qualification is granted,
and no other subject changes.
