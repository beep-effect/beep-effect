# Push-First Publish Spec

## Objective

`bun run beep yeet publish` gates a push on the deterministic cheap-gates tier
and the head-install preflight only. It pushes, opens a draft pull request by
default, applies `ready-for-heavy`, submits the detached readiness monitor, and
exits. Hosted CI and reviewers are the authoritative proof. The full local
proof (`yeet verify`) becomes an on-demand tool for iterating on a red lane,
never an automatic step on the publish path.

Operator statement that created this packet (2026-10-05): with ten or more
agents working at once, the fastest back-pressure is hosted CI and PR review
comments, not the local admission queue. The operator kept having to type
"open the PR" and "quit waiting on proof and get the fixes to PR #N pushed up".
This packet removes the need for that instruction.

## Decisions (grilled 2026-10-05, all locked)

| # | Decision | Rejected alternatives |
| --- | --- | --- |
| D1 | Pre-push gate is cheap-gates + head-install preflight. Full proof is never on the publish critical path. | No local gate; full proof with queue-depth escape; `--start-pr-early` as default (overlaps the wait, does not remove it). |
| D2 | The full local proof is dropped from publish. `yeet verify` stays as an on-demand tool. No detached post-push proof. | Detached advisory proof (burns machine capacity in parallel with hosted CI); blocking post-push proof (status quo). |
| D3 | Push-first is unconditional. | Conditional on scheduler queue depth; conditional on PR already existing. Agents cannot reliably detect a runner burst, and conditional rules are what get re-stated by hand. |
| D4 | `publish --pr` creates a **draft** PR and applies `ready-for-heavy` at creation. `yeet ready` flips draft to ready. | Ready by default with `--draft`; leave PR state to `gh`. |
| D5 | `--fast` and `--start-pr-early` are removed, with their guards, tests, and skill prose. New opt-in `--prove-first` restores the old proof order (full proof and CI parity before the push). The pull-request tail (draft, label, stamp, detached monitor) is the same on every path, including `--push-only` (review finding on #1427). The proof-shadow ledger and CI-parity step stay, fed only by on-demand `verify`. | Keep all flags and flip the default; retire the shadow ledger. |
| D6 | Push budget: one push per addressed wave of inbox rows or review threads, never per file or per comment. Cheap-gates green is a precondition of any push. | No budget rule; mass re-pushes across a fleet saturate the queue the scheduler was built for. |
| D7 | "Publish done" = pushed + draft PR + `ready-for-heavy` applied + detached `monitor --until-ready` job submitted. Publish prints the PR URL and job id, then exits. Attached `--monitor` becomes opt-in. | Pushed + PR only (forgotten monitor); attached monitor (fleet holds processes). |
| D8 | `--pr` becomes the default on a PR-less branch; `--no-pr` opts out. | Keep `--pr` opt-in. `check.yml` triggers only on `pull_request` and pushes to `main`, so a bare push produces no hosted signal at all. |
| D9 | `monitor --until-ready` gains a terminal `ready-pending-flip` (exit 0) for a draft whose only remaining blocker is the draft flag. It prints the flip command. | Auto-flip (defeats draft-until-final); keep holding (agents hand-roll `gh`). |
| D10 | `yeet ready` flips draft to ready only when, on the current head, every review thread is answered and the required checks are green. It refuses otherwise and names the blocker. No `--force`. | Threads-only gate; thin `gh pr ready` wrapper. |

### Why the full proof can leave the publish path

- `goals/ship-velocity/research/c3-local-remote-parity.md` already found the
  "green local = green CI" invariant false in practice: the local proof runs
  HEAD while GitHub proves the merge ref.
- Hosted `check.yml` runs every lane the local proof ran, including the
  gitleaks, semgrep/SAST, and Nix lanes. Nothing is left uncovered.
- Cheap-gates takes no admission token, so it never waits behind another
  session's lease. It catches the cheap, deterministic reds (knip, fallow,
  schema-first, changeset, jsdoc ratchet, config sync, tsgo rule parity) that
  would otherwise cost a hosted run.

## Non-Goals

- Changing the admission scheduler, its weights, or the `yeet-proof-lock/v4`
  fence. Fewer publish proofs reach it; its contract is unchanged.
- Changing `yeet verify`, `verify --merged`, or `verify --tier review-fix`.
- Changing hosted workflows, branch protection, or the heavy-admission label
  flow.
- Any merge automation. `merge-ready: yes` still hands the PR to the operator.
- Rewriting unrelated yeet skill sections.

## Source Hierarchy

1. The operator decisions in this spec (D1–D10).
2. `AGENTS.md`, `CLAUDE.md`, and the `yeet` skill.
3. `goals/ship-velocity/SPEC.md` for scheduler and parity doctrine it still owns.
4. This `SPEC.md`.
5. `PLAN.md`.
6. `GOAL.md`.

Higher sources outrank lower sources when they conflict.

## Target Surfaces

- `packages/tooling/tool/cli/src/commands/Yeet/internal/Planner.ts`
  (`publishSteps`, step ordering, monitor submission).
- `packages/tooling/tool/cli/src/commands/Yeet/Yeet.command.ts` and
  `Yeet.schemas.ts` (flags: remove `fast`, `startPrEarly`; add `proveFirst`,
  `noPr`; `pr` default true; new `ready` subcommand).
- `packages/tooling/tool/cli/src/commands/Yeet/internal/Guards.ts` (remove the
  `--fast` requires `--monitor` guard; add `--prove-first` exclusivity with
  `--push-only`).
- `packages/tooling/tool/cli/src/commands/Yeet/internal/MonitorPolicy.ts` and
  `WatchMode.ts` (terminal `ready-pending-flip`; draft-aware verdict).
- PR creation step: `gh pr create --draft` plus `gh pr edit --add-label
  ready-for-heavy`.
- `packages/tooling/tool/cli/test/yeet-*.test.ts` (plan wiring, guards,
  monitor terminals, ready gate).
- `.claude/skills/yeet/SKILL.md`: "Authoritative Gates", "Mergeable PR
  Workflow" steps 4–6 and 10, delete "Fast Plus Monitor" and "Start PR Early",
  add "Push-First Publish" and "Ready".
- `AGENTS.md` Quality Operator bullet for Yeet.
- `docs/runbooks/agent-pools.md` only if it restates the publish order.

## Constraints

- Schema-first: new flags and terminals are `LiteralKit` members and `S.Class`
  fields, never ad-hoc strings.
- The removed flags must fail loudly at parse time, not be silently ignored.
- `--prove-first` must reproduce the pre-change proof order; the PR-less plan
  is byte-identical to the fixture, and with a PR it carries the shared draft tail.
- `yeet ready` reuses the monitor's PR read; no second GitHub read path.
- Draft creation must not break docs-only PRs: they need no label and must
  still reach `ready-pending-flip`.
- The first draft PR this packet opens is the observation point for reviewer
  behaviour on drafts (Greptile config is not in-repo). Record the finding in
  `research/draft-reviewers.md` before P3 closes.

## Acceptance Criteria

- [ ] `yeet publish --message ...` on a PR-less branch: commits, runs cheap-gates
      and head-install preflight, pushes, opens a draft PR with
      `ready-for-heavy`, submits `monitor --until-ready --detach`, prints the PR
      URL and job id, exits 0. No admission ticket is enqueued.
- [ ] `yeet publish --no-pr` pushes without a PR and warns that no hosted
      checks will run.
- [ ] `yeet publish --prove-first` reproduces the pre-change proof order (PR-less
      plan byte-for-byte in `--plan --json`); with a PR it shares the draft tail.
- [ ] `yeet publish --fast` and `--start-pr-early` are unknown flags.
- [ ] `monitor --until-ready` ends `ready-pending-flip` with exit 0 on a draft
      whose threads are answered and required checks green, and prints
      `bun run beep yeet ready`.
- [ ] `yeet ready` flips a draft only under D10 and names the first blocker
      otherwise.
- [ ] A cheap-gates red blocks the push with the gate line and no commit is
      pushed.
- [ ] `AGENTS.md` and the yeet skill state the new order; no remaining prose
      says "prove with `yeet verify` before `publish`" as a rule.
- [ ] No unrelated refactors or formatting churn.

## Verification Matrix

| Check | Command or evidence | Required result |
| --- | --- | --- |
| Plan wiring | `bunx --bun vitest run packages/tooling/tool/cli/test/yeet-command-wiring.test.ts` | Passes with push-first default and `--prove-first` fixture |
| Guards | `bunx --bun vitest run packages/tooling/tool/cli/test/yeet-guards*.test.ts` | Passes |
| Monitor terminals | `bunx --bun vitest run packages/tooling/tool/cli/test/yeet-monitor*.test.ts packages/tooling/tool/cli/test/yeet-merge-ready-coherence.test.ts` | Passes with `ready-pending-flip` |
| CLI package | `bun run beep quality package-verify @beep/repo-cli` | Green |
| Live proof | This packet's own PR is published by the new default path | Draft PR + job id printed, no ticket enqueued |
| Packet launcher size | `test "$(wc -m < goals/push-first-publish/GOAL.md)" -le 4000` | Passes |
| Manifest JSON | `jq . goals/push-first-publish/ops/manifest.json` | Passes |
| Whitespace | `git diff --check -- goals/push-first-publish` | Passes |

## Stop Conditions

- Draft PRs turn out to receive no reviewer or hosted signal at all, which
  would remove the back-pressure this packet relies on. Report before
  continuing.
- The change would require touching the admission scheduler contract.
- Verification requires credentials, cost, destructive side effects, or policy
  approval not named in this spec.
- The same blocker repeats after reasonable investigation.

## Exception Ledger

| Exception | Scope | Owner | Rationale | Removal condition |
| --- | --- | --- | --- | --- |
| None | N/A | N/A | N/A | N/A |
