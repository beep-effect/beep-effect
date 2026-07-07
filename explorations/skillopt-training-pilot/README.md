# SkillOpt Training Pilot

## Status

Stage: `graduate`
Status: `graduated`

Source: [`ops/manifest.json`](./ops/manifest.json)

## Spark

Every ingredient of a skill-training loop already exists in-tree (rollout
runner, benchmark storage, law-scorers, throwaway worktrees, Phoenix) but
has never been composed; SkillOpt (MIT, benchmarked inside Claude Code and
Codex CLI) is the missing optimizer. Train `schema-first-development`
against a scored repo-task eval suite — loop-runs is the bar, lift is
information.

## Next Open Question

None — graduated 2026-07-06 into
[`goals/skillopt-training-pilot`](../../goals/skillopt-training-pilot/README.md)
after same-day BRIEF sign-off and code-home decision. Execution lives in the
goal packet.

## Read This First

1. [`ops/manifest.json`](./ops/manifest.json) - machine state.
2. [`CAPTURE.md`](./CAPTURE.md) - origin dump (stage 0).
3. [`RESEARCH.md`](./RESEARCH.md) - inherited SkillOpt corpus + in-repo inventory (stage 1).
4. [`DECISIONS.md`](./DECISIONS.md) - five grill-seeded locked decisions (stage 2).
5. [`BRIEF.md`](./BRIEF.md) - shaped pitch awaiting sign-off (stage 3).

## Trail

- 2026-07-06 (b): BRIEF signed off; code home decided (extend
  `beep agent-effectiveness` + root `tools/skillopt/` uv project); MAP
  written; DoR passed; GRADUATED into `goals/skillopt-training-pilot`
  (GOAL.md 3,496 chars); ATLAS moved to Graduated.
- 2026-07-06 (a): packet opened on quality-gate-ratchets closure (PR #305/#306)
  with compressed ceremony — capture/research/align written from the grill
  session, codex recon, and the inherited agent-pipeline-velocity SkillOpt
  corpus; BRIEF drafted and presented for sign-off.
