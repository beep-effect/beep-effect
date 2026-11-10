# Declaration-Only Builds Spec

## Objective

Declaration-Only Builds (graduated from explorations/build-pipeline-simplification).

## Non-Goals

- <Out-of-scope behavior, package, workflow, migration, or policy.>

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

- <Package, app, docs, workflow, or artifact this goal may change.>

## Constraints

- <Hard requirement, boundary rule, compatibility concern, or quality bar.>

## Acceptance Criteria

- [ ] <Observable result that proves the goal is complete.>
- [ ] No unrelated refactors or formatting churn.

## Verification Matrix

| Check | Command or evidence | Required result |
| --- | --- | --- |
| Packet launcher size | `test "$(wc -m < goals/declaration-only-builds/GOAL.md)" -le 4000` | Passes |
| Manifest JSON | `jq . goals/declaration-only-builds/ops/manifest.json` | Passes |
| Whitespace | `git diff --check -- goals/declaration-only-builds` | Passes |

## Stop Conditions

- Required source files are missing or materially contradictory.
- Any spend: purchases, paid services, quota top-ups or plan changes need the
  operator.
- The same blocker repeats after reasonable investigation.

Scope growth, destructive side effects and policy calls are not stops: decide
them and record each as a decision file.

## Decision log

Record each decision as its own file under `decisions/` (`bun run beep goals
decisions add declaration-only-builds --title "..." --reversal "..."`); the block below is
generated from that directory and never edited by hand.

<!-- beep:decisions:begin -->
_Generated from [`decisions/`](./decisions/) by `bun run beep goals decisions write --slug declaration-only-builds`; add a `kind: decision` file there, never edit this block._

_No decision files yet._

<!-- beep:decisions:end -->

## Exception Ledger

| Exception | Scope | Owner | Rationale | Removal condition |
| --- | --- | --- | --- | --- |
| None | N/A | N/A | N/A | N/A |
