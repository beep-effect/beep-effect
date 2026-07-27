# OpenClaw Workstation Agent Plan

## Status

Status: `in-progress`

## Phases

| Phase | Status | Goal | Exit criteria |
| --- | --- | --- | --- |
| P0 Prototype gauntlet | complete (2026-07-27) | Run the four hard-gating spikes on the workstation per the executable per-spike contract in [`ops/handoffs/p0-gauntlet-contract.md`](./ops/handoffs/p0-gauntlet-contract.md) (isolation boundaries, pinned inputs, operator prerequisites, assertions, cleanup, evidence format). | Every contract assertion demonstrated with evidence under `history/p0/`; the writer compatibility matrix produced; any failed assertion re-opens its gated decision in `SPEC.md` Decision Log BEFORE later phases run. Timebox: ~first fifth of the cycle; exhaustion = stop and reshape. |
| P1 Driver | pending (next) | Build `@beep/openclaw`: desired-intent Effect schema, versioned render adapter for the pinned OpenClaw version, CLI process wrapper (version/doctor read-only/validate/service control/`secrets reload`), liveness+readiness+acceptance probes. | Rendered output passes the pinned binary's plugin-aware `config validate` + negative fixtures; CI fails on lossy schema-export placeholders for declared extension surfaces; Node/OpenClaw/plugin/adapter/fixtures versioned as one compatibility set; package green under repo gates; PR mergeable via `/yeet`. |
| P2 Generation engine + applicator | pending | Build the OpenClawGeneration renderers, the staged upgrade state machine (incl. the permanent version-bump rollback checklist), the workstation-local applicator (preflight + identity binding), drift audit, and the `infra/openclaw` Pulumi project; prove the first vertical slice. | Minimal generation deployed healthy via `pulumi up`; second-generation switch with proven rollback; drift audit demonstrates detection across its normative inventory (generation pointer, package/Node version, unit content, enabled/active state, config) plus wrong-identity preflight failure; BOTH backup classes (encrypted Pulumi state + encrypted SQLite snapshots) land on dankserver with a restore drill; PR mergeable via `/yeet`. |
| P3 Live agent | pending | Render persona (SOUL.md), guardrails, Telegram (`configWrites: false`) + Control UI; unless cut by a dated SPEC decision-log entry: hosted primary + local provider profile and one benign proof skill (per SPEC definition); work the auth bootstrap runbook. | Telegram DM round-trip + Control UI reachable; writer compatibility matrix verified against the live channel; acceptance probe set green (authenticated completion, local-provider probe, skill inventory/hash, secret degradation, synthetic send/receive — probe entries for cut items drop with their cut); PR mergeable via `/yeet`. |
| P4 Close | pending | Closeout: evidence archived, statuses flipped, reflection written. | Packet status and evidence updated; closeout reflection exists and `bun run beep lint reflection-artifacts` passes. |

## P4 Closeout Checklist

Before marking the packet closed (`status` → `completed-retained`):

1. Write a closeout reflection via the `/reflect` skill (or copy this
   packet's [`history/reflections/_TEMPLATE.md`](./history/reflections/_TEMPLATE.md))
   to `history/reflections/<YYYY-MM-DD>-<agent>.md`. Critique the repo **tooling**
   (what worked, what didn't, what was frustrating, what you wished existed), the
   **implementation** (improvement opportunities), and the **goal/prompt** (would
   you revise it to be clearer/easier/more efficient?). Capture TODOs worth
   codifying. Its YAML frontmatter must validate against `ReflectionFrontmatter`.
2. Run `bun run beep lint reflection-artifacts` (this packet has
   `reflectionRequired: true`, so a missing/invalid reflection blocks closeout).
3. Update `README.md` (status, latest evidence) and `ops/manifest.json` phase
   statuses + `initiative.status`.

## Execution Notes

- **Appetite is binding**: one focused cycle with ~the first fifth allocated
  to the gauntlet (see `SPEC.md`). Sanctioned cuts when threatened: proof
  skill, local-model provider profile — exercised via a dated SPEC
  decision-log entry that updates acceptance, this plan, the manifest, and
  the README together. Failed P0 spikes re-open decisions; they do not
  extend the budget.
- Bulk implementation and gate-review judgment run as separate session
  roles; the operator's session routing lives outside the repo.
- Spike code is disposable but its evidence is not — archive spike notes,
  commands, and outcomes under `history/`.
- P1/P2 boundary is soft (the render adapter and generation renderers
  co-evolve); the P0→P1 boundary is hard.
- Preserve unrelated worktree changes; keep `SPEC.md` normative and update it
  only when the contract changes.
- Workstation mutations (config root, unit, workspace) go through the
  applicator only — no hand edits outside spike sandboxes.

## Verification Commands

```sh
test "$(wc -m < goals/openclaw-workstation-agent/GOAL.md)" -le 4000
jq . goals/openclaw-workstation-agent/ops/manifest.json
rg -n "openclaw-workstation-agent|GOAL.md|agentLaunchers|packetAnchorDocument" goals/openclaw-workstation-agent
git diff --check -- goals/openclaw-workstation-agent
bun run beep yeet verify
bun run beep lint reflection-artifacts
```
