## 2026-10-06 — run-4 withdrawal sitting W3 (orchestrator under the autonomy charter)

Adversary round 3, the last round under Ruling 11, closed the review loop. `otp:vfy-lane-execution:001`
(WorkUnitExecution) passed: the round-2 rule did not land again on the revised definition, which now
counts an execution from its start, and its one rival (a process counted while running) makes it
DISPUTED. `otp:vfy-admission-work-kind:001` (AdmissionWorkKind, an exact reuse moved to the support arm
under Ruling 20) failed again on `support-not-necessary`, with a new counterexample: CQ-021 already keeps
the work kind and the priority apart on two properties with distinct member names, so the class could
disambiguate them only as the range of `hasWorkKind`, which is parked with its range unknown, and no
cited chain carries the publish-and-publish case it would separate.

**Ruling 27 — withdraw the round-3 FAIL with named evidence.** `otp:vfy-admission-work-kind:001` is
withdrawn on the Ruling 18 procedure. It returns only with: a ratified range of `ciops:hasWorkKind` equal
to AdmissionWorkKind (an S6 refresh) together with a SeatRequest constraint that a request has exactly
one work kind from that class; or a pinned Must/Should CQ whose query types the kind; and, for the
disambiguation case, an admission chain carrying kind and priority both equal to publish. No proposal
depends on it. The ratified AdmissionWorkKind row is untouched: this withdraws a run-4 reuse proposal,
not a prior ratification. Reversal: a later run re-presents the reuse from a chain citing that evidence.
