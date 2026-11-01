# repo-cli gh/git consolidation Spec

## Objective

Move repo-cli and its tests off hand-rolled gh and git spawning onto @beep/github, @beep/git and @beep/commands, extending the kits where they lack the feature.

The work was split out of `goals/effected-promotion` by its decision W4-l. The sites are listed in
[`research/site-list.md`](./research/site-list.md).

## Non-Goals

- New GitHub or git behaviour beyond what the listed sites already do.
- The 8 partial drivers that effected-promotion R9 excluded, each with its own named kit option.
- `@beep/github`, `@beep/git` or `@beep/commands` features no listed site needs.

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

- `packages/tooling/tool/cli` (Reviewer, Yeet, Ci, Skills, Worktree, Knowledge, `internal/github`, `internal/repo-run`).
- `packages/tooling/library/ai-metrics` (`config-snapshot.ts` and the git half of #304).
- The kits that gain the missing features: `@beep/github`, `@beep/git`, `@beep/commands`.
- Tests that hand-roll a scripted spawner (`@beep/test-utils`, repo-cli, tailscale).

## Constraints

- Each kit feature lands with tests before the sites move onto it.
- Each site keeps its observable output, exit codes and error classes, proven the way effected-promotion R10 did
  (a recorded before/after differential, `research/git-adoption-differential-r10.json` there).
- One owner switch per PR, no alias left behind.

## Acceptance Criteria

- [ ] Every row of `research/site-list.md` is migrated, or carries a recorded reason it stays.
- [ ] repo-cli and ai-metrics contain no hand-rolled `gh` or `git` spawn outside the kits, except rows kept with a
      reason.
- [ ] No unrelated refactors or formatting churn.

## Verification Matrix

| Check | Command or evidence | Required result |
| --- | --- | --- |
| Packet launcher size | `test "$(wc -m < goals/repo-cli-gh-git-consolidation/GOAL.md)" -le 4000` | Passes |
| Manifest JSON | `jq . goals/repo-cli-gh-git-consolidation/ops/manifest.json` | Passes |
| Whitespace | `git diff --check -- goals/repo-cli-gh-git-consolidation` | Passes |

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
| 2026-11-01 | Packet created by effected-promotion closeout PR C (step 6) from its W4-l decision, with its site list copied from that packet's reuse ledger. It starts `paused`. | effected-promotion W4-l moved these sites out because each needs a kit feature, about 1,700 lines. | Fold the sites back into effected-promotion, per W4-l's own reversal. |

## Exception Ledger

| Exception | Scope | Owner | Rationale | Removal condition |
| --- | --- | --- | --- | --- |
| None | N/A | N/A | N/A | N/A |
