# Ops Seat Timers Spec

## Objective

The timers today bake three different clones (`beep-effect0` for graft/refs, `beep-effect5` for residue reap, tmpfs reap and portfolio-watch, `beep-effect7` for research). Every renderer learns the fleet root and renders against `seats/ops`; units that are hand-written today (residue-reap, tmpfs-reap, portfolio-watch) gain a renderer so they can be re-rendered the same way. After this goal no installed unit names a `beep-effect<x>` path.

Brief and decisions: [`explorations/agent-fleet-layout/BRIEF.md`](../../explorations/agent-fleet-layout/BRIEF.md), [`explorations/agent-fleet-layout/DECISIONS.md`](../../explorations/agent-fleet-layout/DECISIONS.md). Depends on: [`goals/fleet-root-registry`](../../goals/fleet-root-registry/README.md)

## Non-Goals

- Changing what any timer does or its schedule.
- Running `graft init`, `beep graft deep refresh`, `beep refs refresh` or fresh `install-timer` forms (agent-forbidden); only `--refresh` re-renders.
- Retiring the old clones (that is `legacy-drain`).

## Source Hierarchy

1. User objective or issue that created this packet.
2. `AGENTS.md`, `CLAUDE.md`, and required skills.
3. Governing architecture/package standards.
4. This `SPEC.md`.
5. `PLAN.md`.
6. `GOAL.md`.
7. Supporting `research/`, `ops/`, and `history/` files.

Higher sources outrank lower sources when they conflict.

## Target Surfaces

- `packages/tooling/tool/cli/src/commands/Research/internal/Timers.ts`, `Research.render.ts`
- `commands/Refs/Refs.command.ts`, `commands/Graft/` install-timer renderers
- new renderers for residue-reap, tmpfs-reap, portfolio-watch, ai-metrics forwarder units
- `docs/runbooks/systemd-timers.md`

## Constraints

- Depends on `goals/fleet-root-registry` for the fleet-root setting.
- Installed units are snapshots; they stay stale until re-rendered, and only `beep research install-timers --refresh`, `beep graft deep install-timer --refresh`, `beep refs install-timer --refresh` are agent-permitted installer forms.
- Never move or stop an active `beep-proof-*` unit.
- The ops seat tracks `main` only; nobody tinkers in it.

## Acceptance Criteria

- [ ] `systemctl --user cat` of every `beep-*` timer-backed service shows `<fleet>/seats/ops` and no `beep-effect<x>` path.
- [ ] Each renderer has a `--refresh` path exercised by a test that renders against a temp fleet root.
- [ ] `docs/runbooks/systemd-timers.md` lists every unit, its renderer and its refresh command.
- [ ] `bun run beep quality package-verify @beep/repo-cli` passes.
- [ ] No unrelated refactors or formatting churn.

## Verification Matrix

| Check | Command or evidence | Required result |
| --- | --- | --- |
| Packet launcher size | `test "$(wc -m < goals/ops-seat-timers/GOAL.md)" -le 4000` | Passes |
| Manifest JSON | `jq . goals/ops-seat-timers/ops/manifest.json` | Passes |
| Package handoff | `bun run beep quality package-verify @beep/repo-cli` | Passes |
| Whitespace | `git diff --check -- goals/ops-seat-timers` | Passes |

## Stop Conditions

- Required source files are missing or materially contradictory.
- The implementation would exceed named scope.
- Verification requires credentials, cost, destructive side effects, or policy
  approval not named in this spec.
- The same blocker repeats after reasonable investigation.

## Decision Log

Seeded from the exploration; entries here cover only decisions taken inside this goal.

| Date | Decision | Source |
| --- | --- | --- |
| 2026-10-05 | Scope, non-goals and constraints inherited from the exploration brief, rabbit holes and no-gos. | `explorations/agent-fleet-layout/DECISIONS.md` |

## Exception Ledger

| Exception | Scope | Owner | Rationale | Removal condition |
| --- | --- | --- | --- | --- |
| None | N/A | N/A | N/A | N/A |
