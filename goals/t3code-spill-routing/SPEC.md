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
- a new `t3code-fleet` runbook under the runbooks docs: the spill order and how to read the
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
  dankserver as the last resort. tbk-worker goes after beep-worker (latch
  released 2026-11-07). Skip a host whose T3 environment is unreachable,
  already at its one-job limit, or missing the checkout, credentials or data
  boundary the work needs.
- Launch through T3 tools (`t3_thread_launch` / `delegate_task` with the
  target `environmentId`) using the model routing policy's pins. Spilling
  never changes the model or the provider.
- The rule is advisory. The orchestrator logs which host it chose and why in
  its ledger. The operator can always override.

## Acceptance Criteria

- [x] The MemAvailable-0 sample is explained in `history/`.
- [x] The threshold table and the spill rule are in `orchestrate` and the
      runbook.
- [x] One drill: with a simulated or real breach, the orchestrator follows
      the rule, launches on beep-worker through T3, and records the decision
      in its ledger. A sanitized receipt goes in `history/`.
- [x] The PR is merged through `/yeet`.

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

<!-- beep:decisions:begin -->
_Generated from [`decisions/`](./decisions/) by `bun run beep goals decisions write --slug t3code-spill-routing`; add a `kind: decision` file there, never edit this block._

### Restore the PSI sampler at a durable path, 2026-11-08

The sampler and its data were retired with $HOME/workstation-diagnostics on 2026-11-02 while the unit still pointed there, so it failed on every tick. The sampler now lives under $HOME/.local/share/beep-psi and writes $HOME/.local/state/beep-psi/safe-pressure.jsonl with a 14-day ring, in the same record format and still without per-process scans. The spec called for read-only analysis; this goes further because a threshold table that must be re-derived needs a live recorder. The baseline itself uses the preserved data.

Lane `t3code-goals-closeout`

Reverse: Run systemctl --user disable --now beep-psi-sample.timer and daemon-reload, which stops new samples and leaves history in place. Do not restore the previous drop-in alone: it names the retired path and fails every tick

### Closeout lands in one PR by operator ruling, 2026-11-08

The operator ruled on 2026-11-08 that these three goals reach completed-retained in one single PR, regardless of the packets' two-PR closeout, to keep the merge queue clear. So this PR commits status completed-retained with a closeout record naming itself, instead of a proposedCloseout adopted later. That puts the committed record ahead of its evidence: set-status guards only the proposal path, and no completion receipt can exist before the merge. The session that owns the closeout lane runs the refresh after merge and reads each packet's outcome; if that session has ended, the orchestrator does. Refresh records an outcome without failing or reopening anything, so for any outcome other than verified, that owner opens a packet-state PR reopening the packet.

Lane `t3code-goals-closeout`

Reverse: In a packet-state PR, run goals set-status <slug> active, delete the proposedCloseout it leaves (a matching verified receipt would otherwise still project the packet as completed), and set the reopened phase back to pending

### tbk-worker takes its second slot; grok-bot stays out of the spill order, 2026-11-08

The operator released tbk-worker's latch on 2026-11-07, so it takes the slot after beep-worker that the spec reserved. grok-bot joined the fleet after the order was set and is left out, because it sleeps unless the operator holds its view open; an advisory rule should not pick a host that may not answer. Use it when asked.

Lane `t3code-goals-closeout`

Reverse: Edit the order in the orchestrate skill's Where to launch section

<!-- beep:decisions:end -->

## Exception Ledger

| Exception | Scope | Owner | Rationale | Removal condition |
| --- | --- | --- | --- | --- |
| None | N/A | N/A | N/A | N/A |
