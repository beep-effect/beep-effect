# Legacy Drain Spec

## Objective

Residue reap gains a `drainable` class: a checkout is drainable only when all of these hold past a grace window: no open PR; no active `beep-proof-*` unit; liveness confirmed not-live (an `unknown` liveness reading blocks the drain until a readable check confirms inactivity); a clean tree; no local-only work (every local branch, tag and stash is reachable from a remote ref, or has first been preserved in a `git bundle` under `~/.local/state/beep`); and, for a clone, no linked worktree still registered to it (owned lanes retire before their clone, checked with `git worktree list`, because removing the clone removes the `.git` store those lanes live in). Legacy clones are registered with role `legacy` on day one and drain under the same rule, in waves, with the three former timer hosts last. `beep-effect-cutover` is archived. `standards/git-worktrees.md` is rewritten for the seats-and-lanes layout.

Brief and decisions: [`explorations/agent-fleet-layout/BRIEF.md`](../../explorations/agent-fleet-layout/BRIEF.md), [`explorations/agent-fleet-layout/DECISIONS.md`](../../explorations/agent-fleet-layout/DECISIONS.md). Depends on: [`goals/fleet-root-registry`](../../goals/fleet-root-registry/README.md), [`goals/lane-bootstrap`](../../goals/lane-bootstrap/README.md), [`goals/ops-seat-timers`](../../goals/ops-seat-timers/README.md)

## Non-Goals

- Any hard cutover date.
- Moving a live checkout, a dirty lane, or a lane with an active proof unit.
- Touching `beep-effect-private` (separate repository, own fleet).
- Deleting ai-metrics data.

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

- `packages/tooling/tool/cli/src/internal/repo-run/ResidueReap.ts` (new reap class) and its schemas
- `beep worktree remove --archive`, `yeet sweep --retire` live-checkout fence (reuse)
- `standards/git-worktrees.md`, `AGENTS.md` Quality Operator worktree bullet

## Constraints

- Depends on `goals/fleet-root-registry` (drainable predicate reads the registry), `goals/lane-bootstrap` (new work must already land in `lanes/` through the sanctioned path) and `goals/ops-seat-timers` (timer hosts must be free first).
- `unknown` liveness is a blocker, never a pass; the census had 205 of 223 checkouts at `unknown`.
- Local-only work is preserved before removal: unpushed branches, tags and stashes are bundled to `~/.local/state/beep` and the bundle is verified (`git bundle verify`) before the checkout is touched.
- Clone-level drain is ordered: every worktree registered to the clone retires first; a clone with any registered worktree is not drainable.
- Read `git worktree list` from every seat; do not trust the mirror's per-root grouping until the undercount is explained.
- Reaper checks `beep-proof-*` units before trees.
- Every reap is journaled with what was removed and why; dry-run first wave.

## Acceptance Criteria

- [ ] `bun run beep quality residue-reap --fleet --json` reports a `drainable` class with per-checkout reasons, dry-run by default.
- [ ] First apply wave removes only checkouts that met the predicate for the full grace window; journal shows PR, unit, confirmed liveness, dirty, local-only-ref and owned-worktree checks per removal.
- [ ] A fixture checkout with an unpushed branch and a stash is not removed until its bundle exists and verifies; a fixture clone with a registered worktree is refused; a fixture checkout with `unknown` liveness is refused.
- [ ] Disk usage across the registered legacy Beep roots is reported before and after each wave.
- [ ] `standards/git-worktrees.md` documents seats, lanes, registry, adoption and drain.
- [ ] `bun run beep quality package-verify @beep/repo-cli` passes.
- [ ] No unrelated refactors or formatting churn.

## Verification Matrix

| Check | Command or evidence | Required result |
| --- | --- | --- |
| Packet launcher size | `test "$(wc -m < goals/legacy-drain/GOAL.md)" -le 4000` | Passes |
| Manifest JSON | `jq . goals/legacy-drain/ops/manifest.json` | Passes |
| Package handoff | `bun run beep quality package-verify @beep/repo-cli` | Passes |
| Whitespace | `git diff --check -- goals/legacy-drain` | Passes |

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
