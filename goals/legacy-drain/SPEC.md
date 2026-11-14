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

- `packages/tooling/tool/cli/src/commands/Worktree/internal/ResidueReap.ts` (new reap class) and its schemas
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
- [ ] Disk across registered legacy `beep-effect*` clones is reported before and after each wave.
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

<!-- beep:decisions:begin -->
_Generated from [`decisions/`](./decisions/) by `bun run beep goals decisions write --slug legacy-drain`; add a `kind: decision` file there, never edit this block._

### Drainable class: report every fleet run, apply only on explicit --classes drainable, 2026-11-13

Evidence (2026-11-13 census): 354 fleet checkouts, 9 legacy clones, 345 linked worktrees; 330 read `unknown` liveness and none `dormant`, because 995 of 1,459 pids have unreadable cwds (954 root-owned), so the mirror's process scan never completes. Every legacy clone still has registered worktrees, carries 100 to 800 local-only commits, and `beep-effect0` borrows objects from `beep-effect` through `objects/info/alternates`.

Calls:

1. `drainable` is assessed in every `residue-reap --fleet` run (dry-run by default) but removes only when `--classes drainable` names it. `beep-residue-reap.timer` runs `--apply --fleet` with default classes; it accrues grace observations but never drains.
2. Confirmed not-live reuses `classifyFleetLiveness` with the reaper's documented cwd-probe policy (unreadable pids dropped, invoker ancestry excluded) plus transcript and tree mtime readings. Any `unknown` or failed probe blocks.
3. Checks per checkout: seat role (`legacy`/`adopted` only), retention exemption, invoking checkout, timer host, active `beep-proof-*` unit, open PR on the checked-out branch, open session-ledger row, liveness, owned worktrees (clones), object borrowers (clones lending objects through alternates), local-only work, clean tree, grace window.
4. Grace window: 7 days by default (`--drain-grace-days`), counted from the first observation at an unchanged HEAD. It lives in the registry row (`drainingSince`, `drainingHead`, `drainStatus: draining`), and a failing observation resets it.
5. Local-only work is bundled to `~/.local/state/beep/fleet/<repo-key>/drain-bundles/` and verified (`git bundle verify` plus every local-only ref listed in the bundle) before removal. Every apply-mode removal or refusal is appended to `drain-journal.jsonl` beside the registry.
6. Waves report `du` totals across registered legacy clones before and after, measured only when `drainable` is named explicitly.

Lane goals/legacy-drain

Reverse: Remove drainable from ResidueReapClass and the drain fields from FleetRegistryRow; registry rows decode without them

### Paused by operator ruling (finish board, 2026-11-13): Useful housekeeping but unstarted and overlaps lane-bootstrap, 2026-11-13

Operator ruling on 2026-11-13 (about 05:20Z, in the orchestrator session, from the Goal Finish Board triage). The ruling sets this packet to `paused`.

Triage rationale: Useful housekeeping but unstarted and overlaps lane-bootstrap.

Its dependency goals/ops-seat-timers (the `fleet/ops-seat` provider) was closed by the same ruling; resuming this packet means re-opening or re-graduating that work first.

No lane is working on it. Resume with `bun run beep goals set-status legacy-drain active` when it is picked up.

Lane chore/finish-board-pause-b1

Reverse: goals set-status legacy-drain active when it is picked up

### Resumed on operator request; ops-seat-timers replaced by a timer-host check, 2026-11-13

The operator resumed this packet on 2026-11-13 (`/goal` launch naming `goals set-status legacy-drain active`). The pause ruling said resuming means re-opening goals/ops-seat-timers first. That goal was superseded, and its only role for this packet was "timer hosts must be free first". The drain enforces that mechanically instead: a checkout that is the `WorkingDirectory` of any systemd user unit is never drainable (`timer-host` check). Every residue-reap, refs and research timer today runs from `beep-effect`, so that clone stays until its units move.

goals/lane-bootstrap stays paused. The drain only removes checkouts and never creates lanes, so it does not need the sanctioned lane path to exist; it drains whatever the fleet scan finds under the same predicate.

Lane goals/legacy-drain

Reverse: goals set-status legacy-drain paused and revert the drainable class PR

### Record the drain modules' new-file coverage rows after branch tests, 2026-11-14

The coverage ratchet flags any uncovered unit in a file with no baseline identity. Hosted job 132317218141 on 3f463c9 measured ResidueReapDrain.ts at 96.35 / 92.99 / 82.02 / 91.83 and ResidueReapDrainLive.ts at 87.32 / 87.01 / 100 / 71.42 (lines / statements / branches / functions). The next push adds tests for every reachable remaining branch: dirty tree, live process cwd, unreadable alternates, unreachable origin, a detached HEAD with an unreadable PR list, a refusal before preservation, a missing registered legacy clone, a missing HOME, and the read-only systemd defaults. Local measurement after them: ResidueReapDrain.ts 97.19 / 94.44 / 88.76 / 92.51, above the repo-cli package tier (92.3 / 92.01 / 86.93 / 90.13) on every metric. ResidueReapDrainLive.ts reaches 92.95 / 92.2 / 100 / 82.85: above the tier on lines, statements and branches, and below it on functions only through the GitHub REST default source (four closures that need the network), the HOME config-error fallback and one session-ledger mapper. What remains uncovered in ResidueReapDrain.ts is git-command failure paths, which no hermetic fixture can provoke.

The ratchet's remediation allows recording reviewer-accepted rows, as #3283 and #3296 did. The rows are the hosted values from job 132317218141. They are floors at or below the new head's measurement, and later regressions are judged against them.

Lane goals/legacy-drain · PR #3307

Reverse: Delete the ResidueReapDrain.ts and ResidueReapDrainLive.ts rows from standards/coverage.regression-baseline.jsonc and add tests until the ratchet passes without them

<!-- beep:decisions:end -->

## Exception Ledger

| Exception | Scope | Owner | Rationale | Removal condition |
| --- | --- | --- | --- | --- |
| None | N/A | N/A | N/A | N/A |
