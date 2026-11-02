# Final goal acceptance requires a strict pre-merge hold

Implementation PR #2411 and measurement/closeout PR #2502 are merged. The
orchestrator merged #2502 as `7a267d1ab519241217335d347e2f117c00e49ef3` at
2026-11-02 06:15:01 UTC under S11, with lint and unit contexts still pending.
The [merge record](https://github.com/beep-effect/beep-effect/pull/2502#issuecomment-6570469983)
explicitly records those pending contexts. The owner had not obtained a passing
readiness receipt; cancelled prerequisites subsequently made the lint/unit
aggregate checks fail. This is not an all-green hosted proof.

The canonical completion provider in `Goals/CompletionEvidence.ts` checks both
check-run start and completion timestamps against the merge timestamp. A later
rerun cannot retroactively create pre-merge green evidence for that accepted
head. No receipt, timestamp, exception flag or historical measurement is changed
to bypass this boundary.

A final metadata-only follow-up therefore needs **STRICT** merge gating, like
other goal-completion lanes: hosted required checks green, normal review window,
zero outstanding threads, and an authentic canonical readiness record before
merge. Keep that PR in draft while binding its final declaration, and hold any
relaxed/S11 merge until the owner has recorded normal readiness. This is a goal
acceptance dependency, not a request for additional local verify/publish work.
All ready work is pushed and the PR is opened promptly; hosted CI is the proof.

All 21 v24 algorithm file hashes remain unchanged. Main #2507 changed
`bun.lock` after `cf602d2072`; the [v25 dependency-compatibility replay](2026-11-02-v25-dependency-compatibility.json)
pins that lockfile, the root manifest and the Bun version alongside those 21
files before prediction. Both cohort result values match v24 apart from the
implementation digest, and all 251 prediction reports are byte-identical.
No parser, scorer, source claim or reference label changed. The fixed result
remains 37/538 with all 34 protected and all 37 prior matches retained. The v24
report and raw results, v25 compatibility evidence, historical review identity,
restored v11 bytes and dated reflection remain the acceptance evidence.

The operative lifecycle stays active. A new prospective final-PR declaration
will be bound to the follow-up and its own canonical readiness/merge receipt.
Only verified completion may project `completed-retained`.

Reversal: remove the temporary merge hold after normal final-head readiness is
recorded. Retain both S11 merge records and this explanation; do not relabel
cancelled checks as passing.
