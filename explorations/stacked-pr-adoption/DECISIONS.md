# Decisions

<!--
Stage 2. The grilling log. One entry per resolved branch-closing question,
newest last. Unresolved questions live in ops/manifest.json `openQuestions`
until they land here. Deferred questions get an entry too, marked DEFERRED
with the reason.
-->

Align session 2026-10-13, run as `/grill-with-docs` rounds through
AskUserQuestion, recommended answer first. The evidence is the 2026-10-13
refresh in [`RESEARCH.md`](./RESEARCH.md). Round 1 settled three root
questions that the five manifest questions depend on.

## 2026-10-13 — s11-standing

**Question:** Does S11 stand, and on what terms? S11 is the 2026-10-09
operator ruling that PRs with failing jobs may merge once every review thread
is addressed and there is no conflict.

**Answer:** It stands repo-wide, with its duty attached as a deadline. Every
required red on `main` gets a named owner and a fix PR the same working day.
The ruling and its duty belong in the AGENTS.md "Mergeable" law. Today the
ruling exists only in the orchestrator's out-of-repo rulings file.

**Rationale:**
- 30 of 36 merges after S11 bypassed required checks. Since 10-09T23:36Z
  `main` has failed the required JSDoc Ratchet and Repo Sanity on every
  completed run, and the burn-downs #1605 and #1612 did not clear them. The
  same-day "one consolidated fix PR" duty was not kept, so without a
  deadline reds become permanent.
- Consequences for this packet:
  - PR-side Heavy proof is advisory, not a gate.
  - Top-of-stack merges are mostly unavailable, because GitHub lets bypass
    merge only the lowest stack layer.
  - A hold on PR Heavy saves less, because waiters merge anyway.
- Rejected:
  - Standing as worded, with no duty: the evidence shows the duty slips.
  - Temporary, ending when `main` is green: `main` has not been
    required-green since 10-09, so the end condition would never fire.

## 2026-10-13 — non-required-heavy-lanes

**Question:** Where does the cost of Heavy / Coverage Regression and Heavy /
Lint Policy go? Neither is a required check. Together they take 63% of PR
Heavy runner-minutes, and they fail in 68 and 57 of the 86 failing `main`
runs.

**Answer:** Hand it to `goals/ci-lane-economics` as an input to its next
repair decision; that goal owns lane placement and cost. This packet records
the finding, which replaces the 10-05 claim that a main-red admission hold is
the biggest lever. This packet makes no CI change.

**Rationale:**
- 19,838 of 31,347 PR Heavy runner-min (2026-09-29..10-13) ran on these two
  lanes. By comparison, a required-red hold touches 40.6% of PR Heavy
  minutes, and stacks address under 1%.
- Handing it over as an input, without a change, avoids confounding
  ci-lane-economics' window-4 attribution (repair decision 3, ruling 6).
- Rejected:
  - Widening this packet into a general CI-waste packet: it would duplicate
    ci-lane-economics' scope.
  - Leaving both lanes on every PR: the largest measured lever would get no
    owner.

## 2026-10-13 — main-red-definition

**Question:** What counts as "main red" for the gates this packet sets?
These are the main-red handling, a stack-adoption gate, and the merge-queue
readiness bar it cites.

**Answer:** Required checks, read per check. `main` is red when any of the
16 required contexts fails on the newest `main` commit that has a result for
that context. Non-required reds are tracked but do not count.

**Rationale:**
- Whole-run conclusions are dominated by the two non-required lanes. On the
  whole-run basis, non-cancelled `main` success was 23.2% over 14 days; with
  all required checks green it was 63.4%.
- A per-check read also tracks the PRs it gates. On 10-05, `main`'s Security
  job failed about 3 minutes before the unblocker #1436 opened, while the
  whole run concluded about an hour later.
- A merge queue gates on required checks inside the group, so required-only
  is the right basis for queue readiness too. Restating the E8 bar is left
  to the `github-merge-queue` exploration, which owns that gate.
- Rejected:
  - Any failing job: this counts lanes that gate nothing.
  - A split, with required-only for this packet and whole-run for E8: two
    definitions of one word.

## 2026-10-13 — main-red-handling

**Question:** How does the repo handle a red `main`? This was manifest
question 3, the main-red admission hold.

**Answer:** Doctrine only, with no admission change.
- **One unblocker per episode.** For each red episode on `main` the
  orchestrator declares one consolidated unblocker: a PR label plus an
  entry in the orchestrator register.
- **Its CI goes first.** On declaration, cancel runs, running ones
  included, on PRs whose heads must re-run anyway, using the existing
  `yeet gh checks cancel-queued`.
- **It merges first.** The unblocker merges ahead of the waiting PRs,
  under the same-day deadline from `s11-standing`.
- **The automated hold is DEFERRED** behind a measured trigger
  (`automated-hold-trigger` below).

**Rationale:**
- With S11 standing, a held PR still merges by bypass, so a hold mostly
  produces unproven merges rather than saved re-runs.
- The measured waste is episode-shaped:
  - At least ~850 runner-min of Heavy ran on waiting PRs' heads that were
    red on the inherited check. This is a floor: 5 of 9 episodes, with
    identified waiters only.
  - About 290–350 runner-min went to duplicate parallel unblockers (#1436,
    #1446), which a hold would not touch.
- The rule extends doctrine that already exists: the AGENTS.md autonomy
  charter tells agents to cancel queued CI on PRs that must re-run anyway.
- Rejected:
  - A hold on required-Heavy reds only, read per check and failing open
    when `main`'s verdict is stale: it would have touched about 16% of PR
    Heavy minutes, but it needs an admission input, the Yeet monitor and
    watch mirrors, and a re-admit trigger that does not exist yet.
  - A hold on any required red (the 10-05 proposal): it would have touched
    40.6% of PR Heavy minutes and held everything continuously since
    10-09.
  - Doing nothing: the duplicate-unblocker waste has no other remedy.

## 2026-10-13 — adopt-native-stacks-now

**Question:** Adopt GitHub native stacks for dependent lanes now? This was
manifest question 1.

**Answer:** Defer routine native stacks and codify the cheap pattern in the
Yeet skill.
- Fold a dependent change into the parent PR while that PR is still open.
- Otherwise build on the parent's branch locally and publish after the
  parent lands.
- Never base a PR on a non-`main` branch.
- Never merge another unlanded PR's branch in. A lane blocked by red `main`
  waits for the declared unblocker (`main-red-handling`).
- One supervised two-layer native-stack test is authorized to settle the
  remaining unverified facts; its terms are a later round.

**Rationale:**
- Demand is small. Only 3 linear chains were live at PR level in 9 days.
  The stack-addressable saving is at most ~50 runner-min, plus ≤58 for one
  top merge.
- Today's merge path cannot merge a stack:
  - `yeet merge-gate` reads the PR's own base ruleset and holds every
    non-bottom layer.
  - It merges through the synchronous endpoint, which GitHub says does not
    support stacks.
  - Under bypass, only the lowest layer can merge, and each landing
    re-runs the layers above it.
- 10 of 13 chains already followed the publish-after-the-parent-lands
  pattern.
- The non-`main`-base ban closes the #1502 mode. That PR ran no CI while
  stacked informally and merged with 13 of 33 checks complete.
- The E7 trial deferred only `yeet publish --stack` integration. Hand use
  was never barred, so the test needs no new E7 permission.
- Rejected:
  - Adopting by hand now: it means merges outside `merge-gate`, plus
    cascade re-runs.
  - Opt-in without a rule or a test: uptake has been zero since E7.
  - Keeping the deferral unchanged: it leaves the #1502 hole open.

## 2026-10-13 — stack-layer-heavy

**Question:** When stacks are admitted, how does Heavy run on stack layers?
This was manifest question 2.

**Answer:** For Heavy purposes a layer is an ordinary PR. It carries the
label, runs the full matrix, and re-runs after a cascade. Stacks are capped
at 2 layers until stacks are routine. The revisit candidate is to run Heavy
only on the lowest unmerged layer
(`pull_request.stack.base.ref == pull_request.base.ref`) and give the upper
layers the existing `hold` verdict, which fails closed.

**Rationale:**
- Full matrix per layer stays sound under any merge order, including
  bypass merges of the bottom layer. Bypass merges are the only merges
  GitHub allows on a stack while S11 bypass is the norm.
- Landing n layers bottom-up costs n(n+1)/2 matrices, about 53 runner-min
  each, so the 2-layer cap bounds that cost.
- Lowest-unmerged gating skips exactly the runs a cascade throws away. It
  also diffs against `main`, because a lowest layer's `GITHUB_BASE_REF` is
  the trunk. It is worth building only once stacks are routine.
- Rejected:
  - Top-only Heavy:
    - Bypass merges only the bottom layer.
    - A docs-only top layer would mark the whole stack skip-satisfied.
    - The top layer's `--affected` and docgen bases are its parent branch.
    - No Actions event re-admits a layer when the stack's shape changes.
  - Building lowest-unmerged gating now: it means admission and Yeet
    mirror work for a feature that was just deferred.

## 2026-10-13 — no-rebase-law

**Question:** Does Yeet's no-rebase law survive GitHub's server-side rebase
of child layers after a partial stack merge? This was manifest question 5.

**Answer:** The law is amended for rewrites that GitHub initiates.
- A lane never moves a published ref non-fast-forward. That includes
  `gh stack sync`, `rebase`, `push` and `modify`, which force-push
  internally.
- GitHub's own post-merge cascade is allowed.
- After a cascade the lane adopts the remote head
  (`git switch -C <branch> origin/<branch>`). If it has unpushed work, it
  replays that work onto the new head and pushes fast-forward. It never
  merges the old tip back in.
- The new SHA voids old proof, receipts and `merge-gate` pins.
- A browser "Rebase stack" click is an agent-initiated rewrite and stays
  forbidden without a new ruling.
- The operative text lands in the Yeet skill with the first admitted stack,
  not before.

**Rationale:**
- Every stated reason for the law still holds: no lane force-pushes,
  hosted CI proves the new merge ref, pushed history is not rewritten by a
  lane, and receipts bind exact SHAs. Yeet already treats a moved head as
  a new wave.
- The rewrite is adopted with an allowed command; `git reset --hard` is
  denied by the harness.
- Rejected:
  - Keeping the law unchanged with top merges only: bypass can merge only
    the bottom layer, so no stack could land today.
  - Dropping the law for stack layers: it reverses the operator's
    no-force-push preference and hides force-pushes inside the extension,
    where the harness deny list cannot see them.
  - Merging the old tip forward: it drags pre-squash parent commits back
    into the layer. This is the #570 Commitlint trap.
- Considered and deferred: a Yeet-owned rewrite pinned by lease and checked
  by patch-id, and merge-queue routing through
  `merge-async merge_action=merge_queue`. Both stay blocked while the
  operator keeps the no-force-push preference and main is below the E8 bar.

## 2026-10-13 — review-window-on-cascade

**Question:** When GitHub's cascade rebases a stack layer but its diff is
unchanged (same patch set), does Yeet's 20-minute review window restart?

**Answer:** No. If a GitHub-initiated rewrite leaves the layer's patch set
unchanged, the window keeps running from the original push. A changed diff,
or any push by the lane, restarts it. This is a requirement on the gated
Yeet stack work, not something to build now.

**Rationale:**
- GitHub keeps approvals in the same case.
- Today `ReviewWindow.ts` restarts the window on any
  `head_ref_force_pushed`. After a landing, `main` stayed still for 20
  minutes only about 41% of the time, so every layer would otherwise
  re-wait 1.4–2.5 times per landing.
- Rejected: always restarting the window, which causes thrash against
  `main`'s cadence for no added review.

## 2026-10-13 — yeet-slice-and-owner

**Question:** What is the first Yeet slice, and who owns it? This was
manifest question 4.

**Answer:**
- **Now:** one standalone fix PR. Both PR-creation paths (`gh pr create`
  and the GraphQL-rate-limit REST fallback) target the default branch.
  `--base` keeps its documented meaning, the affected-planning base. No new
  goal; the fix PR records the decision.
- **Gated** (recorded here; they reopen this packet when
  `stacks-reopen-gate` fires):
  - stack linking (`--stack-on`) through the REST Stacks API;
  - a `merge-async` port in `merge-gate`;
  - a stack-level ready verdict;
  - the `review-window-on-cascade` requirement;
  - a top merge.

**Rationale:**
- `PullRequest.ts:591` passes no `--base` while the REST fallback posts
  `base=<--base>` (`PullRequest.ts:532,546`). A PR's target therefore
  depends on whether GraphQL was rate-limited. This is a defect today,
  whatever happens to stacks.
- Yeet fixes have landed as standalone PRs before (#1468, #1491, #1508).
- A goal whose later phases wait on `main` health would stay open
  indefinitely.
- Rejected:
  - A new `yeet-stack-publish` goal now: ceremony for one small PR.
  - Doing nothing: the base mismatch stays.
  - Turning `--base` into the PR target: an agent passing a non-`main`
    base for affected planning would get a PR on which no workflow fires,
    which is the #1502 mode.

## 2026-10-13 — stacks-reopen-gate

**Question:** What reopens routine native stacks?

**Answer:** Both of these must hold:
- `main` is required-green at least 80% of the time over 14 days (the
  merge-queue bar, on the `main-red-definition` basis);
- a weekly census shows at least 3 live dependency chains (child PR open
  while its parent is unlanded).

Until then the cheap pattern from `adopt-native-stacks-now` stays the rule.

**Rationale:** Stacking saves CI only when a whole stack merges from the
top, and that needs merges without bypass. That is the health half. With 3
live chains in 9 days the saving is under 1% even on a green `main`. That
is the demand half.

Rejected:
- Health only: it reopens stacks with no demand.
- Test result only: a passing test does not make top merges possible.

## 2026-10-13 — automated-hold-trigger

**Question:** What reopens the deferred automated main-red Heavy hold?

**Answer:** Any one of these:
- in a census week, at least 2 declared unblockers wait more than 30
  minutes (p50) for Heavy runners;
- Heavy on waiting PRs' inherited-red heads exceeds 5% of PR Heavy
  runner-minutes;
- S11 ends. This reopens it at once.

**Rationale:**
- The hold saves little while waiting PRs can merge by bypass.
- If S11 ends, waiting PRs cannot merge on a red `main`, so their Heavy
  runs are pure waste.
- The declared-unblocker label from `main-red-handling` is the census key.

Rejected:
- Reopening only when S11 ends: unblocker starvation would go unmeasured.
- Closing it outright: the measurement costs nothing.

## 2026-10-13 — stack-test-terms

**Question:** What are the terms for the one supervised two-layer native
stack test authorized in `adopt-native-stacks-now`?

**Answer:** Run it when `stacks-reopen-gate` fires, before any routine use.
The orchestrator builds one synthetic two-layer code stack with `gh stack`
v0.2.1 or later and merges it through the async merge endpoint
(`PUT pulls/<n>/merge-async`). Routine stacks start only if the test
passes. The test records, on this repository:
- a layer's `GITHUB_BASE_REF` and the base that gitleaks pins its config to;
- the cascade's `pull_request` activity and whether Heavy is re-admitted;
- the review-window behaviour against `review-window-on-cascade`;
- whether thread resolution is enforced per layer;
- whether rewritten commits are signed;
- which diff Greptile and Codex review.

**Rationale:**
- These facts feed only the gated Yeet stack work. Meanwhile the cheap
  pattern bans non-`main` bases, so nothing is exposed.
- Testing at the gate keeps the facts fresh. GitHub is still rolling out
  stack auto-merge and its docs contradict the GA changelog.
- The test costs about 3 Heavy matrices (~160 runner-min) and spends
  nothing now.
- Rejected:
  - Testing on the next natural chain now: an extra matrix plus a merge
    outside `merge-gate`, for facts nobody needs yet.
  - A synthetic test now: the same cost, with answers likely stale by
    reopen time.

## 2026-10-13 — unblocker-label

**Question:** How does the orchestrator mark a declared unblocker?

**Answer:** With a new repository label, `unblocks-main`. Only the
orchestrator applies it, to one PR per red episode. It is also the census
key for `automated-hold-trigger`.

**Rationale:** It is searchable and distinct from issue priority.
- Rejected:
  - A register entry only: the census would have to parse the register.
  - Reusing `priority/P0`: it already means issue priority.

## 2026-10-13 — packet-outcome

**Question:** What happens to the packet after align?

**Answer:** Park it, with re-entry triggers. Nothing graduates while the
reopen gate is shut. The packet reopens when either of these fires:
- `stacks-reopen-gate`, which brings the stack test and then the gated Yeet
  stack work from `yeet-slice-and-owner`;
- `automated-hold-trigger`, which reopens the main-red hold design.

The decided doctrine lands with this align PR:
- the S11 exception and its same-day deadline in the AGENTS.md
  "Mergeable" law;
- the unblocker rule in AGENTS.md "Inherited reds" and in the orchestrate
  skill;
- the dependent-lane rule in the Yeet skill.

The Yeet base-path fix ships as its own PR.

**Rationale:** Align settled every branch. Shape and decompose would only
restate gated candidates, and a goal would stay open indefinitely while
`main` health keeps the gate shut.
- Rejected:
  - Staying active and writing BRIEF and MAP now: ceremony with nothing
    promised now.
  - Killing the packet: the triggers would die with it.

Reground session 2026-11-09, one `/grill-with-docs` round through
AskUserQuestion after the packet had been parked four weeks. The evidence is
the 2026-11-09 section of [`RESEARCH.md`](./RESEARCH.md).

## 2026-11-09 — reopen-and-test-now

**Question:** The demand half of `stacks-reopen-gate` is met and the health
half is at 73.6% against 80%. What happens to the packet?

**Answer:** Reopen it at align and run the supervised native-stack test
now. Routine stacks stay off until the test passes and its results have
been through align.
- This supersedes the park in `packet-outcome` and the timing in
  `stack-test-terms` ("run it when the gate fires").
- The health half no longer blocks the test. Whether it blocks routine use
  is decided with the test results.

**Rationale:**
- Demand: 5 and 7 live dependency chains in the two weeks, against a bar
  of 3. Lanes built 18 live parent/child pairs by carrying the parent's
  commits onto a `main`-based PR, which the dependent-lane rule forbids.
- Health passed in week one (86.2%) and sits at 73.6% over 14 days.
  Nothing measured either half for four weeks, so the gate was never going
  to fire on its own.
- The cost objection is gone. A Check run is about 400 hosted runner-min
  and 25 self-hosted, with queue waits of minutes. On 10-13 the test was
  priced at three Heavy matrices on a saturated fleet.
- GitHub's side settled: GA is five weeks old, `gh stack` v0.3.0 fixed
  partially merged stacks, and the async merge endpoint is documented.
- Rejected:
  - Staying parked with a re-measure date (2026-11-23): it repairs the
    unmeasured gate but leaves the six facts unknown while lanes keep
    building chains by copy.
  - Shaping the Yeet stack slice now: it would rest on six facts nobody
    has verified on this repository.
  - Killing native stacks: 4 of the 12 structures are joins or fans a
    stack cannot express, but 8 are linear, and the test is cheap.

## 2026-11-09 — stack-test-shape

**Question:** What exactly does the test build and merge? This amends
`stack-test-terms`. Agent-decided under the autonomy charter.

**Answer:**
- **Three layers, not two.** L1 merges alone, so GitHub cascades over L2
  and L3. Then L2 and L3 merge together from the top.
- **Probe files as payload, labelled `ready-for-heavy`.** L1 adds
  `research/stack-probe-a.md` in this packet, L2 adds
  `research/stack-probe-b.md`, L3 deletes both. `main` ends with no net
  change. (Corrected 2026-11-10 to what ran: the first wording had one
  file that L2 edited, which would have hidden the diff base.)
- **Merges go through `PUT pulls/{n}/merge-async`**, squash, pinned with
  `sha`, `bypass_rules=false` first. If an inherited required red blocks
  the bottom layer, that refusal is recorded and the bottom layer alone is
  retried with `bypass_rules=true`.
- **This session runs it**, not the orchestrator. It owns the three PRs,
  keeps them draft until each merge step, and tells the orchestrator
  beforehand.
- **Facts recorded**, in `research/stack-test-2026-11.md`:
  - the six in `stack-test-terms`;
  - what `yeet final-check`, `yeet ready` and a `yeet merge-gate` read do
    on a layer, before and after the cascade;
  - the squash commits an atomic merge writes, and whether their messages
    pass server-side commitlint;
  - which Actions run, if any, the `stacked` activity starts.
- **Pass** means all three layers land through the async endpoint with no
  agent-side force-push, and every fact above has an observed answer.

**Rationale:**
- Two layers can show a cascade or an atomic top merge, never both. The
  third layer costs one more Check run on hosted runners.
- The admission label wins over the docs-only classification
  (`HeavyAdmission.ts:349-353`), so a labelled probe file exercises Heavy
  admission and its re-admission after the cascade. A code payload would
  add ratchet and coverage gates that say nothing about stacks, and would
  leave synthetic code on `main`.
- Each layer depends textually on the one below, so the cascade rebases a
  real dependency.
- AGENTS.md lets an agent merge its own PRs once mergeable. The
  orchestrator's gate merges through the legacy endpoint, which cannot
  merge a stack.
- The two-layer cap in `stack-layer-heavy` still governs routine use.
- Reversal: close the three PRs unmerged and delete their branches; if L1
  has landed, one PR deleting `research/stack-probe-a.md` restores `main`.
- Rejected:
  - A code payload, as `stack-test-terms` worded it: more gate noise and a
    revert PR afterwards.
  - Two layers in two rounds: twice the supervision for the same facts.
  - Waiting for a natural chain: its owner would carry the test's risk.

## 2026-11-09 — fan-out-stacking-doctrine

**Question:** Doctrine says two things. The Yeet skill, step 2c, forbids a
PR on a non-`main` base. Ruling B3 of 2026-11-05 lets a fourth change to a
packet be "stacked on it and retargeted when the parent merges". Which
stands?

**Answer:** Step 2c stands. "Or stacked" is struck from `AGENTS.md`, the
orchestrate skill, the Yeet `references/merge-loop.md` and
`goals/README.md`, and the 11-05 record carries a dated amendment. A fourth
change is sequenced through an existing lane until native stacks are
admitted.

**Rationale:**
- Every PR workflow filters on `branches: [main]`, so nothing runs on a
  non-`main` base. #2697 was opened on its parent's branch the day B3
  landed and merged into it six minutes later with no check run; CodeRabbit
  skipped it for the same reason.
- B3's purpose, the cap of three open PRs a packet, does not depend on the
  stacking alternative.
- Rejected:
  - B3 standing, with 2c amended to admit a base that is retargeted before
    final: nothing proves the PR until the retarget, and the retarget
    fires `edited`, which starts no workflow.
  - Leaving both: the next lane picks whichever line it reads first.

## 2026-11-09 — automated-hold-retired

**Question:** What happens to `automated-hold-trigger`, the deferred
automated main-red Heavy hold?

**Answer:** It is retired. The hold design is closed in this packet. The
inherited-red figures are filed in `explorations/github-merge-queue`, which
owns that problem.

**Rationale:**
- The hold existed to stop waiting PRs from starving an unblocker of Heavy
  runners. The seven `Heavy /` jobs now total 22–28 runner-min a head, and
  queue wait is p50 under 3 minutes and p90 under 8.
- Its census key no longer identifies an episode's unblocker:
  `unblocks-main` is on 151 of 782 PRs, against about 24 required-red
  episodes.
- S11 still stands, so the third arm ("S11 ends") has not fired.
- Rejected:
  - Re-keying the census on episode numbers: a measurement for a hold
    whose premise is gone.
  - Keeping it as written: nothing measures it.
- Reversal: restore the trigger if Heavy queue wait on unblockers returns
  to tens of minutes.

## 2026-11-10 — stack-test-result

**Question:** Did the supervised native-stack test pass, and what did it
settle?

**Answer:** It passed. #3049 merged alone and #3050 with #3051 merged
together, all through `merge-async`, with no force-push by the lane, and
`main` ended with no net change. The record is
[`research/stack-test-2026-11.md`](./research/stack-test-2026-11.md).

- Settled on this repository:
  - `GITHUB_BASE_REF` is `main` on every layer, while the event payload's
    base is the direct parent;
  - the cascade restarts CI and, under today's law, the review window;
  - a thread on any layer in the merge blocks the whole merge;
  - an atomic merge writes one squash commit per PR in one push.
- Not observed: Greptile's and Codex's review diff, a Heavy lane running
  on a layer, and the cause of a second server-side rewrite 38 seconds
  after `main` moved.
- One line of `stack-test-shape`'s rationale was wrong. Hosted admission
  gives a labelled docs-only layer `skip-satisfied`, so the probe did not
  exercise Heavy.

**Rationale:**
- The pass condition in `stack-test-shape` was met: three layers through
  the async endpoint, no agent-side force-push, an observed answer or an
  explicit NOT OBSERVED for every listed fact.
- Nothing on GitHub's side blocked a stack. Every blocker found is in
  Yeet: the legacy merge endpoint, the S32 push in `yeet ready`, the
  head-bound final-check receipt, and a review window that restarted twice
  in 30 minutes for a diff that never changed.
- Rejected: calling the test incomplete until the unobserved facts are
  filled in. They need a code layer and working review-bot quota, and the
  first real two-layer stack will supply both.

## 2026-11-10 — graduate-one-goal

**Question:** The test passed and every blocker it found is in Yeet. What
does the packet do next?

**Answer:** Shape, decompose and graduate one goal,
`yeet-async-merge-and-stacks`, in four phases: the async merge port, proof
that survives a rewrite with unchanged patch-ids, two-layer stack support,
and a measured pilot with kill criteria. The operator confirmed the shape
in [`BRIEF.md`](./BRIEF.md) the same session.

**Rationale:**
- The first two phases pay off with stacks off: the async endpoint is the
  merge queue's first step and makes a bypass an explicit request, and the
  rewrite rule removes a wait the test measured at 29 minutes.
- Demand is about four linear chains a week, built today by copying the
  parent's commits. That is too little to justify hand-run stacks with
  doctrine exceptions, and enough to justify one bounded week.
- This answers the three questions left open on 2026-11-09. The port is
  P0. The rest of the slice is P1 to P3 of the same goal. The 80% health
  bar no longer gates anything: the pilot rule is to open a stack only
  while `main`'s required checks are green.
- Rejected:
  - The async port alone, with stacks parked: it leaves the 18 live pairs
    a fortnight on the copy pattern.
  - Parking with the results: the blockers are known and small.
  - Killing native stacks: nothing in the test argues for it.
- Reversal: close the goal after P1 and restore the park.

## 2026-11-10 — second-rewrite-unattributed

**Question:** Who rebased layers 2 and 3 onto the new `main` at 02:54:20Z,
38 seconds after #3041 landed?

**Answer:** Unattributed. The operator did not, this session did not, and
no repo tooling calls a branch update. It is recorded as either another
session on the shared login or GitHub restacking a partially merged stack
when its trunk moves. The pilot (P3) has to settle which.

**Rationale:** The two readings lead to different designs. If GitHub does
it, a stack is rewritten about as often as `main` lands a PR, and the
rewrite rule in P1 is a precondition for any stack. If a session did it,
the do-not-rebase notice on the PRs did not hold and the rule needs
enforcing. One observation cannot tell them apart.
