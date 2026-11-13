# Cache review for YEET-08 slice 1 (2026-11-13)

Reviewed on branch `claude/stoic-torvalds-00017b`, on top of `eee4f58f460`.
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
`turbo.json`. The root `turbo.json` is byte-identical to `origin/main` on this
head (`git diff origin/main -- turbo.json` is empty): its REVIEW row is the
baseline lagging main. `beep cache baseline` refuses a request that leaves it
unreviewed, so the request re-stamps the `//` subject for origin/main's
unchanged root `turbo.json` bytes only, with no task, input or qualification
change.

## What changed

One input set changed for both drifted tasks: the declared `inputs` grew by
the three document paths above. `@beep/repo-cli#coverage` gains the same
three inputs and is not in the qualification scope. Commands, cache flags,
outputs, environment, upstream edges, epoch and qualification scope are
unchanged; inputs only grow, and no qualification or exception is granted.
