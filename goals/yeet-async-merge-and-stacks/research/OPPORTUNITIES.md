# Opportunities & Friction Receipts

Dated receipts recorded while the work happened. Paths are repo-relative; no
machine or session identifiers.

## 2026-11-10 — Two sessions built slice A at the same time

- **Doing:** publishing slice A (async merge) from a lane launched with
  `/goal` on this whole packet.
- **Evidence:**
  - A second session, launched about the same time by a coordinating session
    with the brief "deliver slice A only", edited the same nine files
    (`GithubRest.ts`, `GhOps.ts`, `Merge.ts`, `MergeGate.ts`,
    `OwnerCheckpoint.merge.ts` and their tests).
  - Neither lane had pushed, so `gh pr list --head`, the session ledger and
    the PR inbox showed nothing to collide with. The overlap surfaced only
    through a process listing during an interrupted `yeet publish`.
  - The operator kept the coordinator's lane for slice A; the `/goal` lane
    stood down with three verified, unpushed commits and moved to slice B.
- **Would have prevented it:** a claim recorded when a lane starts a slice,
  before any push. For example, `bun run beep goals decisions add --kind
  checkpoint` naming the lane, read by any session that opens the same slice,
  or a `session note --state open` row keyed to a goal slice that
  `session open` surfaces to a second claimant.

## 2026-11-13 — The slice C brief and two docs described a push `yeet ready` no longer makes

- **Doing:** slice C's P0 research, "wake `beep-reviewer` without the S32
  commit".
- **Evidence:**
  - `.claude/skills/yeet/references/merge-loop.md` (Ready) and
    `explorations/stacked-pr-adoption/research/stack-test-2026-11.md` both
    said `yeet ready` pushes an empty `chore: re-request beep-reviewer (S32)`
    commit after the flip. The packet's `PLAN.md`, the brief's rabbit holes
    and the slice brief were written from them.
  - `requestReviewerComment` in
    `packages/tooling/tool/cli/src/commands/Yeet/internal/ReadyGate.ts` has
    posted an exact-head comment instead since #2791 (2026-11-06), four days
    before the stack test. The push is only a fallback for an uncovered
    author.
  - The question took a code read to dissolve; the probe then only had to
    confirm the comment works on a layer.
- **Would have prevented it:** #2791 changing `merge-loop.md` in the same PR
  as the behaviour, as the skill's own target-surface rule asks. Slice C
  corrects the reference.

## 2026-11-13 — Probe PRs were merged by the shared login while the lane was reading them

- **Doing:** P0 probes on a throwaway base: flip two stacked probe PRs ready,
  post a reviewer request, watch for the review.
- **Evidence:**
  - #3148 merged two minutes after its ready flip; #3149, #3154 and #3155
    followed within twenty minutes. Each body's first sentence said not to
    flip, gate, resolve or merge it. The lane sent none of those merges and
    the timelines name the shared login with no app.
  - #3149's review evidence was spoiled: the cascade from #3148's merge
    force-pushed it seven seconds before the reviewer's summary arrived.
  - The probe was re-run as a two-phase script (#3154, #3155) to separate
    "ready" from "requested", and a third stack (#3157, #3158) was merged
    within seconds of its flip to get the from-the-top result before anything
    else could.
- **Would have prevented it:** a do-not-merge signal that a hand merge sees
  without opening the PR, such as a title prefix, since a body sentence is
  not read. Probes that must be ready should stay ready for seconds, not
  minutes.
