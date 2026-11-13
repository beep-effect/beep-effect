# Cache review for YEET-08 slice 1 (2026-11-13)

Reviewed on branch `claude/stoic-torvalds-00017b`, re-recorded on top of `2968573cf50`.
Reviewer: Claude Opus 5.5 medium (slice 3 of `goals/route-soundness-repair`).

Slice 3 adds `packages/tooling/tool/cli/test/yeet-final-check-docs-drift.test.ts`,
which reads three tracked documents from the repository root and fails when
they name a final-check gate that `FinalCheckGate` lacks, or omit one it has:

- `AGENTS.md` (the Quality Operator "Final" paragraph)
- `.claude/skills/yeet/SKILL.md`
- `.claude/skills/yeet/references/gates-and-proof.md` (the gate table)

A test that reads a file must re-key when that file changes, or an edit to it
replays a cached pass. The slice therefore appends the three paths as
`$TURBO_ROOT$/...` entries to the `inputs` of the `test`, `test:property` and
`coverage` tasks in `packages/tooling/tool/cli/turbo.json`. No other key,
command, output, environment variable or task changes.

## What `bun run beep cache audit` reports

On this head the audit reports two blocking findings:

- `configuration-drift` on `@beep/repo-cli#test`
- `configuration-drift` on `@beep/repo-cli#test:property`

and `configuration-source-drift` (REVIEW) on
`packages/tooling/tool/cli/turbo.json`, the edited file, and on the root
`turbo.json`. This branch does not edit the root `turbo.json`; it equals
`origin/main` at `2968573cf50` (`git diff origin/main -- turbo.json` is
empty). Its REVIEW row is main's own growth since the baseline was last
stamped: #3178 added one input,
`$TURBO_ROOT$/packages/tooling/tool/cli/src/commands/Quality/CheckCensusBuildEquivalence.ts`,
to six root tasks that already list `CheckCensus.ts`. `beep cache baseline` refuses a
request that leaves that row unreviewed, so the request re-stamps the `//`
subject for those unchanged origin/main bytes only. It changes no task,
command, output or qualification.

## What changed

One input set changed for both drifted tasks: the declared `inputs` grew by
the three document paths above. `@beep/repo-cli#coverage` gains the same
three inputs and is not in the qualification scope. Commands, cache flags,
outputs, environment, upstream edges, epoch and qualification scope are
unchanged; inputs only grow, and no qualification or exception is granted.
