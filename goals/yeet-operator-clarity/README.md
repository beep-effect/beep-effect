# Yeet Operator Clarity

## Status

Lifecycle: `superseded`

Source: [`ops/manifest.json`](./ops/manifest.json)

## Mission

Make Yeet cheaper and clearer for autonomous agents to operate: one local-first
status command, opt-in compact summaries, and remediation hints that point at
the actual failed lane instead of noisy tail output.

## Launch

Use this command for execution-capable sessions:

```text
/goal follow the instructions in goals/yeet-operator-clarity/GOAL.md
```

`GOAL.md` is the compact launcher. `SPEC.md` remains the normative contract.

## Read This First

1. [`GOAL.md`](./GOAL.md) - compact `/goal` launcher.
2. [`SPEC.md`](./SPEC.md) - normative source of truth.
3. [`PLAN.md`](./PLAN.md) - active execution plan.
4. [`ops/manifest.json`](./ops/manifest.json) - machine-readable routing.
5. [`research/grounding.md`](./research/grounding.md) - doctrine and prior-packet grounding.
6. [`history/`](./history/) - evidence and closeouts.

## Relationship To Other Packets

This packet succeeds [`goals/yeet-agent-ergonomics`](../yeet-agent-ergonomics/)
for the next operator-clarity wave. PR #230 shipped dirty-worktree publish,
base-freshness checks, verdicts, PR creation, and explicit closeout write-backs.
This packet keeps that completed evidence intact and adds a smaller follow-up
surface focused on status, summaries, and better diagnosis.

## Current Phase

P5 closeout in progress. P0-P4 are implemented and focused proof is green; the
remaining work is full Yeet proof plus publish/monitor closeout.

## Latest Evidence

2026-06-11:

- Added local-first `bun run beep yeet status` with `--remote`, `--json`, and
  `status.json` artifact support.
- Added opt-in `--summary` handling for monitor, closeout, and
  publish-with-monitor paths.
- Updated remediation hint selection to prefer failure-local output windows.
- Updated `.claude/skills/yeet/SKILL.md` with the new operator path.
- Passed focused Yeet tests, `@beep/repo-cli` check/lint, packet checks,
  `docgen:local`, and repo export catalog generation/check.

## Notes

- This is repo CLI tooling work, owned by `packages/tooling/tool/cli`.
- Compact output is opt-in first; existing Yeet defaults remain compatible.
- `yeet status` is local-first by default and uses `--remote` for GitHub calls.
