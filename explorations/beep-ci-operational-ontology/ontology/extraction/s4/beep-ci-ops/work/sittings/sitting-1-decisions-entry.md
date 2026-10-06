## 2026-10-06 — run-4 sitting 1 (adversary adjudication, orchestrator under the autonomy charter)

Docket: 15 adversary reviews over 14 proposals (round 1: 11 PASS / 4 FAIL, no INDETERMINATE;
round 2: the revised change-landing class, PASS), three proposals already withdrawn at sitting W1,
and the review-validity audit by three independent auditors who read the closure only
(`work/review-audit/validity-report-r1-{chg,vfy-admission,vfy-verification}.md`). Every landed attack
the audit examined is demonstrated; none is struck. Of the 11 latest PASS reviews, 6 are sound
(change-landing, admission-charge, seat-grant, seat-request, committed-failure, verification-lane)
and 5 are not, each for an attack the reviewer tried with a twin or a record reading the closure
refutes.

**Ruling 19 — four missed attacks land; one is outside the reviewer's standard.** The sitting lands:
on `otp:vfy-lane-execution:001`, identity (the cited verdict record's durations show the wrapper lane
containing its 32 child lane executions, which the card says the record does not show, and the same
record and a ledger fact share one attempt and one duration, which bears on the two-referent rival);
on `otp:vfy-tree-state:001`, the null discriminator (every shared head value in the chain is equally
shared by a per-attempt or per-run writer stamp); on `otp:vfy-merged-preview-work-kind:001`, the null
discriminator (the still-viable charge-code reading makes every cited charge fact true); on
`otp:vfy-admission-work-kind:001`, the warrant (Ruling 20). The audit's null attack on
`otp:vfy-verification-attempt:001` does not land: VerificationAttempt is a Queue A recorded-value
reuse deferral, and the adversary brief judges a reuse that keeps its flag on semantic match only, the
standard the reviewer applied. Its warrant falls under Ruling 20. Rejected: re-running the adversary
blind on unchanged bytes (the reviewer may miss again, and the audit already shows the attack from
the closure).

**Ruling 20 — a decision warrant needs a query that uses the term itself.** A Must/Should CQ warrants
a decision term only when its executable query types by the class, uses the property, or names the
individual. A query that binds the referent as an untyped join or harness-bound node, with the class
only in `required_classes`, needs the individual but not the term, and warrants nothing (the briefs'
"a CQ that only mentions the term warrants nothing", applied to the query text). Such a term takes the
support arm toward a same-run decision term it is necessary to define, constrain or disambiguate, or it
defers. This reaches `otp:vfy-admission-work-kind:001` (CQ-021 reaches the kind only as the object of
`hasWorkKind`), `otp:vfy-tree-state:001` (no CQ-005, CQ-006 or CQ-014 query types the tree) and
`otp:vfy-verification-attempt:001` (CQ-022 joins executions to the attempt without typing it); the
other proposals' queries type their terms. Rejected: reading `required_classes` as a warrant (it
licenses every listed class with no query need).

**Ruling 21 — the semantic-match exemption covers flagged reuses only.** A reuse is attacked on
semantic match only when the ratified term is flagged in TAXONOMY or is one of the Queue A
recorded-value reuse deferrals (SeatRequest, SeatGrant, VerificationAttempt, VerificationResultArtifact)
and the proposal says the flag persists and claims no lift. Every other reuse, including an unflagged
literal member such as MergedPreviewWork, takes the full standard on every surface.

**Ruling 22 — how the landed attacks reach the seats.** An attack the sitting lands on a hypothesis or
analysis reaches that record's own seat as a `landed` row (call (ab) shape; the sitting is the one that
landed it) and then the synthesis seat as an `upstream` row; a Ruling 20 warrant defect reaches the
synthesis seat as a `ruling` row. A chain whose null then stands is withdrawn at a further sitting. A
revised proposal is reviewed by a fresh adversary at its own next round. No validity-audit text reaches
any seat.

**Ruling 23 — questions held for sitting 3.** The change-landing class keeps its CQ-016 warrant (the
query types it), but `landedAt` has no surviving chain, so CQ-016 cannot return a row on run-4
vocabulary; sitting 3 decides whether the class ratifies alone. PASS with DISPUTED is the intended
outcome when a proposal carries steward-choice rivals, and an explicitly deferred proposal submits
FLAGGED; sitting 3 rules each. Identity rivals carried as steward-choice issues on an analyzed verdict
(committed-failure's obsoletion point, verification-attempt's request alias) are allowed, and sitting 3
weighs them. Reuse proposals that carry rigidity unresolved over a ratified rigid row meet the step-8
OntoClean rule at sitting 3; no prior ratification changes before then. Tracked follow-ups: the
change-landing proposal's "later P0 Ruling 3" wording (the closure-grounded reason is that a row
records a merge commit), and the seat-grant proposal's open issue that names the withdrawn checkout
proposal. Reversal: a later sitting supersedes any ruling here.
