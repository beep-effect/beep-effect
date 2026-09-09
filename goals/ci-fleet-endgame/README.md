# CI Fleet Endgame

## Status

Lifecycle: `active`

Source: [`ops/manifest.json`](./ops/manifest.json)

## Mission

Deliver an on-demand, one-worker-per-job CI fleet and eliminate 20-minute
jobs. These are co-primary outcomes: controller adoption does not excuse slow
jobs, and performance work does not substitute for demand-shaped workers.

## Co-primary charter (operator-worded, verbatim)

1. **On-demand worker-per-job**: a system that spins up one worker per job on
   demand — "the single biggest win even if we struggle to get under
   20 minute jobs."
2. **No 20-minute jobs**: "Endgame should just mean we don't wait 20 minutes
   for any job."

Neither deliverable is subordinate to the other.

## Launch

Use this command for execution-capable sessions:

```text
/goal follow the instructions in goals/ci-fleet-endgame/GOAL.md
```

`GOAL.md` is the compact launcher. `SPEC.md` remains the normative contract.

## Read This First

1. [`GOAL.md`](./GOAL.md) — compact `/goal` launcher.
2. [`SPEC.md`](./SPEC.md) — normative source of truth.
3. [`PLAN.md`](./PLAN.md) — module-first execution sequence.
4. [`research/runner-endgame-decision-record.md`](./research/runner-endgame-decision-record.md)
   — signed adoption decision, alternatives, gaps, performance design, and
   tripwires.
5. [`ops/manifest.json`](./ops/manifest.json) — machine-readable routing.

## Current Phase

P0-P3 are complete; the asymmetric cache is live (#673/#674). P4 and P5 are
superseded into `goals/ci-fleet-residue` and `goals/ci-lane-economics`; only
P6 (final close, gated on the lane-economics 20-minute outcome) remains here.

## Binding decisions

Speed-loop [`GRILL-DECISIONS.md`](../speed-loop/research/GRILL-DECISIONS.md)
57–63 bind the adoption invariant, Pulumi-first vehicle, velocity correction,
repo-scoped GitHub App, cost gates, spot fallback, and RunsOn tripwire. The
full record is retained in this packet's `research/` directory.

## Agent routing

Implementation and research sub-agents for this packet use `gpt-6-astra`
with `xhigh` reasoning, following [root agent guidance](../../AGENTS.md#token-heavy-codex-work).
Codex CLI calls pass `--model gpt-6-astra -c 'model_reasoning_effort="xhigh"'`;
`claudex` Workflow children select `model: "gpt-6-astra(xhigh)"` explicitly.
Claude sessions orchestrate, review, and decide; Astra sub-agents implement.
This operator instruction (2026-09-08) supersedes the earlier Sol/medium rule.

## Latest Evidence

- Probe `31352410248` proved the complete one-job-one-VM lifecycle in 90
  seconds, including a 10-second teardown lag after job completion.
- Red-team run `31354960508` passed the GitHub App secret, S3, and tailnet/LAN
  denial gates on worker `beep-ci-i-042d5d6635358917a`.
- PRs #600, #603, #611, #618, and #620 established the hardened workflow,
  owned-runner foundation, and heavy-lane cutover.
- The supervised burst landed an eight-PR merge wave and supplied the
  controller/AMI/cache integration receipts.
- Decision 57 selects adopt-then-wrap; decision 59 requires module-first
  execution, with the performance layer following on its own track.
