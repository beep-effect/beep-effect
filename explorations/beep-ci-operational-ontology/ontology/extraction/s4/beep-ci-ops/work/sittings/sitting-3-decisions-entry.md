## 2026-09-03 — run-2 sitting 3 (ratification docket, steward: Benjamin, locked via /grill-with-docs)

Docket: 44 converged proposals (final reviews 21 PASS / 23 INDETERMINATE / 0 FAIL after
three adversary rounds) presented as ratify-candidates (17), flagged submissions (6),
and withdrawals (21 + the stale-review conformance-evidence chain). The grill surfaced
one defect in the docket itself before locking: `hasStep` and `stepIndex` both bind
`ScheduleStep`, which is withdrawn and unratified, and share the pinned CQ-020 wording
problem — ratifying them would mint the `admittedBy` defect class into the taxonomy.

**Ruling 1 — ordering pair deferred:** `hasStep` and `stepIndex` join the run-3
deferral; the full ordering cluster (ScheduleStep and its four relations) ratifies
together after the CQ-020 wording amendment. No dangling ends enter the taxonomy.

**Ruling 2 — 15 ratify-candidates adopted as drafted:** per-proposal verbatim decisions
scribed into rat-032..rat-046 (FailureSignature, VerificationAttempt, the SeatRequest /
DocgenAffectedWorkUnit / FallowAuditLane / WorkUnitSpecification / VerificationLane
reuses, dependsOnTransitive, four AdmissionPolicy component-content mappings, dependsOn
as a plain property, resolved CachePosture as a recorded value, Agent as the anti-rigid
admission-owner role) — the last three carrying the sitting's seat-dispute rulings
(none over relator; information_object over mode; role over kind).

**Ruling 3 — 6 flagged submissions adopted as drafted:** rat-047..rat-052 accept reuse
mappings onto ratified evidence/plan/priority classes with identity-provenance choices
explicitly deferred to run 3 as flagged.

**Closure:** the 24 withdrawn/deferred proposals and their reviews were removed per the
run-1 close precedent (bytes preserved in git history); their observation rows re-parked
with named run-3 evidence; the unresolved-fraction waiver (56%, every park adjudicated
at sittings 1-3) entered the manifest; post-scribe gate: ARTIFACTS VALID — GATE PASSED,
flags only. Run rotated to runs/orun-2026-09-03T02:46:18Z (observations archived under
extraction/s4/archives/ per the v13 scanner-defect relocation).
