# Cache baseline review — 2026-09-12 (C3.3 follow-up through C3.6, PR #1102)

Reviewer: goal-executor (time-to-certainty). Scope unchanged: the reviewed legacy settings stay
limited to `@beep/identity#lint` and `@beep/types#lint`; no task gains cache qualification.

## What changed in `turbo.json`

- 38 new `//#` root tasks (the lint-policy sublanes, Repo Sanity rows and Fallow envelopes) and the
  `doctest` package task, all per `goals/time-to-certainty/research/c3-lane-task-table.md` §2
  (revision 8). D2 rows and the binary walkers are `cache: false`; the whole-tree rows exclude
  `.git/**`.
- `lint:oxlint` gains `--quiet --disable-nested-config`; `//#fallow:health:check` joins the D2 group.

## Why the audit reports drift

The baseline projection fingerprints every cached task against the effective Turbo configuration;
a `turbo.json` edit is a global input, so every package task shows `configuration-drift`, and the new
tasks show `unreviewed-expansion`. Neither changes any package task's own definition: the package
rows were re-read from the same `turbo.json` entries (`build`, `check`, `test`, `lint*`, `docgen`,
`audit`) and only the root graph grew. This review accepts the new projection as the reviewed
legacy settings, exactly as the 2026-09-12 todox review accepted new workspace edges, without
granting qualification to any computation.

Evidence: `research/c3-456-implementation.md` (Stages C–E and hosted round 1),
`research/c3-456-economics.md`, the root-task dry-run fixtures in
`packages/tooling/tool/cli/test/root-tasks-turbo-inputs.test.ts`.
