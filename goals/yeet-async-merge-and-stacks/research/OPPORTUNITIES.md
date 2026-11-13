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
