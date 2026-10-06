# Fleet Root Registry Spec

## Objective

`beep worktree fleet` discovers `<projects-root>/beep/{seats,lanes}` and the legacy `<projects-root>/beep-effect*` roots through a single fleet-root setting (working name `BEEP_FLEET_ROOT` plus a config-file equivalent, per repository), and a new joined view prints each checkout's derived mirror facts beside its authored registry facts. The registry is a schema-first, file-backed store under `~/.local/state/beep` that authors only what git cannot derive. The mirror's per-root undercount of `beep-effect0-worktrees` (35 directories, 1 attributed) is explained or fixed.

Brief and decisions: [`explorations/agent-fleet-layout/BRIEF.md`](../../explorations/agent-fleet-layout/BRIEF.md), [`explorations/agent-fleet-layout/DECISIONS.md`](../../explorations/agent-fleet-layout/DECISIONS.md). Depends on: none (first bet in the map).

## Non-Goals

- Moving, creating or deleting any checkout (that is `legacy-drain`).
- Lane creation or install wiring (that is `lane-bootstrap`).
- Timer re-render (that is `ops-seat-timers`).
- A bare shared object store.
- Changing `beep worktree fleet` output; the derived mirror stays read-only and derived (fleet-mirror SPEC).

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

- `packages/tooling/tool/cli/src/commands/Worktree/` (fleet mirror, managed root at `Worktree.service.ts:996`, `Worktree.constants.ts`)
- `packages/tooling/tool/cli/src/commands/Yeet/internal/Economics.ts` (`projectsRootOf`, `fleetCandidates`)
- `packages/tooling/tool/cli/src/internal/repo-run/ResidueReap.ts` discovery roots
- new registry schema + store module under `@beep/repo-cli` (schema -> `Context.Service` -> implementation)
- `docs/runbooks/` page for the fleet root and registry (new)

## Constraints

- Schema first: registry document, seat role and drain status are `effect/Schema` models with `LiteralKit` literal domains before any store code.
- `git rev-parse --git-common-dir` consumers (`yeet sweep --retire`, the live-checkout fence, Codex `--add-dir`) keep resolving.
- The fleet root is per repository so `beep-effect-private` can have its own fleet.
- Legacy roots stay discoverable until `legacy-drain` ends.
- Mirror undercount: until explained, nothing downstream trusts the mirror's per-root grouping for deletion decisions.

## Acceptance Criteria

- [ ] `BEEP_FLEET_ROOT` (or config equivalent) set to a fresh `<projects-root>/beep` with `seats/main` cloned is discovered by `bun run beep worktree fleet --json` alongside every legacy checkout.
- [ ] The joined view prints, for lane `agent-fleet-layout`, its mirror facts plus authored role, slug and PR number.
- [ ] The registry file decodes against its schema; `beep worktree fleet` JSON is byte-identical before and after when the fleet root is unset.
- [ ] The `beep-effect0-worktrees` count matches `git -C beep-effect0 worktree list` or the discrepancy has a named cause recorded in the reflection.
- [ ] `bun run beep quality package-verify @beep/repo-cli` passes.
- [ ] No unrelated refactors or formatting churn.

## Verification Matrix

| Check | Command or evidence | Required result |
| --- | --- | --- |
| Packet launcher size | `test "$(wc -m < goals/fleet-root-registry/GOAL.md)" -le 4000` | Passes |
| Manifest JSON | `jq . goals/fleet-root-registry/ops/manifest.json` | Passes |
| Package handoff | `bun run beep quality package-verify @beep/repo-cli` | Passes |
| Whitespace | `git diff --check -- goals/fleet-root-registry` | Passes |

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
