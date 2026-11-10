# Decisions

<!--
Stage 2. The grilling log. One entry per resolved branch-closing question,
newest last. Unresolved questions live in ops/manifest.json `openQuestions`
until they land here. Deferred questions get an entry too, marked DEFERRED
with the reason.
-->

## 2026-11-09 — s11-under-a-queue

**Question:** A merge queue lands only pull requests whose required checks
are green on the merged tree. S11 lets finals merge over failing required
checks. Once a queue is on `main`, what happens to S11?

**Answer:** The queue replaces S11. At activation the queue becomes the only
door to `main` and S11 is retired. The ruleset bypass stays for one declared
unblocker per red episode. Until activation S11 stands exactly as it is.

**Rationale:**
- The two doctrines cannot share `main`. A bypass merge moves the base, and
  GitHub builds every group on the latest base, so each S11 merge would
  invalidate the groups in flight (`research/github-semantics.md` 3a, 5e).
- S11 exists because waiting for green was slow and unreliable: inherited
  reds, a heavy pool capped at two runners, Spot evictions. A queue removes
  inherited reds by construction; the gate ruling below makes speed and
  reliability the activation conditions. When those hold, S11 has no case
  left.
- 30 of 36 merges in S11's first days went over failing required checks
  (`research/prior-work.md`, 2026-10-13 row). The queue is therefore a
  doctrine change, not a tooling change, and it needed the operator.
- Rejected:
  - **S11 stays, kill the queue:** a legitimate outcome, declined.
  - **Both, bypass at discretion:** keeps the cost of the queue and discards
    its guarantee.

## 2026-11-09 — gate-restatement

**Question:** The activation gate is 80% of `main` runs green over 14 days.
It reads 73.8% on required contexts today and counts reds that S11 merges and
stale-base merges put there. What gates turning the queue on for `main`?

**Answer:** Properties of the merge-group run itself, measured on a lab
queue:

1. **Parity.** All 15 required contexts report on a group commit and prove
   what they prove on a pull request (no required job skips or degrades).
2. **Speed.** p90 wall time of a code entry's group run at or under 15
   minutes.
3. **Reliability.** False ejections at or under 5% over at least 100 entries.

This supersedes the 80% bar in every packet that cites it and the standards
decision of 2026-08-27, including its "evaluate the strict-status-check flip
first" step. The superseding entry is
`standards/architecture/DECISIONS.md`, "2026-11-09: Merge Queue Activation Is
Gated On The Merge-Group Run", landed with this ruling.

**Rationale:**
- The 80% bar is circular. It fell from 89.1% to 62.8% in the week merge
  volume doubled, it is read on the three in ten `main` commits whose run was
  not cancelled, and most of what it counts is what a queue removes
  (`RESEARCH.md`, Measurements).
- What hurts a queue is different: how long a group run takes and how often
  it fails on a good tree. With one build at a time, 15 minutes is 96 entries
  a day, which covers the measured peak day of about 95 code merges.
- Five percent of 40 code merges a day is two false ejections a day, each
  costing one slot when nothing is built speculatively behind it.
- The strict-policy step is dropped because at 53 merges a day strict means
  every merge stales every open pull request; a queue exists to give that
  guarantee without it.
- Rejected:
  - **Keep 80% required-green:** waits on a number S11 holds down.
  - **Both must hold:** inherits the same circularity.

## 2026-11-09 — verdict-placement

**Question:** `ten-minute-certainty` D7 plans one full hosted run for every
non-docs `main` commit after it lands. A merge group is the same run before
it lands. How do the two relate?

**Answer:** The merge group is that verdict. One run per commit, placed
before the merge. The post-merge push run shrinks to cache writes and
non-required lanes. "Per-SHA main groups" and "Merge queue" in
`explorations/ten-minute-certainty/MAP.md` become one gated candidate, owned
by this packet, after D7's throughput layout lands.

**Rationale:**
- D7 already accepts the cost: 20 to 36 thousand runner-minutes a day and
  about 62 jobs a run against a ceiling of about 60. Paying it before the
  merge costs no extra runs and turns an annotation into a gate.
- D7's first two steps (the cancel ban and the throughput layout for `main`
  pushes) are prerequisites for a queue as well and stay with that packet.
- Whether the post-merge run can be dropped depends on the landed commit
  being the tree the group proved, which is undocumented
  (`research/github-semantics.md` 6e, 6f) and is a lab observation.
- Rejected:
  - **Keep both:** two full runs per commit.
  - **Post-merge only, no queue:** reds still land; same as killing the
    packet.

## 2026-11-09 — first-slice

**Question:** What does this packet graduate first?

**Answer:** One goal: merge-group arms in `check.yml` and `heavy.yml`, a
docs-only verdict for groups, and a queue on a lab branch that settles the
undocumented GitHub behaviours and measures the gate. Activation on `main`
and the Yeet enqueue rework stay gated candidates in `MAP.md`.

**Rationale:**
- Parity is required before activation under any gate, old or new, and it is
  inert while no ruleset carries a `merge_queue` rule for `main`.
- Twenty-one behaviours the design depends on are undocumented; one lab
  observation each settles them, and no document can.
- The gate ruling above needs a place to be measured that is not `main`.
- The Yeet rework is the largest item and composes with
  `goals/github-state-worker`, whose phases are all pending.
- Rejected:
  - **Whole adoption now:** commits the Yeet rework before the lab says what
    states and events exist.
  - **Rulings only, then park:** leaves the gate unmeasurable.

## 2026-11-09 — pr-head-proof-at-activation

**Question:** When the queue goes live on `main`, what does a pull request's
own head still prove before it may enter?

**Answer:** Unchanged at activation. A head keeps tier 1, the admitted heavy
lanes and the full corpus replay. Slimming heads is a later gated candidate,
decided on measured ejection causes.

**Rationale:**
- With heads fully proven, a group run rarely finds anything the head missed,
  so ejections stay rare while the queue has one build slot and little spare
  capacity on a peak day.
- Total runs match what `ten-minute-certainty` D7 already plans: the head's
  runs plus one full run per commit.
- It keeps `ten-minute-certainty` D9 (full corpus replay on every pull
  request) and that packet's ruling against reducing proof depth in the name
  of efficiency.
- Rejected:
  - **Slim heads at activation** (speed-loop decision 38): a break would first
    show as an ejection about 20 minutes later and cost the queue a slot.
  - **Decide after the lab:** the lab measures GitHub's behaviour, not this
    trade-off; the data that decides it comes from the live queue.

## 2026-11-09 — sequencing-against-ten-minute-certainty

**Question:** Merge-group parity edits about 30 scoping sites in `check.yml`
and `heavy.yml` that `ten-minute-certainty`'s goals also rewrite. How are the
two sequenced?

**Answer:** The lab runs now and touches no shared site: a toy required check
on a lab branch settles GitHub's undocumented behaviours. The real `check.yml`
and `heavy.yml` arms start after `ten-minute-certainty`'s
`route-soundness-repair`, `heavy-pool-diet` and `hosted-setup-tax` goals have
merged.

**Rationale:**
- The docs-only verdict for a group inherits the change-profile selector,
  which `ten-minute-certainty` D8 found unsound until its census lands.
- Job-removing levers land before any lever that adds jobs against the same
  hosted ceiling; a merge-group run adds the most.
- The 2026-11-05 ruling exists because parallel edits to shared files left
  eleven siblings conflicting.
- Rejected:
  - **Parity now, in parallel:** the conflict pattern above.
  - **Fold parity into `ten-minute-certainty`:** that packet's goals are
    scoped to pull-request latency and `main` verdicts; merge-group semantics
    would widen every one of them.

## 2026-11-09 — queue-parameters

Decided by the agent under the autonomy charter; reversal is an edit to the
ruleset's `merge_queue` parameters.

**Question:** Which queue settings does the design assume?

**Answer:** `merge_method` `SQUASH`; `max_entries_to_build` 1;
`min_entries_to_merge` and `max_entries_to_merge` 1; `grouping_strategy`
`ALLGREEN`; `check_response_timeout_minutes` set from the lab's p90 with
headroom.

**Rationale:**
- One build at a time is forced by the hosted job ceiling
  (`RESEARCH.md`, Derived cost model), so nothing is built speculatively and
  an ejection never rebuilds a group behind it.
- With one build at a time there is nothing to group, and a group size of 1
  avoids the multi-PR squash class named in the 2026-04-23 incident
  (`research/github-semantics.md` 6e).
- `HEADGREEN` lets a failing entry merge beside a passing one, which defeats
  the purpose.

## 2026-11-09 — unblocker-under-a-queue

Decided by the agent under the autonomy charter; reversal is a doctrine edit
in the activation goal.

**Question:** The S11 ruling keeps the bypass for one declared unblocker per
red episode. How does an unblocker land when every group fails on a red
`main`?

**Answer:** Pause, jump, resume. The orchestrator sets build concurrency to 0
through the ruleset API, enqueues the unblocker with `jump`, restores
concurrency to 1, and the unblocker's own group run proves it. A bypass merge
is reserved for the case where the group run itself is what is broken.

**Rationale:**
- A jumped entry is still tested; a bypass merge is not.
- Under a queue `main` can still go red through a false green, a lane that
  only runs after the merge, or the environment, so the unblocker doctrine
  keeps a job, with a smaller one.
- Whether the merging identity may jump is undocumented for a GitHub App
  (`research/github-semantics.md` 5d, 10c) and is a lab observation; if it may
  not, the bypass becomes the unblocker route and this entry is revisited.

## 2026-11-09 — lab-venue

Decided by the agent under the autonomy charter; reversal is deleting the lab
branch and its ruleset.

**Question:** Where does the lab queue live?

**Answer:** On a dedicated lab branch in this repository with its own ruleset.
If GitHub refuses a second ruleset carrying a queue on a non-default branch,
the fallback is a public scratch repository in the organization.

**Rationale:** The real workflows, runner groups and App identities are only
exercised in this repository. The first phase uses a toy required check, so it
adds no load on the hosted job ceiling or the heavy pool.

## 2026-11-09 — brief-confirmed

**Question:** Does `BRIEF.md` match the picture in the operator's head?

**Answer:** Yes; decompose. The problem statement, the CI event-shape sketch,
the lab-first order, the one-week and two-week appetites and the no-gos stand
as written.

**Rationale:** Shape review, one loop. Nothing was revised.

## 2026-11-09 — gate-sample

**Question:** The reliability leg of the gate needs false ejections at or
under 5% over at least 100 entries. A hundred full lab runs cost about 40,000
runner-minutes. How is the hundred collected?

**Answer:** Mixed. Once parity proves a merge-group run and a `main` push run
are the same job set, first-attempt `main` push results count toward the
hundred. The lab supplies about 20 real merge-group entries that confirm the
two behave alike.

**Rationale:**
- The quantity being estimated is how often the required job set fails on a
  good tree. A `main` push run executes that job set on a tree that has
  already landed, and `ten-minute-certainty`'s scorecard will report it.
- Rejected:
  - **Lab entries only:** about 40,000 hosted runner-minutes for a number the
    push runs give for free.
  - **A smaller lab-only sample:** a wide error band on a 5% threshold.

## 2026-11-09 — goal-split

**Question:** The operator approved one first goal with two phases. Parity
waits on three `ten-minute-certainty` goals that do not exist yet, and a
started goal runs through to closeout. How is that packaged?

**Answer:** Split. `merge-queue-lab` graduates now and runs to completion.
`merge-group-parity` stays in `MAP.md` as a gated candidate; when its gate
fires, this packet reopens at `decompose`.

**Rationale:**
- A goal parked between phases on another packet's unwritten goals reads as
  active while nothing can move.
- The graduation contract already has the mechanism: gated candidates do not
  hold the packet open.
- Rejected:
  - **One goal, paused between phases:** legal (`time-to-certainty` does it),
    but it hides a cross-packet dependency inside a phase table.

## 2026-11-09 — cache-writer (DEFERRED)

**Question:** Cache-write credentials are push-only. Does a merge-group run
write the cache, or does the post-merge push run restore the group's outputs?

**Answer:** DEFERRED to `merge-group-parity`, with a kill condition: if
neither route is safe, the post-merge run cannot shrink and the
`verdict-placement` ruling is revisited.

**Rationale:** The answer depends on two lab observations (whether the landed
commit is the proven tree, and what credentials a group run sees) and on the
cache trust policy, which only matters once real lanes run in a group.

## 2026-11-09 — spot-eviction-handling (DEFERRED)

**Question:** Three required heavy lanes run on Spot and the runner-loss rerun
declines `merge_group`. What happens to an entry whose runner is evicted?

**Answer:** DEFERRED to `merge-group-parity`. Candidates on record: retry
inside the job, re-enqueue on runner loss, on-demand runners for group runs
(a purchase, so the operator's call).

**Rationale:** It needs the lab's answer on whether a rerun rescues an ejected
entry, and `ten-minute-certainty`'s heavy-pool diet may move the lanes first.

