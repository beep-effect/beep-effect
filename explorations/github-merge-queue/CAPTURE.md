# Capture

<!--
Stage 0. Append-only raw dump: thoughts, links, screenshots (drop files in
assets/ and reference them), half-sentences, contradictions. Nobody tidies
this file; cleaning it up destroys provenance. New material goes under a new
dated heading at the bottom.
-->

## 2026-09-16

### Where this comes from

- Time-to-certainty item B9, "GitHub merge queue". The B8 heavy-check
  admission brief (`goals/time-to-certainty/research/b8-brief.md`, "Rejected"
  and the PR C paragraph) promised this capture as a docs-only PR after PR B
  merged, doubling as the acceptance probe for the docs-only admission filter:
  heavy lanes report `skipped`, the ruleset is satisfied, `--until-ready`
  exits 0, no heavy runner spent on this head.
- Ruling 56 (B8-7) in `goals/time-to-certainty/research/decisions.md`:
  merge queue is B9, captured not scheduled. It needs the `merge_group`
  trigger on every required workflow, a flake budget, a merge-group tail in
  `--until-ready`, and an `/explore` grill first. B8 only reserves the
  `merge-group` admission source and never substitutes a global `concurrency`
  group (one pending slot, no FIFO).
- Standing rule in `goals/time-to-certainty/GOAL.md` and `SPEC.md`
  ("Explicitly rejected"): no merge queue before the recorded flip condition
  (ship-velocity E8). `goals/ship-velocity/research/merge-queue-evaluation.md`
  (2026-08-27) measured `main` full-gauntlet success at 65.4% of non-cancelled
  terminal runs over 14 days against an 80% gate, with no `merge_group`
  coverage in any workflow; queue stayed off, strict required checks stayed
  false.

### The problem

- Heavy runner queue depth. Ruling 57 (B8-8) says throughput is heavy
  duration times queue depth under any admission design; B8 cut what is
  admitted, not how many admitted heads compete for `beep-ec2-heavy`. A merge
  queue serializes required checks on merge-group commits, so the pool sees
  one merge candidate at a time instead of every green PR racing to merge.
- Authority moves from "merge" to "enqueue". Today the operator (or the
  agent, when asked) presses merge after `yeet monitor` reports
  `merge-ready: yes`. Under a queue the same green state buys an enqueue, and
  the queue merges on green of the merge-group commit. Everything downstream
  that reads "merged" as the terminal event (closeout, sweep --retire,
  packet status flips) has to learn the queue states in between.
- B8 chose capture-not-schedule because the flip condition is unmet and the
  trigger surface is untouched; scheduling the queue while `main` pushes are
  red a third of the time would eject and rebuild constantly.

### GitHub facts (verified 2026-09-16 from docs.github.com)

- The merge queue fires the `merge_group` workflow event with only the
  `checks_requested` activity type.
- Every workflow that provides a required status check must add that
  trigger, or a PR in the queue never reports and never merges.
- Required checks run on the merge-group commit (the candidate merge of the
  queued PRs onto `main`), serialized in queue order; the queue merges when
  they are green.
- A failing required check ejects the PR from the queue and the queue
  rebuilds the merge-group commits behind it.

### Design questions to grill (not answered here)

1. `merge_group` trigger on `check.yml` and on `heavy.yml@main`. `check.yml`
   is the only workflow providing the required `main` contexts today
   (`Heavy / *` come through its `workflow_call` to `heavy.yml@main`). What
   does the tier 1 matrix look like on a merge-group commit, what does the
   `pr-size` job do without a PR number, and does the reusable `heavy.yml`
   need its own trigger or only its caller?
2. The admission verdict for `merge_group` is `run`. `HeavyAdmissionSource`
   already reserves `"merge-group"` and `decideHeavyAdmission` maps
   `merge_group` to it (B8 branch, `commands/Ci/HeavyAdmission.ts`), so a
   queued head always spends a heavy runner. Is that right for a docs-only
   PR that skipped heavy on its own head, or does the queue entry inherit the
   PR's docs-only verdict?
3. What `--until-ready` means under a queue. Proposed: tier 1 green,
   review threads resolved, closeout bound (the current definition), then
   enqueue, then a merge-group tail via `gh api` for the queue entry's head
   until it merges or is ejected. Ejection is a new terminal reason the
   monitor has to name.
4. Flake budget and fingerprints. An ejection rebuilds every entry behind
   it, so one environment-only red costs the whole queue, not one PR. The
   A5 journal fingerprints and the false-red proxies (M4) have to be trusted
   before a queue is worth it; the flip condition is the crude version of
   that budget.

Never a global `concurrency` group as a substitute: one pending slot, newer
cancels older, no FIFO (B8 rejected list).

### Acceptance criteria (for the grill to ratify or rewrite)

- Every workflow providing a required `main` check carries
  `merge_group: types: [checks_requested]`; a queued PR reports every
  required context on its merge-group commit.
- `bun run beep ci admission` returns `run` with source `merge-group` on a
  `merge_group` event, unit-tested, and the monitor's `heavy-not-admitted`
  reason never fires for a queued head.
- `yeet monitor --until-ready` (B7) tails the queue entry after enqueue and
  exits 0 on merge, non-zero with a named reason on ejection.
- The flip condition is re-measured on the live `check.yml` push history
  and at or above 80% before the ruleset's `merge_queue` rule is enabled;
  the measurement is on record in the packet.
- No global `concurrency` group across PRs; the existing per-ref group stays.

### Status

Captured, not scheduled. Pending an `/explore` grill and the E8 flip
condition. This capture PR is the B8 docs-only acceptance probe; if the
heavy lanes do not report `skipped` for this head, that is a B8 finding, not
a B9 one.
