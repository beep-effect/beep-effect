# Lane Bootstrap Spec

## Objective

Creating a lane is one command. `beep worktree add` targets `<fleet>/lanes/<slug>` (seat recorded in the registry, not in the path), installs dependencies and verifies the hardlink backend is in effect, exports the shared `TURBO_CACHE_DIR=~/.cache/beep/turbo` for the lane, seeds the graft index from the ops seat when it exists and from the lane's owning seat otherwise, and writes the registry row. Lanes created elsewhere (`<clone>/.claude/worktrees/*`, `~/.codex/worktrees/*`, ad hoc siblings) are adopted into the registry by the fleet scan with role `adopted`.

Brief and decisions: [`explorations/agent-fleet-layout/BRIEF.md`](../../explorations/agent-fleet-layout/BRIEF.md), [`explorations/agent-fleet-layout/DECISIONS.md`](../../explorations/agent-fleet-layout/DECISIONS.md). Depends on: [`goals/fleet-root-registry`](../../goals/fleet-root-registry/README.md)

## Non-Goals

- A new install backend or shared `node_modules` scheme (Bun hardlinks already dedupe).
- Fighting the desktop app's or Codex's worktree placement.
- Deleting anything.
- Rewriting `standards/git-worktrees.md` (that lands with `legacy-drain`).

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

- `packages/tooling/tool/cli/src/commands/Worktree/` (`add`, managed-root derivation)
- registry writer from `fleet-root-registry`
- graft seed path (`beep graft deep` sibling seed) and `~/.cache/beep/turbo`

## Constraints

- Depends on `goals/fleet-root-registry` for the fleet root and registry schema.
- No dependency on `goals/ops-seat-timers`: the graft seed source is `seats/ops` when present, else the owning seat; a missing seed degrades to a warning, never a failed bootstrap.
- The shared turbo cache is already the default for CLI-driven runs and direnv shells; bootstrap covers the invocation paths that bypass both.
- Install verification is a check, not a feature: assert link count > 1 on a sampled file; fail loud if the backend fell back to copy.
- Shared `TURBO_CACHE_DIR` across seats needs the residue reap's size cap applied.
- Never create a lane under `/tmp`.

## Acceptance Criteria

- [ ] `bun run beep worktree add demo-lane` from any seat creates `<fleet>/lanes/demo-lane`, a registry row with the owning seat, a populated `node_modules` with hardlinked files, and a `.turbo` that resolves to the shared cache dir.
- [ ] The same command succeeds on a fleet with no `seats/ops`, seeding graft from the owning seat.
- [ ] A worktree created by the desktop app under `.claude/worktrees` appears in the registry with role `adopted` after one fleet scan.
- [ ] `bun run beep quality package-verify @beep/repo-cli` passes.
- [ ] No unrelated refactors or formatting churn.

## Verification Matrix

| Check | Command or evidence | Required result |
| --- | --- | --- |
| Packet launcher size | `test "$(wc -m < goals/lane-bootstrap/GOAL.md)" -le 4000` | Passes |
| Manifest JSON | `jq . goals/lane-bootstrap/ops/manifest.json` | Passes |
| Package handoff | `bun run beep quality package-verify @beep/repo-cli` | Passes |
| Whitespace | `git diff --check -- goals/lane-bootstrap` | Passes |

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
