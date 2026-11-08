# Retained readiness failure after PR #2577

PR [#2577](https://github.com/beep-effect/beep-effect/pull/2577) merged at
2026-11-02T16:43:12Z with accepted head
`21bd9780970b815bedcc4711a301de0c28cca409` and merge commit
`56b7b7ad63cad393950f80a3c907844d469c9758`. The claim-check owner had not
released its strict merge hold or issued a merge command.

All 15 required hosted contexts were green before merge. The separate hosted
coverage comparison was still queued. The existing until-ready job
`23e6ebf4-a329-449c-a458-81ae1ba6661d` ended at
2026-11-02T16:44:06.409Z, after merge, with normal exit status zero. Its final
status reports `mergeReady.ready=false`, failing `pr-open`. A successful
process exit on a closed PR is not a positive readiness result.

The canonical verdict remains a successful **closeout** verdict. It is not a
head-bound positive **monitor** verdict. The completion refresh consequently
reports `unknown`: hosted required checks are verified, but the gating Yeet
verdict is unknown. Neither the old verdict nor its timestamps may be edited
to manufacture pre-merge evidence.

GitHub's timeline identifies the merging account, but does not identify the
initiating local process. The available records do not establish whether a
person, another agent, or an automation initiated that account's merge. No
specific merge script is attributed without evidence. The owner retained the
PR metadata, job and status records, raw policy log, and completion receipt in
its external proof archive and notified the shared coordination record.

## Recovery controls

Use a dedicated recovery worktree and publish the next final PR as a draft.
Keep the draft until its final declaration and hosted verification are ready
for the owner-controlled readiness sequence. Disable auto-merge if enabled.
Do not arm a generic merge waiter or release the owner hold on a successful
process exit alone. After marking ready, require the ordinary review window,
all non-Vercel hosted checks, resolved review threads, terminal readiness
evidence, and a genuine positive exact-head monitor verdict. Archive those
records before issuing a head-pinned strict merge command. Run completion
refresh after merge and inspect the actual receipt before projecting
`completed-retained`.

These controls reduce accidental early merges; they cannot prevent an
independent account holder from directly merging a PR. A repeated external
bypass must remain an explicit coordination blocker rather than trigger a
weaker completion rule.

This is a delivery-evidence recovery, not a new algorithm measurement. The
retained v27 result remains **37/538**, including all 34 protected and all 37
previously passing claims. Reference labels, source fixtures, previous
measurements, uncertainty, optional attorney authority, and runtime scope
exclusions remain unchanged.
