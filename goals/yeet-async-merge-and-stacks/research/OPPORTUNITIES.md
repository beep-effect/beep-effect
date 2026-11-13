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
## 2026-11-13 — Deleting a service method broke another goal's frozen evidence

- **Doing:** deleting the legacy merge call from `GithubRest` to close
  slice A.
- **Evidence:**
  - `bun run beep quality package-verify @beep/repo-cli` (lint, audit,
    docgen) and the cheap-gates proof both passed on the change.
  - `yeet final-check` then failed `repo-sanity:goals-ops-typecheck`: the
    frozen pre-W4 copy of the Yeet GitHub operations under the
    repo-cli-gh-git-consolidation packet's ops directory still called the
    deleted method (`error TS2551: Property 'mergePullRequest' does not exist
    on type 'GithubRestShape'`).
  - The frozen files import the live service, so any removal from that
    service can break them. A repo-wide search for the method name did list
    the frozen file; it was read as an archived copy, not as compiled code.
  - The differential that owns the frozen copy reads only its thread-count
    function. The fix was to make the frozen merge step refuse, with the
    deviation stated in the file header.
- **Would have prevented it:** running the goals ops typecheck in the
  package handoff or the cheap tier when a diff removes an export from the
  repo CLI's shared internals. It took seven seconds here. A frozen copy that
  vendored the service calls it needs, instead of importing the live
  service, would not break at all.

## 2026-11-13 — The first parent layer was merged before a layer could be stacked on it

- **Doing:** opening the proof stack. #3170 (the P0 record) was published as
  a draft at 01:34Z to serve as the parent.
- **Evidence:**
  - Its timeline shows `ready_for_review` at 01:35:36Z and `merged` at
    01:45:16Z, both by the shared login, inside the review window and with no
    reviewer review. The lane did neither, and its body's first line said not
    to merge it by hand.
  - The stack had to be rebuilt on a second parent (#3188), and both layers
    were opened only after their final-check receipts existed so they could be
    flipped by `yeet ready` within a minute of opening.
- **Would have prevented it:** a hold a hand merge cannot miss. An unresolved
  review thread is one, because the ruleset then refuses any merge without a
  bypass. `references/stacks.md` now says to hold a layer that way.

## 2026-11-13 — A hold label shadowed the Heavy run on both layers

- **Doing:** protecting #3188 and #3189 with `owner-merge-hold` right after
  `yeet ready`.
- **Evidence:**
  - `heavy-admit.yml` runs on every `labeled` event from a user token and
    skips at job level for other labels. Each PR got a second Heavy Admit run,
    `completed/skipped`, 90 seconds after the real one started
    (runs 43358796559 and 43358800873).
  - The orchestrator had already seen GitHub refuse #3133 with required
    `Heavy / *` checks counted as missing behind such a run.
  - The label was removed and `ready-for-heavy` re-applied on both, which
    queued a second full Heavy matrix per layer behind the first.
- **Would have prevented it:** `heavy-admit.yml` filtering non-admission
  labels before a run is created, which the `merge-gate-shadow-suite` lane is
  working on, or Yeet refusing to add a label after `ready-for-heavy`.

## 2026-11-13 — Three heavy local runs at once made unrelated suites time out

- **Doing:** `quality package-verify @beep/repo-cli` on the tooling lane while
  two `yeet final-check` runs covered the two layers.
- **Evidence:**
  - package-verify: 10 timeouts at 30 s in `worktree-command`,
    `worktree-remove-fence` and `yeet-sweep-retire`; all three files pass
    alone (62, 13 and 47 tests).
  - final-check coverage on the parent: one 90 s timeout in
    `knowledge-doctor.test.ts`, 32 of 32 alone. The same gate then failed on
    both layers for inherited new-file coverage rows (`Ci/Certainty.ts`,
    `Ci/CiBinaryClosure.ts`, `Lint/CoverageOwners.ts`) after 42 minutes each.
  - `final-check --resume` reran every gate, not only the failed one.
- **Would have prevented it:** the coverage ratchet attributing rows for
  files the head does not touch as inherited instead of failing, and
  `--resume` reusing the gates that passed on the same head.
