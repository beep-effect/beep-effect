# Opportunities

Friction receipts recorded while working this packet.

## 2026-11-07: goal closeout PRs merged before readiness, twice

- **Doing:** closing the packet out through a docs-only re-final PR whose
  `proposedCloseout.finalPullRequest` must name the PR itself.
- **Evidence:** #2794 merged 2026-11-06T19:04Z while both until-ready monitors
  were stopped at the draft gate, so `goals completion refresh --slug
  goal-packet-conflict-free-appends --readiness-job <id>` printed `unknown`.
  The replacement, #2869, merged 2026-11-07T06:44Z at its first commit, which
  named a predicted PR number (#2848, already taken by another PR); the bind
  commit to #2869 was still local, and the session ledger row said `HOLD MERGE`.
- **Would have prevented it:** (1) a merge-gate hold that reads the goal
  packet: refuse a PR that sets `proposedCloseout` until its until-ready job
  records `merge-ready: yes`; (2) a `goals` check that fails when
  `proposedCloseout.finalPullRequest` does not name the PR carrying it;
  (3) never predicting PR numbers. Open the draft first, then push the bind
  commit before flipping it ready.
