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
  merge request and its poll, which replaced the legacy merge call.
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

- [x] Slice A: `yeet merge-gate` and `yeet merge` merge an ordinary PR
      through `merge-async` with the gated `sha`; a PR with an unresolved
      thread holds with GitHub's sentence; strict mode sends no bypass and
      relaxed mode records the one it sends; the legacy call is deleted
      after its watch day.
- [x] Slice B: a GitHub-initiated rewrite with unchanged patch-ids keeps
      the review-window start and carries the final-check receipt; a
      changed patch-id or a lane push restarts both. The rewritten heads of
      #3050 and #3051 from the test record are fixtures.
- [x] Slice C: one lane publishes a second layer on an open PR through
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

### Failed and unsettled async merges hold; the poll waits about two minutes, 2026-11-10

The P0 probes (research/merge-async-p0-probes-2026-11.md) settled the 409 body (same shape as the 202, carrying the in-flight uuid), a head that moves before the request (400, failed) or after it (failed, 'Head branch is out of date'), and an unknown or expired uuid (404). The client decodes 400 and 409 bodies from the octokit error's response.data and keeps every other status a GitHubError. A 409 attaches to the in-flight request instead of sending another. The gate polls every 2 s for up to 60 more reads: `failed` holds as `merge-failed` with GitHub's sentence; still pending, queued or expired holds as `merge-unsettled`. Neither is read as merged. The owner checkpoint keeps its rule that anything but a confirmed merge is uncertain and reconciled by readback.

Lane claude/trusting-hamilton-1ad7d1

Reverse: Raise or drop the poll budget in AsyncMerge.ts, or read Unsettled as a refusal instead of a hold.

### Strict merges never bypass; relaxed merges request it with attribution, 2026-11-10

The async endpoint takes `bypass_rules`, default false. Strict mode sends false. Only `--relaxed` (S11) sends true, with the attributed reds the gate already records. 42.9% of pushes to main bypassed the ruleset in the week to 2026-11-09 as a side effect of who held the token. Source: `explorations/stacked-pr-adoption/RESEARCH.md`, 2026-11-09 section.

Lane docs/stack-test-results

Reverse: Send bypass_rules from relaxed mode unconditionally, as the legacy endpoint did in effect.

### Legacy merge stays behind BEEP_YEET_MERGE_ENDPOINT=legacy for one working day, 2026-11-10

Every Yeet merge (merge-gate, merge, gh merge, owner checkpoint) goes through settleYeetMerge, which reads BEEP_YEET_MERGE_ENDPOINT (async by default; legacy routes to PUT pulls/{n}/merge, which cannot send a bypass). An unparseable value falls back to async with a warning, because async is the path that holds a failed rule. The legacy call and the switch are deleted in a small follow-up PR one working day after slice A merges: on or after 2026-11-11.

Lane claude/trusting-hamilton-1ad7d1

Reverse: Set BEEP_YEET_MERGE_ENDPOINT=legacy in the merging shell; after the deletion PR, revert that PR.

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

### yeet gh pr status and merge read the shared review window, 2026-11-12

`yeet gh pr status|merge` computed its own review window with a fixed 20 minutes, ignoring `BEEP_YEET_REVIEW_WINDOW`. It now takes the window instants from the shared reader, including the rewrite carry, and its length from the same configuration. Slice A had merged, so the change rides the slice B PR instead of a separate one.

Lane feat/yeet-rewrite-stable-proof

Reverse: Restore the GhOps window computation with its fixed 20-minute length.

### A rewrite is unchanged only when GitHub replayed the same commits, 2026-11-12

The head-move classifier answers unchanged only when the new head is the old head's own non-empty commits replayed by GitHub onto the PR base. Four conditions apply. Every replayed commit carries GitHub's committer shape: `GitHub <noreply@github.com>` with a PGP (web-flow) signature for a restack, or an unsigned `<id>+<login>@users.noreply.github.com` commit for a cascade, never the checkout's own `user.email`. The window also requires each carried rewrite's commits to be committed between 60 seconds before and 5 seconds after its activity row, as GitHub's server-side rewrites are (1 second and 0 seconds apart on the recorded heads). Each pair has equal author name, email and date (offset kept), an equal raw message, equal `diff-tree --raw` entries without blob ids, and an equal whitespace-exact per-path patch digest. The new head's linear base is the PR base (`A~k == S`). The base absorbs the old base, and the new tree equals `git merge-tree --merge-base=<old base> <S> <old head>`. This is stricter than `git patch-id --stable`, which ignores whitespace and metadata. Empty commits such as the S32 re-request commit are dropped from both sides before pairing. Merge commits fail closed, so a lane that merged main restarts; slice D counts those stops. Any git failure or unfetchable object classifies as unknown, which never carries. Attribution is best effort: a lane that commits unsigned under the operator's noreply identity, rebases without changing a patch and force-pushes within 60 seconds is indistinguishable from a cascade. Force-pushing breaks repo law and Yeet cannot do it, and such a head's patches and replay tree are identical, so the carried proof still describes the same content. On the recorded heads all six #3050/#3051 rewrite pairs classify unchanged, and the stale-base, retarget and layer-2-versus-layer-3 counterexamples classify changed.

Lane feat/yeet-rewrite-stable-proof

Reverse: Delete HeadMove.ts and its window and receipt call sites; every rewrite restarts the window and voids the receipt again.

### Head moves come from repository activity; unreadable means no carry, 2026-11-12

The review window learns head moves from REST repository activity (`GET /repos/{o}/{r}/activity?ref=refs/heads/<branch>`, at most three cursor pages of 100), linked by sha and never by time. The walk starts at the row whose after-sha is the current head and follows force pushes while each old head classifies unchanged against the current head and the PR's base sha. The base sha is used only when the pull record's head equals the gated head. A failed pull, activity or check-suite read, a lagging activity feed, a cycle or the page bound means no carry, which is today's behaviour. Goals completion keeps its window as raw, uncarried evidence (it is non-gating), and its detail now says so.

Lane feat/yeet-rewrite-stable-proof

Reverse: Drop the activity read; the window anchors on every force push again.

### A lane push restarts the window and grants no new receipt carry, 2026-11-12

A fast-forward lane push restarts the review window, and slice B grants it no new receipt carry. The 2026-10-28 ancestor refresh rule for receipts is unchanged. A GitHub rewrite followed by a lane push that adds a non-empty commit is not carried: the classifier sees a lane-committed commit and answers changed, so the next `yeet final-check` runs on the new head. An empty commit, such as the S32 re-request that `yeet ready` pushes, carries no content: it still restarts the window (it is a push), but it does not break the receipt carry.

Lane feat/yeet-rewrite-stable-proof

Reverse: Classify fast-forward moves too and carry across them.

### An unchanged rewrite keeps proof that a new sha used to void, 2026-11-12

For a GitHub rewrite the classifier calls unchanged, the 2026-11-10 window-on-rewrite decision supersedes the exploration rule "The new SHA voids old proof, receipts and merge-gate pins" (`explorations/stacked-pr-adoption/DECISIONS.md`). Only the review-window start and the final-check receipt carry. The receipt is still judged by the 2026-10-28 refresh facts, so only main's changes are excused, and a restack onto an updated base layer refuses. The merge-gate sha pin is unchanged: a gate pinned to the old head still refuses the new one.

Lane feat/yeet-rewrite-stable-proof

Reverse: Restore the exploration rule: any new sha voids the old proof and receipts.

### Legacy merge call, its switch and the endpoint field deleted, 2026-11-13

The watch day set by the legacy-merge-switch decision ended on 2026-11-11. This PR deletes the legacy REST merge call from GithubRest, the BEEP_YEET_MERGE_ENDPOINT switch and its config from AsyncMerge.ts, and the endpoint field from YeetMergeSettlement and MergeGateMerged. A field that can hold one value distinguishes nothing, so it goes with the switch rather than staying as a one-literal union; merge lines keep ending 'via merge-async' through one constant. The merge queue, if it is ever routed, is a merge_action on the same endpoint, not a second endpoint.

Lane chore/yeet-delete-legacy-merge

Reverse: Revert this PR; the legacy call returns behind BEEP_YEET_MERGE_ENDPOINT=legacy.

### How the pilot's kill criteria are measured, 2026-11-13

The criteria in SPEC.md are sentences; the record gives each one a number a later session can read. Used: stacks in `GET /repos/{owner}/{repo}/stacks` created inside the clock on base main whose two layers each carry a lane's own change. Fewer than four in the fourteen days fires the first criterion, because two a week is a rate, not a floor for each week. Probe, test and acceptance stacks do not count, nor does a stack that was unstacked or closed with nothing merged. Wait: the minutes a review window was the only thing holding the stack, from every other gate criterion being met on both layers to the later window elapsing. A median above 40 minutes, two windows at the default length, fires the second. Time spent on hosted CI or on review fixes is not window wait: an ordinary pull request pays it too, and stack #3190 took 77 minutes with none of them spent on a window. Force-push: one stack that landed only after a lane rewrote a published branch, or after someone pressed Rebase stack for it, fires the third. The stack listing is the count of record, so a lane that forgets its row does not shrink the census.

Lane docs/stack-pilot-record

Reverse: Judge the second criterion on ready-to-merge minutes, or the first on each week separately; the GitHub API still holds the instants needed for either.

### The base-conflict row on a layer is fixed now; the label on a docs-only layer stays, 2026-11-13

Slice C left two items for the pilot to justify. No pilot stack exists yet, so both are judged on what the code, the stack test and the repository's rules show. The base-conflict row: the monitor builds it from the run's base, which for a layer is the trunk, so a layer's row reads `base conflict with origin/main` and its remedy `merge origin/main and push`, while GitHub computes the layer's conflict against the parent's branch. Following the row does not clear the conflict and puts main's changes into the layer's diff. The yeet skill calls the row the instruction and AGENTS.md makes it unconditional, so it is fixed in its own small PR before a pilot stack meets it; otherwise the pilot would be measuring a wrong sentence in the tool. The label: a docs-only layer on a code parent gets `ready-for-heavy` because the label step reads the whole range above main. Hosted CI reads the layer's own diff and skips Heavy (`verdict=skip-satisfied`), as it did on the three hand-labelled docs-only layers of the stack test, so the cost is one Heavy Admit run whose jobs skip. The label stays, and is revisited if a pilot row shows a labelled docs-only layer running a Heavy lane or holding on a required Heavy context.

Lane docs/stack-pilot-record

Reverse: Revert the base-conflict fix PR; or decide the label from the layer's own paths in applyHeavyAdmissionLabel.

### The pilot record opens before the first stack and its clock runs from 2026-11-13, 2026-11-13

PLAN.md said to start the pilot record on the first routine stack. None was open on 2026-11-13: the stack listing held only the test, probe and acceptance stacks, and no open pull request had a base other than main. The record opens anyway (research/stack-pilot-2026-11.md), and its clock is set instead of left waiting: fourteen days from 2026-11-13, the day `yeet publish --stack-on` reached main (#3224), to the end of 2026-11-26. A clock that starts on the first stack never starts if nobody stacks, and then the first kill criterion, fewer than two stacks a week, could never fire. Lanes learn of the row from one step in the yeet skill (references/stacks.md) and a line to the orchestrator. Stack #3190 is the reference row and is not counted.

Lane docs/stack-pilot-record

Reverse: Restart the clock on the first routine stack's creation date and move the verdict date with it.

### yeet ready never pushes on a stack layer; the request comment is the wake, 2026-11-13

Since #2791 `yeet ready` wakes beep-reviewer with an exact-head issue comment for a PR the shared login authored, and pushes the empty S32 commit only as the fallback for an author or repository the comment routine does not cover. The P0 probes showed the comment waking the reviewer on a layer with no push: #3154 (position 1 of 2) sat ready for four minutes unreviewed, then got its summary 2 minutes 32 seconds after the comment, on an unchanged head. So slice C adds no new wake. It removes the fallback on every stack layer, top included, because a push below the top moves the head off the base of the layer above and a push on the top restarts a window the gate is about to read. An uncovered layer gets a warning with the manual comment body.

Lane feat/yeet-two-layer-stacks

Reverse: Allow the S32 fallback on the top layer only, where a push cannot strand a layer above.

### Slice C lands as a proving stack of two small PRs plus the tooling PR, 2026-11-13

The acceptance row needs a real two-layer stack landed through the new code, and its evidence belongs in the PR that flips the row. So the stack is run with the lane's unmerged CLI on two small slice C changes that stand alone, and the tooling PR carries the code, the skill text, the evidence and the flips. The layers are code changes, not docs, so Yeet applies `ready-for-heavy` and the Heavy lanes run on a layer. The first parent, #3170 (the P0 record), could not serve: the shared login flipped it ready one minute after it opened as a draft and merged it ten minutes later, before a layer existed. The layers therefore open with their final-check receipts already written, are flipped by `yeet ready` at once, and carry one unresolved hold thread each until the top is gated. An `owner-merge-hold` label was tried as well and removed within two minutes: any label added after `ready-for-heavy` starts an empty Heavy Admit run, so `ready-for-heavy` had to be re-applied on both layers.

Lane feat/yeet-two-layer-stacks

Reverse: None needed after the fact; a later slice returns to one PR per slice.

### The gate on the top gates both layers and sends one request, 2026-11-13

`yeet merge-gate <pr> <sha>` reads the pull request's merge scope before it decides. On the top of a two-layer stack it gates the lower layer first and then the top with the same strict criteria, clock, tolerances and window flag, pins the lower layer to the head the stack listing gave, requires the top to contain that head (`GET compare`, `behind_by` zero), and sends one `merge-async` request for the top with `bypass_rules: false`. The top keeps its computed squash title and body, which the probes showed reach the top layer only; the lower layer's own default message is predicted and linted instead. After `merged` the lower layer is read back for its own squash commit: a lower layer that does not read merged fails as `merge-unsettled`, and one that merged at another head than the gated one prints a warning, because `sha` pins only the top. `--relaxed` on a group holds as `stack-relaxed`, since a bypass reaches only the lowest layer. A pull request with an open layer above it holds as `stack-below-top` unless the caller passes `--alone`: that protects a stack from a gate loop that merges whatever is met, and keeps bottom-up landing a decision somebody made. More than two open layers, an unlisted pull request and a failed stack or containment read all hold; none is read as a single pull request. A layer's required contexts and its reviewer requirement come from the trunk's ruleset, because its own base is a branch no ruleset targets. `yeet merge`, `yeet gh merge` and the owner checkpoint refuse any pull request whose scope is not single.

Lane feat/yeet-two-layer-stacks

Reverse: Delete StackGate.ts and its call in MergeGate.ts; a stacked pull request then holds on its parent branch's empty ruleset, as before.

### Layers are linked through the Stacks REST API, not gh stack, 2026-11-13

The P0 probes (research/stack-p0-probes-2026-11.md) created three two-layer stacks with `POST /repos/{owner}/{repo}/stacks` and a bottom-to-top list of PR numbers: 201 in under a second, drafts accepted, refusals as 422 with a sentence. Yeet already creates the PR through REST with its title, body, footer and label, so the link is one more call on the same client. `gh stack` v0.3.0 calls the same endpoints, but `submit` and `push` push every branch with `--force-with-lease`, `link` pushes branch arguments, `init` keeps per-clone tracking state, and `submit` refuses with three remotes unless `remote.pushDefault` is injected. A lane's only push stays the one Yeet proves. The CLI is not a dependency of any Yeet command.

Lane feat/yeet-two-layer-stacks

Reverse: Wrap gh stack link with remote.pushDefault injected through the environment, and drop createStack from GithubRest.

### A layer is published with --stack-on; Yeet's --base stays the trunk, 2026-11-13

`yeet publish --stack-on <pr>` and `yeet open --stack-on <pr>` create the pull request on the parent's branch and link the two through `POST stacks`. `--base` keeps meaning the trunk, so affected planning, final-check and the ruleset read stay on `origin/main` and cover a superset. Only what must see the layer alone changes: the title and body summary come from the commits above the parent's head, base freshness measures the layer's own paths (three-dot from the parent's head, so a parent that moved does not count as the layer's change), and a `--push-only` merge of the parent's branch is accepted. The decision is taken before any commit or push, so a refusal changes nothing: the parent must be open, on the trunk and unstacked, the branch must contain its head, and the trunk must be green. A later publish of the same layer needs no flag: Yeet reads the branch's pull request, finds the open layer below it in the stack, and skips the trunk read because that stack is already open. Yeet never retargets an existing pull request. A link that fails after the create is repaired by running the command again. The label step keeps reading the whole range from the trunk, so a docs-only layer on a code parent is still labelled; that errs toward more CI, never less.

Lane feat/yeet-two-layer-stacks

Reverse: Remove the flag and StackPublish.ts; every Yeet pull request targets the default branch again.

### main is green when each required check's newest completed run passed, 2026-11-13

`yeet publish --stack-on` opens a stack only on a green trunk (decision 2026-11-10-stack-only-on-green-main), so green needs a definition a command can read. main lands a pull request every few minutes and each push cancels the previous Check run: on 2026-11-13 the head and the nine commits under it carried no completed run for eleven of the fifteen required contexts. Yeet therefore reads the newest 30 first-parent commits and, per required context, takes the newest completed run that was not cancelled. Every context passing is green; any context whose newest evidence failed is red and names it; a context with no completed run in those commits is unknown. Red and unknown both refuse, and there is no override flag: the reversal is this file. The read runs only when a lane opens a new layer, never on a later push of an existing one, because that stack is already open.

Lane feat/yeet-two-layer-stacks

Reverse: Judge the trunk by its head commit alone, or drop the read and let the lane assert green.

<!-- beep:decisions:end -->

## Exception Ledger

| Exception | Scope | Owner | Rationale | Removal condition |
| --- | --- | --- | --- | --- |
| None | N/A | N/A | N/A | N/A |
