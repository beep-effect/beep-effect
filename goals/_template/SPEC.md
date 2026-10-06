# <Goal Title> Spec

## Objective

<State the final result in observable terms.>

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
- [ ] <Observable result that proves the goal is complete.>
- [ ] No unrelated refactors or formatting churn.

## Verification Matrix

| Check | Command or evidence | Required result |
| --- | --- | --- |
| Packet launcher size | `test "$(wc -m < goals/<slug>/GOAL.md)" -le 4000` | Passes |
| Manifest JSON | `jq . goals/<slug>/ops/manifest.json` | Passes |
| Whitespace | `git diff --check -- goals/<slug>` | Passes |

## Stop Conditions

- Required source files are missing or materially contradictory.
- Any spend: purchases, paid services, quota top-ups or plan changes need the
  operator.
- The same blocker repeats after reasonable investigation.

Scope growth, destructive side effects and policy calls are not stops: decide
them and record each in the Decision Log.

## Decision Log

| Date | Decision | Reason | How to reverse |
| --- | --- | --- | --- |
| None | N/A | N/A | N/A |

## Exception Ledger

| Exception | Scope | Owner | Rationale | Removal condition |
| --- | --- | --- | --- | --- |
| None | N/A | N/A | N/A | N/A |
