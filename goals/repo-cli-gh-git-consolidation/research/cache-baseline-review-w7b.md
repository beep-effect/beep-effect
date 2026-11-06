# Cache baseline review: W7b (command-group git and gh sites onto the kits)

Reviewed 2026-11-03 for the W7b lane of `goals/repo-cli-gh-git-consolidation` (SPEC D-19).

`bun run beep lint policy-fingerprint` reported drift on two seals after W7b moved the goals completion and doctor
reads onto `@beep/git` and `@beep/github`: `@beep/repo-cli#lint:policy-fingerprint:goals-doctor` and `:knowledge`.
The cause is the import graph, not a task configuration change. `Goals/CompletionEvidence.ts` now reads hosted
manifests through `GitHubContent.getFileOption`, so `packages/drivers/github/src/GitHubContent.ts` joins both
closures. `Goals/Goals.errors.ts` stays in them: the lane first dropped it when `Goals/Doctor.ts` stopped folding git
failures into `GoalsGitError`, but `main` (#2702, #2704) gave the doctor a `GitCommandErrorAdapter<GoalsGitError>` for
its decision and research projections, so after the 2026-11-06 merge of `main` (4036568938) the input is back.
`bun run beep lint policy-fingerprint --write` adds that one input in the two seals of `turbo.json` and
`standards/policy-tools.fingerprint.json`, and changes nothing else.

Re-stamped 2026-11-06 on `main` 4036568938. The baseline refused the two subjects alone because `main` carries an
unreviewed `configuration-drift` on every `@beep/html` and `@beep/technical-drawing` task since #2686
(`fix(codegen): preserve generated sources during drift checks`): that PR changed both manifests (`generate:check`
now runs `scripts/generate.ts --check`, a `@beep/codegen-kit` workspace dependency, technical-drawing tsconfig
includes) without re-stamping the baseline. Those two packages join this request's subjects so the registry reads
`main`'s configuration again; their task commands, outputs, cache flags and environment are otherwise unchanged and
no qualification is granted to them either.

`bun run beep quality cache-policy` reports 0 blocking findings and one `configuration-source-drift: turbo.json`
review note. Commands, outputs, cache flags and environment are unchanged, and no manifest changes. Recording the `//`
and `@beep/repo-cli` subjects accepts the new input lists. No qualification is granted, and no other subject changes.
