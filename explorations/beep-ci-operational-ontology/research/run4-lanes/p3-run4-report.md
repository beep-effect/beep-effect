<!-- Run report for goal phase P3 (W7, auditor run 4), written by the orchestrator at run close on 2026-10-06. -->
# Auditor run 4 — run report and tracked follow-ups

Run `orun-2026-10-06T15:51:01Z`, pin `71c7357adc` (tag `evidence/beep-ci-ops/orun-2026-10-06T15-51-01Z-pin`).
Authority for every call below is the goal decision log (`goals/ciops-ontology-pipeline/research/decisions.md`,
the 2026-10-06 entries: the launch sitting, calls (a)–(aj), sittings W1, 1, 2, W2, W3 and 3).

## Outcome

| Stage | Result |
| --- | --- |
| Observation | 109 source (adapter-journal v1.3.0) and 95 prose observations, five batches |
| Denotation | 54 hypotheses after consolidation (chg 6, vfy 36, lpl 12); 17 survived |
| Foundational | 17 primary pairs, 17 blinded pairs; three repair rounds answered 83 landed rows |
| Synthesis | 14 proposals (chg 1, vfy 13); 3 surviving chains needed a Must/Should CQ and got none |
| Adversary | rounds 1–3; review-validity audit before sitting 1 (6 PASS sound, 5 unsound) |
| Withdrawals | 6 with named evidence (Rulings 18, 26, 27) |
| Ratification | 8 flagged accepts, rat-071..rat-078 (Rulings 28–32) |
| Index | 342 rows (204 live, 138 carried); unresolved 54/198 = 27%, no waiver |
| Gate | ARTIFACTS VALID — GATE PASSED at the pin, before and after the scribe |
| Projection | TAXONOMY 52 → 55 terms; DISPOSITIONS gains two accepts and four later ratifications; PREDICATES regenerates unchanged; `validate_packet.py`, `--s5` and `--s6` green |

Accepted: OperationalChangeEvent, WorkUnitExecution and CommittedFailure (new classes); VerificationAttempt,
SeatRequest, SeatGrant, admissionChargeTokens and VerificationLane (reuses affirmed under their ratified
values, Ruling 28). Withdrawn: CacheEpoch, Checkout, VerificationEvidence (null discriminators true of a
plain data record), TreeState and MergedPreviewWork (the same, landed at sitting 1), AdmissionWorkKind
(round-3 FAIL on support-not-necessary). Not proposed: `landedAt`, the eleven lane-plan terms, the proof
and merged-preview stages, peak memory use.

## Tracked follow-ups

### Records of this run (wording, not verdicts)

These were found after each review loop closed (call (af), Ruling 11); none changes a ratified term.

- ic-chg-change-landing-001: 'A shared instant is never sufficient' is illustrated by a pair whose instants differ. Fix: Say 'instant proximity' instead of 'a shared instant'.
- ic-chg-change-landing-001: The KPI section 2 post-period membership rule is restated as 'taking effect per checkout' for every landing. The card never asks whether HEAD-ancestry adoption governs the hosted-capacity rows dated by an apply outside the repository. Fix: Attribute 'two instants' to the membership rule, and name the apply-dated rows as a case the rule may not cover.
- fa-chg-change-landing-001: spec_vs_execution 'separated' leans on field layout, while the card says the records do not split artifact from landing. Fix: Rest the separation on the general rerun rule only, or cite a record.
- ic-chg-change-landing-001: The change-artifact rival is typed information_object, but the hypothesis leaves its representation_status unresolved. Fix: Note that the type is the card's reading, not the hypothesis's grade.
- ic-vfy-checkout-001: The criterion's 'the branch checked out in it is a changing state' presupposes an in-place branch change while may_change_state_without_losing_identity is unresolved, and the FA rival label calls the tree reading 'the card's reading' though the card's category is unresolved. Fix: Word the criterion as 'the branch is never part of its identity', without asserting it changes, and relabel the FA rival.
- ic-vfy-seat-grant-001: may_change_state_without_losing_identity: true is asserted, but the temporality rationale names no state change a record shows; every heartbeat member is a single value. The dependence rationale also leans on owner members, which are capture surrogates. Fix: Argue which state changes and from which record, or set the field to unresolved; argue dependence from checkoutRoot alone.
- ic-vfy-admission-work-kind-001 / ic-vfy-merged-preview-work-kind-001: dependence: none rests on an absence ('no cited record shows a policy or other individual'), although the code-list rival, an information object, would differ in dependence from the subkind rival. Fix: Set dependence to unresolved by reading, or argue 'none' for both rivals.
- fa-vfy-admission-charge-001: spec_vs_execution says no cited record carries a weight rule but does not mention that its own cited CQ-021 note names admissionTokenWeight with the per-kind table. That note could be quoted as a CQ-file presupposition, not as evidence. Fix: Quote the CQ-021 note as the CQ suite's presupposition beside the conditional.
- ic-vfy-proof-stage-001: The phrase 'relative to that run the stage changed once' (:55-56) states a count over a selected sample. The cited records show at least one change, not a number of changes. Fix: Say 'the stage differs between two of its cited facts' instead of 'changed once'.
- ic-vfy-cache-epoch-001: The phrase 'shared by the lanes of each cited attempt' (:6, :92, fa:7) states a universal that only two cited attempts instantiate. The other cited attempts show one lane each. Fix: Say 'shared by the lanes of each of the two cited attempts that show two lanes'.
- ic-vfy-verification-lane-001: The card says 'Seven clone ledgers carry laneId fallow:audit', but the cited facts show the same command digest in eight. so-d6adeec15c79 (beep-effect) is an eighth. Fix: Drop the count, or name the cited ledgers.
- fa-vfy-verification-attempt-001: The process rival is justified by saying 'CQ-022 counts attempts and executions in flight', but CQ-022 asks only for running WorkUnit executions in an attempt, not for in-flight attempts. Fix: Restate the process rival's warrant as executions running inside an attempt, not attempts counted in flight.
- ic-vfy-verification-attempt-001: Dependence is marked relational on the 'checkout and tree state it runs against', but the rationale cites no record of the tree tie. The anchor start row so-6390d5f857ae carries only head=HEAD; the supporting resolvedHeadSha is on so-eefbf95beb8d, so-10c2570fe2f6 and so-3bf9cacb55b4, which the rationale does not cite. Fix: Cite the resolvedHeadSha start rows as the record of the tree tie, and the run-file location as the record of the checkout tie.
- ic-vfy-lane-execution-001: This is a cross-pair divergence after the row-9 repair. The lane-execution card makes every lane execution, including ledger lane records, depend on 'the verification attempt it runs in'. The repaired attempt card now says ledger attemptIds are not shown to name journal attempts. Fix: Say that for ledger lane records the attempt is shown only as an attemptId stamp.
- ic-vfy-verification-evidence-record-001: The criterion does not restrict itself to kind=fact. A shadow written at the same instant for the same lane execution would meet 'same issuing write and same lane execution'. Fix: Say 'two proof facts (kind=fact) are the same iff ...'.
- ic-vfy-committed-failure-001: may_change_state_without_losing_identity is false, and the temporality rationale (:74-78) does not argue it. Fix: Add one sentence tying false to the event category, or set it unresolved alongside the instant-or-interval question.
- ic-vfy-lane-execution-001: The unity sentence is garbled: 'its execution would be a part of the parent's execution, not of this one'. Fix: Reword it as: 'a child entry's execution would be part of its parent's execution if the parent link records containment'.
- ic/fa-chg-change-landing-001: after the category rewrite the two information_object rivals stay still_viable, but by the card's own account neither named discriminator would favour them (ic:38-39, fa:14/16/76-77, fa:78 'names the evidence that would overturn it'); synthesis or a later run should name a record that would favour the ledger-row or artifact reading, or say none is known.
- ic-vfy-seat-request-001:89 'Relator or phase of a relator' not updated now that the relator's second relatum is unshown.
- ic-vfy-admission-charge-001:85-86 reads 'withdrawn ungranted' from a chain record with no admitted row (an inference).
- ic-vfy-proof-stage-001:46-47 asserts without argument that a subkind of attempt depends on nothing beyond its instances.
- Lane execution: the card and analysis still say "ended by a verdict" while the accepted definition counts an
  execution from its start; add the attempt id and recording instant to the fact-and-shadow agreement sentence;
  say whether whole-attempt executions (CQ-025 notes) are inside the class's grain.
- Hypothesis text that lags its repaired cards: `dh:vfy-lane-execution:001` (says no journal and ledger pair
  joins), `dh:vfy-verification-attempt:001` (individuates by attempt id), and sibling alternatives that still
  call withdrawn referents domain referents (`dh:vfy-merged-preview-stage:001`, `dh:vfy-merged-preview-tier:001`,
  `dh:vfy-working-state:001`).
- The change-landing proposal's "later P0 Ruling 3" wording; the closure-grounded reason is that a row records
  a merge commit. The admission-charge and seat-grant proposals name withdrawn proposals in prose (superseded by
  Rulings 27 and 18).

### Next run (named evidence and decisions)

- `landedAt`: a source record of one change's merge time and apply time beside its landedAt, and of when the
  ledger row was written. Until then CQ-016 is answered for its subject only.
- CQ-022 returns no row on run-4 vocabulary: `inAttempt`, `hasExecutionState` and RunningExecution are parked
  and `hasCancelClass` is seed-only.
- The six withdrawn terms return only with the evidence their receipts name (`work/sittings/withdrawals-*.yaml`).
- Lane-plan terms: a lane-order Must/Should CQ. AssuranceTier fourth member: the parked AssuranceTierId domain
  decides first (Ruling 32).

### Engine, briefs and tooling

- The S5 gate checks DISPOSITIONS `later_ratifications` but not the new additive TAXONOMY `later_ratifications`
  list; bind it in `validate_packet.py --s5`.
- The run-3 projection left rat-067's and rat-068's deferrals out of the SeatRequest and SeatGrant TAXONOMY
  flags (they sit in DISPOSITIONS only).
- Seat briefs: name withdrawal receipts by pass, not by round (call (ai)); word the foundational Stop as "never
  rewrite a pair no row names" (call (af)); warn that a bare word starting with `=` expands in zsh; give seats
  an approved one-liner that prints a record's facts or quotes.
- Orchestrator tooling: rebuild every input manifest from the live directories at launch; list every support
  target and parent in an adversary manifest; state the operands of any arithmetic in a repair row; launch
  repair rows from the file rather than by hand.
- The adapter keeps non-config lines (a launched command) only in `source_excerpt`; emit them under a fact
  predicate so rows, reviewers and seats cite the same surface.
- Friction receipts for all of the above are in `research/OPPORTUNITIES.md` (2026-10-06 entries).
