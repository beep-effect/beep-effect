# Yeet Async Merge and Native Stacks Spec

## Objective

Merge through GitHub's async endpoint with an explicit bypass, keep proof across rewrites that change nothing, and support two-layer native stacks.

Shaped in [`explorations/stacked-pr-adoption/BRIEF.md`](../../explorations/stacked-pr-adoption/BRIEF.md)
and decomposed in its [`MAP.md`](../../explorations/stacked-pr-adoption/MAP.md).
The brief's P0 to P3 are slices A to D here, because this packet's own phase
ids are P0 to P4.

| Slice | Delivers |
| --- | --- |
| A, async merge | `yeet merge-gate` and `yeet merge` merge through `PUT pulls/{n}/merge-async`, pinned to the gated head, with bypass as an explicit request. |
| B, rewrite-stable proof | A GitHub-initiated head rewrite whose patch-ids are unchanged keeps the review window and carries the final-check receipt. |
| C, two-layer stacks | A lane can open a layer on an open PR, ready it without a push, merge both layers from the top, and retire. |
| D, pilot | Two weeks of real two-layer stacks, measured against kill criteria. |

Slices A and B must pay off with stacks switched off. If the appetite (one
week of agent time) runs out after them, the goal closes there.

## Non-Goals

- No merge queue. `explorations/github-merge-queue` owns enabling one; this
  goal only leaves the queue action reachable from the async client.
- No workflow, ruleset or admission change, and no Heavy gating by stack
  position.
- No agent-side force-push, no `gh stack rebase`, `sync` or `modify` from a
  lane, and no browser "Rebase stack".
- No stack deeper than two layers in routine use, and no PR on a non-`main`
  base outside a native stack.
- No third-party stack tool.
- No change to S11 or to the review-window length.
- No dependency model for joins and fans; they stay on the fold and
  publish-after-parent rule.

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

- `packages/tooling/tool/cli/src/internal/github/GithubRest.ts`: the async
  merge request and its poll beside the legacy `mergePullRequest`.
- `packages/tooling/tool/cli/src/commands/Yeet/internal/`: the merge gate,
  merge porcelain, GitHub operations and owner-checkpoint merge (slice A);
  the review window, the final-check refresh rule and a new head-move
  classifier (slice B); PR creation, the ready gate, sweep, retire and a
  new stack model (slice C).
- `packages/tooling/tool/cli/test/`: suites for each slice.
- `.claude/skills/yeet/` and `.claude/skills/orchestrate/SKILL.md`: the
  dependent-lane rule (step 2c), the merge loop and the gate rows, changed
  in the same PR as the behaviour they describe.
- `AGENTS.md`: the "Mergeable" and Yeet lines, only where a slice changes
  what they state.
- This packet, and `explorations/stacked-pr-adoption` for the pilot's
  re-entry notes.

## Constraints

- Slices land in order, each as its own PR, with at most three PRs open on
  this packet.
- Design order inside each slice is schema, then the service contract,
  then the implementation. Merge outcomes and head moves are tagged unions.
- Strict mode never sends a bypass. Relaxed mode (S11) sends one only with
  the attributed reds the gate already records.
- GitHub evaluates rules after it accepts an async merge. The gate polls to
  a terminal state, turns `failed` into a hold carrying GitHub's sentence,
  handles the 409 for a request already in flight, and never reads
  `pending` as merged.
- The legacy merge call stays reachable behind a flag for one working day
  after slice A merges, then is deleted.
- A lane never moves a published ref non-fast-forward. After a GitHub
  rewrite it adopts the remote head with `git switch -C`.
- A stack is opened only while `main`'s required checks are green, and has
  two layers at most.
- Every layer keeps one commit subject of 98 characters or fewer that
  passes commitlint, because a stack merge writes the default squash
  message.
- The first stack with a code layer records what Heavy admission and the
  Heavy lanes do on a layer before the pilot counts it. The test's layers
  were docs-only.
- `@beep/repo-cli` is changeset-ignored; no changeset.

## Acceptance Criteria

- [ ] Slice A: `yeet merge-gate` and `yeet merge` merge an ordinary PR
      through `merge-async` with the gated `sha`; a PR with an unresolved
      thread holds with GitHub's sentence; strict mode sends no bypass and
      relaxed mode records the one it sends; the legacy call is deleted
      after its watch day.
- [ ] Slice B: a GitHub-initiated rewrite with unchanged patch-ids keeps
      the review-window start and carries the final-check receipt; a
      changed patch-id or a lane push restarts both. The rewritten heads of
      #3050 and #3051 from the test record are fixtures.
- [ ] Slice C: one lane publishes a second layer on an open PR through
      Yeet, with the footer, label and monitor; readies it without a push;
      merges both layers from the top through the gate; and retires both
      lanes with `yeet sweep --retire`. The Yeet skill's step 2c says how.
- [ ] Slice D: a pilot record under this packet's research directory
      records every pilot stack
      (rewrites and their cause, minutes waited on windows, `main` Check
      runs started, holds), settles whether GitHub restacks when the trunk
      moves, and a decision file records continue or stop against the kill
      criteria.
- [ ] No workflow, ruleset or admission file changed.
- [ ] No unrelated refactors or formatting churn.

Kill criteria for slice D, any one of which ends routine stack use and
closes the goal at slice B: fewer than two stacks a week get used; the
median stack waits more than two review windows; a stack needs an
agent-side force-push to land.

## Verification Matrix

| Check | Command or evidence | Required result |
| --- | --- | --- |
| Packet launcher size | `test "$(wc -m < goals/yeet-async-merge-and-stacks/GOAL.md)" -le 4000` | Passes |
| Manifest JSON | `jq . goals/yeet-async-merge-and-stacks/ops/manifest.json` | Passes |
| Whitespace | `git diff --check -- goals/yeet-async-merge-and-stacks` | Passes |
| Package | `bun run beep quality package-verify @beep/repo-cli` | Passes on each slice's head |
| Content-final | `bun run beep yeet final-check` | Receipt on each slice's head |
| Slice A in production | The slice A PR's own merge line names `merge-async`; one blocked PR shows the hold | Recorded in `history/` |
| Slice C end to end | Two PR numbers, one stack number, two squash commits from one push | Recorded in `history/` |

## Stop Conditions

- Required source files are missing or materially contradictory.
- Any spend: purchases, paid services, quota top-ups or plan changes need the
  operator.
- The same blocker repeats after reasonable investigation.

Scope growth, destructive side effects and policy calls are not stops: decide
them and record each as a decision file.

## Decision log

Record each decision as its own file under `decisions/` (`bun run beep goals
decisions add yeet-async-merge-and-stacks --title "..." --reversal "..."`); the block below is
generated from that directory and never edited by hand.

<!-- beep:decisions:begin -->
_Generated from [`decisions/`](./decisions/) by `bun run beep goals decisions write --slug yeet-async-merge-and-stacks`; add a `kind: decision` file there, never edit this block._

### Appetite: one agent-week, four slices, stop after B if the pilot fails, 2026-11-10

Four slices, each its own PR, at most three open on the packet. Slices A (async merge) and B (rewrite-stable proof) must pay off with stacks off. Slice D's kill criteria end routine stack use: fewer than two stacks a week, a median wait above two review windows, or any agent-side force-push. Source: `explorations/stacked-pr-adoption/DECISIONS.md`, `graduate-one-goal`.

Lane docs/stack-test-results

Reverse: Re-shape the appetite in the exploration and supersede this decision.

### Strict merges never bypass; relaxed merges request it with attribution, 2026-11-10

The async endpoint takes `bypass_rules`, default false. Strict mode sends false. Only `--relaxed` (S11) sends true, with the attributed reds the gate already records. 42.9% of pushes to main bypassed the ruleset in the week to 2026-11-09 as a side effect of who held the token. Source: `explorations/stacked-pr-adoption/RESEARCH.md`, 2026-11-09 section.

Lane docs/stack-test-results

Reverse: Send bypass_rules from relaxed mode unconditionally, as the legacy endpoint did in effect.

### A lane never rewrites a published ref; it adopts GitHub's rewrite, 2026-11-10

No `gh stack rebase`, `sync`, `modify` or browser Rebase stack from a lane. After a GitHub-initiated rewrite the lane takes the remote head with `git switch -C <branch> origin/<branch>` and replays unpushed work fast-forward. Source: `explorations/stacked-pr-adoption/DECISIONS.md`, `no-rebase-law`; confirmed in the test, where the lane never force-pushed.

Lane docs/stack-test-results

Reverse: Allow a Yeet-owned, lease-pinned rewrite after an operator ruling on force-pushes.

### The second server-side rewrite is unattributed; slice D settles it, 2026-11-10

At 02:54:20Z on 2026-11-10, 38 seconds after another PR landed on main, both remaining test layers were rebased server-side with GitHub-signed commits. Neither the operator nor the test session did it and no repo tooling calls a branch update. If GitHub restacks on trunk moves, slice B is a precondition for any stack; if a session did it, the no-rewrite rule needs enforcing. Source: `explorations/stacked-pr-adoption/DECISIONS.md`, `second-rewrite-unattributed`.

Lane docs/stack-test-results

Reverse: None needed: this records an open fact.

### Open a stack only while main's required checks are green, 2026-11-10

Bypass can merge only the lowest layer, so on a red main a stack lands bottom-up with one cascade per layer. The pilot rule replaces the old health gate: open a stack when main's required checks are green, and unstack when that stops being true for a working day. Source: `explorations/stacked-pr-adoption/DECISIONS.md`, `graduate-one-goal`.

Lane docs/stack-test-results

Reverse: Restore the 80% over 14 days health bar as a precondition.

### Stacks have two layers; every layer is an ordinary PR for CI, 2026-11-10

Each layer carries the label, runs the full matrix and re-runs after a cascade. Landing n layers bottom-up costs n(n+1)/2 runs, so routine stacks stop at two. Heavy gating by stack position stays deferred and needs a workflow change this goal does not make. Source: `explorations/stacked-pr-adoption/DECISIONS.md`, `stack-layer-heavy`.

Lane docs/stack-test-results

Reverse: Raise the cap, or gate Heavy on the lowest unmerged layer, after the pilot.

### An unchanged patch-id keeps the review window and the receipt, 2026-11-10

A GitHub-initiated rewrite whose patch-ids match keeps the review-window start and carries the final-check receipt; a changed patch-id or any lane push restarts both. In the test the window restarted twice in 30 minutes and the second merge waited 29 minutes for an unchanged diff. Source: `explorations/stacked-pr-adoption/DECISIONS.md`, `review-window-on-cascade` and `stack-test-result`.

Lane docs/stack-test-results

Reverse: Restart the window and void the receipt on every head move, as today.

<!-- beep:decisions:end -->

## Exception Ledger

| Exception | Scope | Owner | Rationale | Removal condition |
| --- | --- | --- | --- | --- |
| None | N/A | N/A | N/A | N/A |
