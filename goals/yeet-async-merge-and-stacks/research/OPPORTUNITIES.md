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

## 2026-11-12 — The merge gate passed a PR that GitHub's ruleset refused

- **Doing:** the orchestrator gating #3133 with `yeet merge-gate --relaxed --force-window`.
- **Evidence:**
  - The gate printed GATE-MET twice. Then merge-async failed with
    "Repository rule violations found 3 of 15 required status checks are expected"
    (rule suites 5084941078, 5084928676).
  - An `unblocks-main` label applied after `ready-for-heavy` had started a second Heavy Admit run
    whose jobs skipped. GitHub's ruleset counts only the newest run of each workflow and event on
    the head, so the three `Heavy / *` checks that exist only in the admitted run read as
    expected.
  - Every check run, and the GraphQL `statusCheckRollup`, still showed them green, which is all
    the gate read.
  - The legacy merge endpoint had hidden the shape on earlier PRs (#3125, #3126), because an admin
    merge bypasses rules automatically.
- **Would have prevented it:** reading required checks the way the ruleset does (newest run per
  workflow and event), and a workflow that does not leave an empty suite after the admission
  label. Both land in the fix PR (decision `2026-11-12-shadowed-heavy-suite`).
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

## 2026-11-13 — A skill reference edit turned a docs PR into a Heavy PR after it opened

- **Doing:** publishing the pilot record (#3241), which adds one step to
  `.claude/skills/yeet/references/stacks.md`.
- **Evidence:**
  - `bun run beep skills update --check` reported `skills-lock.json` drift
    only after the PR was open. The publish cheap gates had passed without
    it.
  - `skills-lock.json` is not a docs-only path, so the second push made the
    diff non-docs. `yeet publish` decides the label when it creates the PR
    and an existing PR keeps its labels, so #3241 had no `ready-for-heavy`
    until the lane added it by hand at 07:13:57Z. The Heavy lanes then ran
    for a change of one hash.
  - `yeet final-check` coverage printed `coverage:affected: full fallback
    (.claude/skills/yeet/references/stacks.md: no current workspace owner;
    skills-lock.json: no current workspace owner)` and started a 10-shard
    run of the whole repository. The gate was skipped with that reason.
  - #3217 and #3245 each edited another yeet reference and left the lock as
    it was, so `main`'s lock went stale twice. #3225 then rewrote the same
    hash line and #3241 conflicted with it at 08:48Z. Its window and its
    Heavy run had already restarted once for the lock.
  - #3241 dropped the step and the lock at its third push and became a
    goals-only pull request. Coverage then planned nothing and its Check run
    finished in ten minutes. The step moved to #3254.
- **Would have prevented it:** the lock check in the cheap gates whenever a
  diff touches a skill directory; a docs-only class for `skills-lock.json` and
  skill references in Heavy admission and in coverage ownership; or a lock
  that hashes each file, so two edits to one skill do not meet on one line.

## 2026-11-13 — The hold thread the stacks reference asks for arms the owner's inbox

- **Doing:** holding both layers of stack #3244 with one unresolved review
  thread each, as `references/stacks.md` says.
- **Evidence:** each thread became a P1 `review-thread` row in the owning
  lane's inbox, and the tool-call hook asked for an ack before every command.
  The parent's row came back under a new id after its next push. Each row
  was acked `--wontfix` with the reason.
- **Would have prevented it:** a hold the inbox recognises, such as a thread
  whose first line is a fixed marker, or a `yeet` command that opens the hold
  and resolves it at the gate.

## 2026-11-13 — Both layers were flipped ready by the shared login, not by the lane

- **Doing:** keeping the layer #3243 a draft until its parent had merged
  alone and the observation was written.
- **Evidence:** the timelines show `ready_for_review` on #3241 at 07:42:00Z
  and on #3243 at 07:42:29Z, both by the shared login. The lane ran
  `yeet ready` on #3241 at 07:46Z and was told it was already ready, with
  nothing to flip. Both review windows therefore started at a flip the lane
  did not make, and the layer's started before its content was final. The
  hold threads kept both from merging.
- **Would have prevented it:** nothing within the lane's reach. A draft is
  not a hold. It is recorded so that a pilot row whose window starts early is
  read correctly.

## 2026-11-13 — A parent that changes costs the cascaded layer its review window

- **Doing:** landing stack #3244 bottom-up with `merge-gate 3241 --alone`.
- **Evidence:**
  - The layer's own commit kept its patch-id across the cascade, and
    `git merge-tree --merge-base=<old base> <new base> <old head>` gave the
    cascaded tree exactly. `yeet gh pr status 3243` still read
    `review window: ready=07:42:29Z pushed=09:26:45Z age=1m`.
  - The head-move classifier's step 8 holds a squash to "the new base absorbs
    all old base content". `git merge-tree <squash> <old base>` was not the
    squash's tree: the parent had rewritten lines of its own and dropped a
    step after the layer was cut.
  - The other route, merging the parent's branch into the layer after each
    parent push, puts a merge commit in the layer's range, which step 2
    rejects.
- **Would have prevented it:** a rule for the case "the layer's own patches
  and replay tree are unchanged, and the base moved only by the parent's own
  later commits", or `--alone` warning that the layer's window will restart.
  Slice B's carry was built from recorded heads whose parents never changed.

## 2026-11-13 — Two small traps on the way to a push

- **Doing:** pushing a commit made with `git commit`, and handing a code
  change back after `quality package-verify`.
- **Evidence:**
  - `yeet publish --push-only` refused the hand-made commit: "requires
    --reuse-verified unless HEAD is a reproducible merge of the base into the
    published branch". `yeet publish --amend --no-edit` pushed the same
    commit unchanged ("skipped commit; clean local HEAD … is ahead").
  - `quality package-verify @beep/repo-cli` passed (lint, audit, docgen) on a
    file where a helper had been inserted between a JSDoc block and its
    exported function. The pre-commit `jsdoc` hook then rejected the commit:
    `check-param-names` and `require-jsdoc`.
- **Would have prevented it:** the refusal naming the command that works, and
  the package's `lint:jsdoc` in the package handoff.
