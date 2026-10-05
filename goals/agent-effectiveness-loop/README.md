# Agent Effectiveness Loop

## Status

Lifecycle: `completed-retained`

Source: [`ops/manifest.json`](./ops/manifest.json)

Phase 1 shipped and merged on 2026-05-20 through
[PR #167](https://github.com/beep-effect/beep-effect/pull/167) and
[PR #168](https://github.com/beep-effect/beep-effect/pull/168). The deferred
Phase 2/3 tranches were split into two follow-up packets that were later
deleted and absorbed by `agent-pipeline-velocity` (see Notes). Packet format
and state were last audited on 2026-10-05; no scope changed.

## Mission

Create a repo-specific feedback loop that uses Phoenix, the existing AI metrics
stack, and read-only worker-eval evidence to improve how coding agents operate
in this repo: better repo guidance, better evals, better diagnostics, and
better operator workflows for seeing where agents struggle. Phoenix is a tool
in the loop, not the owner of repo semantics.

## Launch

This packet is **not execution-capable** (`executionCapable: false`) and has no
`GOAL.md`. Its delivered scope is closed, merged, and retained as evidence.
Do not reopen it; new agent-effectiveness work belongs in
[`goals/coding-agent-effectiveness-evidence-loop`](../coding-agent-effectiveness-evidence-loop/README.md),
which names this packet as a retained brick in its non-goals.

## Read This First

1. [`SPEC.md`](./SPEC.md) - normative source of truth (retained contract).
2. [`PLAN.md`](./PLAN.md) - phase ledger; all phases complete.
3. [`ops/manifest.json`](./ops/manifest.json) - machine-readable routing.
4. [`research/SOURCES.md`](./research/SOURCES.md) - provenance ledger.
5. [`research/README.md`](./research/README.md) - Phase 0 research lane index.
6. [`history/`](./history/) - live proof, closeout, and reflection.

## Current Phase

P4 Close - complete. Next concrete action: none in this packet. Successor work
runs in `coding-agent-effectiveness-evidence-loop` (active as of 2026-09-25).

## Latest Evidence

- Merge: PR #167 (`dee0dfd6e8`) and PR #168 (`c6b9dc987d`), both merged
  2026-05-20 with the hosted check matrix green; recorded in
  [`history/outputs/phase1-closeout.md`](./history/outputs/phase1-closeout.md).
- Live read-only proof of the doctor and annotation-check loop:
  [`history/outputs/phase1-live-proof.md`](./history/outputs/phase1-live-proof.md).
- Reflection (on-demand, codex):
  [`history/reflections/2026-08-29-codex.md`](./history/reflections/2026-08-29-codex.md).
- Staleness audit 2026-10-05: the `beep agent-effectiveness` command group
  still exists in `@beep/repo-cli` with the seven Phase 1 subcommands, and the
  default Phoenix target in code is unchanged.

## Implemented Surfaces

Phase 1 delivered these report-only and guarded commands:

- `beep agent-effectiveness doctor --json`
- `beep agent-effectiveness annotations plan --json`
- `beep agent-effectiveness annotations check --json`
- `beep agent-effectiveness datasets bundle --json`
- `beep agent-effectiveness prompts bundle --json`
- `beep agent-effectiveness experiments bundle --json`
- `beep agent-effectiveness phoenix sync --json`

The doctor and annotation commands inspect Phoenix reachability and project
inventory, local AI metrics evidence, and the JSDoc worker-eval report, then
produce sanitized metadata-only annotation proposals. The bundle commands
produce deterministic Phoenix-ready payloads. Sync defaults to dry-run and
requires an explicit confirmation token before any Phoenix write.

Implementation homes:

- `packages/tooling/library/ai-metrics/src/agent-effectiveness.ts`
  (`@beep/repo-ai-metrics`: report schemas, evidence aggregation, privacy checks)
- `packages/tooling/tool/cli/src/commands/AgentEffectiveness/`
  (`@beep/repo-cli`: operator commands and rendering)

The `beep agent-effectiveness evals` subcommand that now sits in the same
group was added later by `skillopt-training-pilot` (PR #309, 2026-07-06) and
`harness-evidence-ledger` (PR #1362, 2026-10-01). It is outside this packet's
scope and is owned by those packets.

## Research Artifacts

Phase 0 research lanes, indexed in [`research/README.md`](./research/README.md):

- [Phoenix capability map](./research/phoenix-capability-map.md)
- [Live Phoenix state audit](./research/live-phoenix-state-audit.md)
- [Repo eval and metrics surface audit](./research/repo-eval-metrics-surface-audit.md)
- [Agent-effectiveness opportunity map](./research/agent-effectiveness-opportunity-map.md)
- [Synthesis and ranked execution plan](./research/synthesis-ranked-execution-plan.md)

## Notes

- **Inputs.** This packet consumed `goals/ai-metrics-stack` (now
  `completed-retained`, PR #647, 2026-08-10) and `goals/jsdoc-worker-eval`
  (`completed-retained`). The Phase 1 default worker-eval evidence is the
  2026-05-16 Runpod/Ollama Qwen3-Coder 30B packet under
  `goals/jsdoc-worker-eval/history/outputs/`.
- **Follow-up packets are gone.** `goals/agent-effectiveness-phoenix-enrichment`
  and `goals/agent-effectiveness-workflow-integration` (split out on
  2026-05-20) were superseded by `goals/agent-pipeline-velocity` on 2026-07-05
  and deleted in the portfolio consolidation (PR #401, 2026-07-14).
  `agent-pipeline-velocity` merged as PR #295 on 2026-07-06 and is itself
  `completed-retained`; its absorbed constraints live in
  `goals/agent-pipeline-velocity/history/absorbed-constraints.md`. Phoenix-native
  enrichment (datasets, experiments, evals-on-traces, prompt comparison) and
  live-write workflows were never executed and are not tracked by any packet
  today; `coding-agent-effectiveness-evidence-loop` consumes the AI metrics
  stack and Phoenix as reusable bricks instead.
- **Live Phoenix.** The deployed instance on the tailnet
  (`https://dankserver.tailc7c348.ts.net:8447`) is read-only by default for
  this packet; the merged sync path is confirmation-gated and was never used as
  closeout proof.
- **Privacy.** Research and history artifacts carry sanitized evidence only:
  project names, aggregate counts, feature availability, schema and attribute
  names, hashed identifiers, and links. No raw transcripts, private paths,
  secrets, or raw span payloads.
- **Format history.** Authored 2026-05-16 before `explorations/` existed (no
  source exploration); renamed and split 2026-05-20; migrated to
  `initiative-manifest/v2` by PR #855 (2026-08-27); aligned to
  `goals/_template` on 2026-10-05.
