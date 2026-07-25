# OpenClaw Workstation Agent Plan

## Status

Status: `pending`

## Phases

| Phase | Status | Goal | Exit criteria |
| --- | --- | --- | --- |
| P0 Prototype gauntlet | pending | Run the four hard-gating spikes on the workstation: (1) filesystem bypass/drift under the root-owned config root, (2) non-interactive `systemd --user` apply (linger, `XDG_RUNTIME_DIR`, DBus) from the exact Pulumi context, (3) same-ref secret rotation + `secrets reload` + degraded detection, (4) upgrade + forced failed-health rollback across SQLite `user_version` stamps (incl. WAL snapshot/restore). | All four pass with evidence archived in `history/`; any failure re-opens its gated decision in `SPEC.md` Decision Log BEFORE later phases run. |
| P1 Driver | pending | Build `@beep/openclaw`: desired-intent Effect schema, versioned render adapter for the pinned OpenClaw version, CLI process wrapper (version/doctor read-only/validate/service control/`secrets reload`), liveness+readiness+acceptance probes. | Rendered output passes the pinned binary's plugin-aware `config validate` + negative fixtures; package green under repo gates; PR mergeable via `/yeet`. |
| P2 Generation engine + applicator | pending | Build the OpenClawGeneration renderers, the staged upgrade state machine, the workstation-local applicator (preflight + identity binding), drift audit, and the `infra/openclaw` Pulumi project; prove the first vertical slice. | Minimal generation deployed healthy via `pulumi up`; second-generation switch with proven rollback; drift canary catches a manual edit; state backup lands off-machine; PR mergeable via `/yeet`. |
| P3 Live agent | pending | Render persona (SOUL.md), guardrails, Telegram (`configWrites: false`) + Control UI, hosted primary + local provider profile, one declarative proof skill; work the auth bootstrap runbook. | Telegram DM round-trip + Control UI reachable; acceptance probe set green (authenticated completion, local-provider probe, skill inventory/hash, secret degradation, synthetic send/receive); PR mergeable via `/yeet`. |
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

- **Appetite is binding**: one focused cycle (see `SPEC.md`). Sanctioned cuts
  when threatened: proof skill, local-model provider profile. Failed P0
  spikes re-open decisions; they do not extend the budget.
- Implementation volume routes to claudex sessions per the global routing
  doctrine; Fable sessions own gate judgment and synthesis.
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
