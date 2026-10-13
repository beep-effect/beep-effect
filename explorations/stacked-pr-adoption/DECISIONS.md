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
