---
title: "Third goals-only re-final after #2962 merged before its readiness was recorded"
date: 2026-11-10
lane: "vault-sync-refinal3 worktree"
reversal: "Restore proposedCloseout.finalPullRequest, the final gate entry and the yeet-verdict ref to #2962 and its run"
---

Re-final #2962 was flipped ready and merged two minutes later (2026-11-08T11:35:24Z, 7338e3773c). Its only finished until-ready job before the merge ended at 11:23:26Z with `not merge-ready: blocked on not-draft`; the job that was running at the merge finalized after it and overwrote `status.json` with a post-merge snapshot.

`goals completion refresh --slug alchemy-vault-sync-slice --readiness-job <first job>` on 2026-11-10 therefore reports `unknown`: hosted required checks verify (15 green contexts at the accepted head, merge-push rule suite pass), and the gating `yeet-verdict` is refused with "status was recorded after job end". No retained artifact records pre-merge readiness, so #2962 can never verify.

All product work is on `main`; nothing is reverted. A third goals-only PR takes over as final: `proposedCloseout.finalPullRequest`, the gate final entry and the verdict ref move to it, and #2962 becomes supporting. Its monitor runs detached from the ready flip and the PR merges only after that job records `merge-ready: yes`; then the refresh runs from this lane before it is retired, and a packet-state PR adopts `completed-retained`.
