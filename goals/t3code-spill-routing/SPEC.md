# T3 Code Spill Routing Spec

## Objective

When DankStation is compute-constrained, the orchestrator sends new
substantive beep-effect work to another host. It reads DankStation's host
pressure before each launch and, above the thresholds, launches the thread
on the next host in spill order through T3.

Graduated from [explorations/t3code-fleet-driver](../../explorations/t3code-fleet-driver/README.md).
The settled decisions are `spill-policy-automation` and `spill-order` in
its [DECISIONS.md](../../explorations/t3code-fleet-driver/DECISIONS.md). The
signal and baseline are in
[fleet-hosts.md](../../explorations/t3code-fleet-driver/research/fleet-hosts.md#dankstation-compute-signal-for-spill-when-constrained).

## Non-Goals

- An automatic dispatcher, a daemon or a new beep service. That is the gated
  `t3code-spill-dispatcher` candidate in the exploration MAP.
- Pressure feeds from remote hosts.
- Moving work that is already running.

## Source Hierarchy

1. The exploration's DECISIONS.md.
2. `AGENTS.md`, `CLAUDE.md`, and the `orchestrate` skill as rewritten by
   `goals/t3-native-orchestration`.
3. This `SPEC.md`.
4. `PLAN.md`.
5. `GOAL.md`.

## Target Surfaces

- `.claude/skills/orchestrate/SKILL.md`: a "Where to launch" rule and its
  threshold table.
- `docs/runbooks/t3code-fleet.md`: the spill order and how to read the
  signal.
- Read-only analysis of the live PSI recorder output, at the path given in
  fleet-hosts.md.

## Constraints

- Explain the MemAvailable-0 sample in the baseline before any memory
  threshold uses it. Record whether it is a recorder artifact or a real
  event.
- Thresholds are set from the 7-day baseline. They use the parcel's
  existing fields, are stated as a table in the skill, and are re-derived
  if the recorder changes.
- Spill order: beep-worker, then tom-pc-1 (one job at a time), then
  dankserver as the last resort. tbk-worker goes after beep-worker only
  once its latch is released. Skip a host whose T3 environment is
  unreachable or already at its one-job limit.
- Launch through T3 tools (`t3_thread_launch` / `delegate_task` with the
  target `environmentId`) using the model routing policy's pins. Spilling
  never changes the model or the provider.
- The rule is advisory. The orchestrator logs which host it chose and why in
  its ledger. The operator can always override.

## Acceptance Criteria

- [ ] The MemAvailable-0 sample is explained in `history/`.
- [ ] The threshold table and the spill rule are in `orchestrate` and the
      runbook.
- [ ] One drill: with a simulated or real breach, the orchestrator follows
      the rule, launches on beep-worker through T3, and records the decision
      in its ledger. A sanitized receipt goes in `history/`.
- [ ] The PR is merged through `/yeet`.

## Verification Matrix

| Check | Command or evidence | Required result |
| --- | --- | --- |
| Signal | `bun run beep palantiri parcel host-pressure --json` | Decodes; fields named in the table exist |
| Drill | `history/` receipt | Spill decision and remote launch recorded |
| Repo | `bun run beep yeet verify` | Passes |

## Stop Conditions

- `goals/t3code-fleet-rollout` has no live host to spill to. This goal
  waits.
- The parcel lacks a field the rule needs, and adding it would mean new
  telemetry code. Report it.
- Any spend.

## Decision Log

| Date | Decision | Reason | How to reverse |
| --- | --- | --- | --- |
| 2026-11-01 | The first cut is an advisory rule, not a dispatcher | Reuses the existing signal and T3 launch; no daemon | Delete the rule |
| 2026-11-01 | Spill order: beep-worker, tom-pc-1, dankserver | Fitness and in-use constraints | Edit the table |

## Exception Ledger

| Exception | Scope | Owner | Rationale | Removal condition |
| --- | --- | --- | --- | --- |
| None | N/A | N/A | N/A | N/A |
