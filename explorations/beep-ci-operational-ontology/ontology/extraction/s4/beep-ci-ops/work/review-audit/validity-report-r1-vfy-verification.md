# Review-validity audit: vfy verification cluster (auditor run 4, beep-ci-ops)

Scope: the round-1 adversary reviews of five proposals under prefix `vfy`:
`committed-failure`, `lane-execution`, `tree-state`, `verification-attempt`, `verification-lane`.
Each proposal has exactly one review file (`otp-vfy-<slug>-001.review.yaml`), so each review is
the latest review of its target. All five verdicts are PASS, and no attack row in any review is
`landed`. Part (1) of the audit, judging landed attacks, therefore has nothing to judge. The audit
is part (2), judging each PASS, plus part (3), calibration.

Paths are relative to `explorations/beep-ci-operational-ontology/`. Shorthand used below:
`P/` = `ontology/extraction/s4/beep-ci-ops/work/proposals/`, `H/` = `.../work/hypotheses/`,
`F/` = `.../work/foundational/`, `O/` = `.../work/observations/`, `PO/` = `.../work/prose-observations/`,
`CQ` = `ontology/docs/competency-questions.yaml` (sha256 12-hex `e1ed9c0f65f5`, the value the
adversary brief pins at its line 48), `AB` = `research/run4-lanes/p3-seat-adversary-brief.md`,
`CB` = `research/run4-lanes/p3-seat-common-brief.md`, `TAX` = `ontology/extraction/s5/TAXONOMY.yaml`,
`PRED` = `ontology/extraction/s6/PREDICATES.yaml`. An observation is cited by its 12-hex stem.

## Standard applied

- AB:99-100. PASS means every attack on every surface survived. A FAIL needs a landed attack
  whose counterexample shows the term wrong as proposed: its category, parent, identity
  criterion or warrant, or a null that was never rejected. A claim the proposal makes without
  evidence is a FAIL, not an abstention.
- Prompt `ontoclean-adversary.md:33-38`. A null discriminator is tested by building the pure-DTO
  twin that makes the discriminating fact true anyway. I count a twin as built from the closure
  when the closure itself holds an implementation field with exactly the pattern the
  discriminator relies on. If the reviewer's twin is one that the cited records refute by
  construction, the attack was not tested.
- Exact reuse of a ratified term (verification-attempt, verification-lane): tested on the null
  and identity surfaces as hard as a new term. Neither row in TAX carries a `flags` field
  (TAX:401-407, TAX:419-425), so the semantic-match-only relaxation of AB:180-182 does not apply
  to either proposal.
- Closure per review: the target's own chain. That is the proposal, its IC/FA pair, its DH, and
  every SO/PO the DH cites, plus the CQ file. A fact that sits only in a sibling chain of the same
  batch is out of chain for that review (AB:126-127). I report such facts under calibration and
  never use them as grounds for an unsound PASS.
- Warrant judged on each CQ's executable `sparql` (AB:48-49). The QUERY-binding test of AB:143-144
  ("whether the QUERY, not only `required_classes`, binds the class") is written inside attack 1,
  the tier-member attack. I do not extend it to other terms by my own ruling. Where it would
  decide a PASS, I raise it as a sitting question.

## Summary

| Target | Review verdict | Landed attacks | PASS judgement | Missed attack (surface: rule) | Basis |
| --- | --- | --- | --- | --- | --- |
| otp:vfy-committed-failure:001 | PASS | none | sound | none in chain | so-ca8b3f90e57c |
| otp:vfy-lane-execution:001 | PASS | none | **unsound** | identity: unity-contradicted-by-closure (part/whole executions counted as peers) | so-5d4b45aa3226, so-2601c6b77d87 |
| otp:vfy-tree-state:001 | PASS | none | **unsound** | null_discriminator: discriminator-true-of-dto | so-40abdcaf1156, so-c997b4851faa, so-eefbf95beb8d, so-10c2570fe2f6 |
| otp:vfy-verification-attempt:001 | PASS | none | **unsound** | null_discriminator: discriminator-true-of-dto | so-ca8b3f90e57c, so-6390d5f857ae |
| otp:vfy-verification-lane:001 | PASS | none | sound (sitting question on reuse grain) | none demonstrated | 7 fallow:audit ledger facts |

Three of the five PASS verdicts are unsound, and all three on attacks the reviewer did try. In
each case the counterexample was built against a twin or a record reading that the closure itself
contradicts. All five reviews list at least one rival in `rival_models_still_viable`, so every
target flags DISPUTED at the gate. One of those listed rivals is already decided inside its own
chain (lane-execution, below).

---

## otp:vfy-committed-failure:001 (`P/otp-vfy-committed-failure-001.review.yaml`)

Chain: one observation, so-ca8b3f90e57c (`H/dh-vfy-committed-failure-001.yaml:2-3`), plus CQ-022.

**Judgement: PASS sound.**

- Taxonomy (review:22-30). `parents: []` and `gufo:Event` are tested against the failed-phase
  rival. In so-ca8b3f90e57c the steps after `prepare:05-docgen` are `status=not-run`. That is a
  state that follows the exit, so the phase rival is a different referent. The row survives on
  the record.
- Identity (review:31-38). The card makes `failedStepId` evidence (`F/ic-vfy-committed-failure-001.yaml:8-17`),
  so identifier-is-identity does not land. The two-lanes-failing case is a hypothetical, and that
  is lawful for a survived row.
- Warrant (review:39-45). CQ:591 types `?failure rdf:type ciops:CommittedFailure`, so the query
  binds the class. Sound.
- Null (review:46-53). The DTO twin "failedStepId is a summary derived from the steps array" makes
  the `failedStepId` part of the DH discriminator true (`H/dh-vfy-committed-failure-001.yaml:24-26`).
  It does not reach the step record itself: `prepare:05-docgen status=failed exitCode=1
  durationMs=47356.549767`, then four `not-run` entries under `failurePolicy=fail-fast`
  (so-ca8b3f90e57c source_excerpt, O/so-ca8b3f90e57c.yaml:94). The referent is defined as that
  exit (proposal:11-14), and the exit is a recorded process outcome. The reviewer's twin is the
  right one and is refuted on the record. Survived.
- No landed attack is missed inside this chain. The weaknesses I found sit at the calibration
  level (C3, C4, C6).

## otp:vfy-lane-execution:001 (`P/otp-vfy-lane-execution-001.review.yaml`)

Chain: 34 SOs (`H/dh-vfy-lane-execution-001.yaml:2-36`), including so-5d4b45aa3226 (line 4) and
so-2601c6b77d87 (line 8), plus CQ-022/024/025.

**Judgement: PASS unsound. Missed attack lands on identity (unity). Demonstrated.**

What the review did: its identity row (review:28-36) cites so-5d4b45aa3226 and reads only
`parentLaneId=full:01-pre-push`. It then concludes: "The card leaves parthood open and names the
double-counting risk for CQ-025... Survived." The same record decides parthood.

Counterexample, from records in the chain:

- so-5d4b45aa3226 (O/so-5d4b45aa3226.yaml:34, source_excerpt) is one attempt-finished verdict,
  attempt `097f46f5-…`, `startedAt=2026-10-01T14:36:45.850Z`, `endedAt=…15:40:20.295Z`,
  `elapsedMs=3814445`. It carries the lane entry `full:01-pre-push status=failed exitCode=1
  durationMs=3137528.733036`. It also carries 32 child entries with `parentLaneId=full:01-pre-push`,
  each with its own `startedAt`/`endedAt`, running sequentially from `fallow:audit` (14:48:06.534Z)
  to `quality:coverage` (ended 15:40:19.556Z). The child envelope is 3,133,022 ms and the child
  durations sum to 2,997,685.8 ms.
- If parent and children were disjoint, they would need at least 3,137,529 + 2,997,686 =
  6,135,215 ms inside an attempt whose own elapsedMs is 3,814,445. So the parent's span overlaps
  the children's by at least 2,320,770 ms. The parent's duration exceeds the child envelope by
  only 4.5 s. The parent execution contains the children.
- The proposal and card say the opposite:
  - IC unity: "the member names a parent and does not say whether the child runs inside the
    parent" (`F/ic-vfy-lane-execution-001.yaml:21-25`).
  - IC counterexample: "neither CQ-025 nor a cited record says whether it does"
    (`F/ic-vfy-lane-execution-001.yaml:53-59`).
  - Proposal open_issues names the needed evidence as "a verdict carrying a parent lane entry and
    its child entries with durations" (proposal:73-75). That record is so-5d4b45aa3226, already
    in the chain.
  - DH says durationMs is "not a bounded interval with known start and end. Needed evidence...: a
    lane record with start and finish instants" (`H/dh-vfy-lane-execution-001.yaml:50-51, 73-75`).
    so-5d4b45aa3226 carries those instants, and `quality:coverage` 15:30:00.847Z to 15:40:19.556Z
    is 618,709 ms against `durationMs=618708.236225`.
- Why this is a defect of the term as proposed: the definition makes every lane entry a peer
  WorkUnitExecution, individuated per invocation and "carrying a per-lane wall duration" that is
  the CQ-025 `actualWallMs` carrier (proposal:11-15, 57-60; CQ:670). It gives the class no part
  relation. As proposed, `full:01-pre-push` and its 32 children are 33 WorkUnitExecutions of one
  attempt, and the wrapper's 3,137,529 ms re-counts about 3.0 M ms of child time. The closure
  shows the double count the proposal treats as conditional. The unity clause is a claim against
  the proposal's own evidence, and under AB:100 that is a FAIL.

Second defect, same records, rival surface: the proposal (open_issues:67-69), the DH
(`H/…:51-53`), the FA (`F/fa-vfy-lane-execution-001.yaml:26-28, 66-69`) and the review's rival list
(review:59-61) all keep the two-referent rival viable because "no cited pair joins a verdict lane
entry to a ledger record of one attempt". The chain holds that pair:

| Field | so-5d4b45aa3226 (journal lane `quality:coverage`) | so-2601c6b77d87 (ledger fact, `laneId=quality:coverage`) |
| --- | --- | --- |
| attempt | `097f46f5-…` | `097f46f5-…` |
| verdict | `status=failed`, `exitCode=1` | `outcome=failed` |
| durationMs | 618708.236225 | 618708.236225 |
| inputDigest prefix | 910cb539f2 | 910cb539f2 |
| head prefix | 5214ecbed9 | 5214ecbed9 |
| recordedAt | 15:40:20.295Z | 15:40:20.276Z |

This settles the rival in favour of the card's own reading: one execution with two record
classes, written by two writers. On its own this under-claim does not make the term wrong. It
does make the review's rival list wrong, and the gate's DISPUTED flag for this target rests on a
misread record.

Other rows: taxonomy (review:22-27) and warrant (review:37-42) are sound. All three CQs type
`?exec rdf:type ciops:WorkUnitExecution` (CQ:592, CQ:638, CQ:661). Both null rows (review:43-57)
survive on the journal `exitCode` and are sound. The DH's "agreed by two records of different
kind" conjunct is DTO-true for the fact/shadow pair: one writer, one `key`, identical `recordedAt`
(so-2601c6b77d87 and so-b1c417f14329). The reviewer did not rest on that conjunct.

Revision the next synthesis pass would need: a part-of relation between executions, or a
statement of which entries are WorkUnitExecutions. Withdraw the two-referent rival, citing
so-5d4b45aa3226 and so-2601c6b77d87.

## otp:vfy-tree-state:001 (`P/otp-vfy-tree-state-001.review.yaml`)

Chain: 19 SOs (`H/dh-vfy-tree-state-001.yaml:2-21`) plus CQ-005/006/014.

**Judgement: PASS unsound. Missed attack lands on null_discriminator (discriminator-true-of-dto).
Demonstrated.**

- The DH discriminator: so-40abdcaf1156 and so-c997b4851faa "carry one identical headSha: a single
  tree receives opposite verdicts from two lanes, which is false of a value private to one record"
  (`H/dh-vfy-tree-state-001.yaml:61-63`). The null it refutes is "a value private to one record".
  The stated null is "implementation artifact only" (line 56).
- The review (review:47-55) concedes the first fact is "true of that twin" (a per-attempt stamp).
  It rescues the null with "one resolvedHeadSha on a repair-loop attempt and a later closeout
  attempt of one run (so-eefbf95beb8d, so-10c2570fe2f6), which a per-attempt stamp would not give".
- The closure contains the wider twin that makes both facts true:
  - so-40abdcaf1156 and so-c997b4851faa also share `attemptId=6eb51e93-…` and
    `recordedAt=2026-09-24T22:06:28.678Z`. Each is a writer stamp with no tree behind it.
  - so-eefbf95beb8d and so-10c2570fe2f6 share `resolvedHeadSha` exactly as they share
    `runId=chore_deps-update-09-05-26-64c41f08b79f`, `branch` and `base`
    (O/so-eefbf95beb8d.yaml:90, O/so-10c2570fe2f6.yaml:90). The run-file key is a pure grouping
    stamp, and it shows the same cross-attempt pattern.
  - No other cited sha is shared outside one attempt or one run. The three facts sharing
    `headSha` b514a1410e (so-12d5a26fbfac, so-d6adeec15c79, so-fcbe894799ea) are all attempt
    `756a80e6-…`.
- So every discriminating fact the hypothesis and the review rely on is also true of a field the
  closure shows to be implementation grouping. The null was never rejected on cited evidence. The
  card itself says "No cited record carries tree content, only commit shas and diff fingerprints"
  (`F/ic-vfy-tree-state-001.yaml:13-14`).

Out-of-chain note (not a ground): so-bbe03a405b80, in the lane-execution chain, carries the same
`runId` as so-eefbf95beb8d with a different `resolvedHeadSha` (aa83e8be…). That record would refute
the run-stamp twin. The repair is for the hypothesis to cite it (AB:126-127), not to keep the PASS.

Secondary finding, PLAUSIBLE, which the reviewer saw and downgraded. The definition says the
referent is "named on proof facts by headSha" (proposal:11-12), but the card keeps the working-state
grain viable (`F/fa-vfy-tree-state-001.yaml:18-19`). On that grain a fact's headSha names the base
commit, not the state verified. The review's own revision request says so (review:18-22). That is
a claim beyond the card made without evidence, so under AB:100 it should have landed rather than
gone into a non-blocking request.

Warrant row (review:39-45): see sitting question Q1. None of CQ:134-139, CQ:154-163 or CQ:370-375
contains `rdf:type ciops:TreeState`. Each binds `?tree` as a harness-bound IRI or join node, and
TreeState appears only in `required_classes` (CQ:141, 165, 377). The proposal concedes this
(proposal:47-50). Removing the class leaves every result identical. "The queries need tree
individuals" (review:44) argues for nodes, not for the class.

## otp:vfy-verification-attempt:001 (`P/otp-vfy-verification-attempt-001.review.yaml`)

Chain: 88 SOs plus po-fd56d2b008d1 (`H/dh-vfy-verification-attempt-001.yaml:2-91`) plus CQ-022.
This is an exact reuse of the ratified VerificationAttempt (TAX:401-407: rigid, rat-033, no
`flags` field).

**Judgement: PASS unsound. Missed attack lands on null_discriminator (discriminator-true-of-dto).
Demonstrated.**

- The DH discriminator: "the verdict's elapsed time is exactly the interval from the start row to
  the verdict's end, which would be false if the attempt were only a bookkeeping label"
  (`H/dh-vfy-verification-attempt-001.yaml:139-143`). The FA rejects the grouping-label rival on
  the same fact (`F/fa-vfy-verification-attempt-001.yaml:60-61`).
- The verdict record carries its own `startedAt`. In so-ca8b3f90e57c the attempt-finished excerpt
  reads `startedAt=2026-08-23T16:59:45.919Z`, `endedAt=2026-08-23T17:01:07.524Z`,
  `elapsedMs=81605` (O/so-ca8b3f90e57c.yaml:94). `elapsedMs` is that record's own
  `endedAt − startedAt`, and the start row so-6390d5f857ae carries the same stamp. The "exact
  span" holds by construction of the record format and would hold for a writer that frames any
  grouping key with a header and a footer. That is the DH's own `implementation_artifact_only`
  alternative (`H/…:123-127`).
- The other conjunct ("failedStepId... beside lane... at status=passed") is a fact about lane
  runs. It is equally true under "lane runs with the attempt as a grouping label".
- The review's twin, "A label has no start row or verdict of its own" (review:49-51), is a twin
  that the record format refutes by stipulation. The prompt's test (`:33-38`) requires the twin
  that makes the fact true anyway.
- The closure probably holds a fact that does discriminate. so-f8f678d23c44 is an attempt ended by
  `attempt-terminated reason=legacy-unowned-start` with no lane entries, and the KPI law counts
  "a terminated attempt... as red" (po-fd56d2b008d1). That is an attempt-level outcome with no
  lane runs to label. A second candidate is the four `not-run` steps after a fail-fast exit (an
  attempt-level stop). The remedy is to restate the discriminator, not to withdraw the term. Under
  AB:99-100 the PASS on the stated discriminator is still unsound.

Other rows:
- Taxonomy (review:22-30), reuse semantic match: sound. The reuse compatibility rests on CQ:600,
  which names the carrier as "attemptId UUID on yeet-attempt-journal/v1 events", and so-6390d5f857ae
  is a `yeet-attempt-journal/v1` start row.
- Identity (review:31-38): sound on the chain. No cited attemptId crosses record classes in this
  chain. I checked all 89 cited records: no journal attemptId equals a ledger or admission one. So
  the IC claim at `F/ic-…:11-18` holds inside the chain. The batch is different; see C2.
- Warrant (review:39-45): `?attempt` is an untyped join node (CQ:591-593), and the class appears
  only in `required_classes` (CQ:598). This is the same pattern as tree-state (Q1). I do not
  ground the judgement on it.
- The review's revision request about the claimed flag (review:18-20) is correct as a lookup
  fact. TAX:401-407 has no `flags` field, so "flag VerificationAttempt persists; no lift claimed"
  (proposal:54) names a flag the lookup does not show.

## otp:vfy-verification-lane:001 (`P/otp-vfy-verification-lane-001.review.yaml`)

Chain: 31 SOs (`H/dh-vfy-verification-lane-001.yaml:2-33`) plus CQ-001/006. This is an exact reuse
of the ratified VerificationLane (TAX:419-425: rigid, rat-039, identity_ref
`ic:pa-turbo-task-specification:001`, no `flags` field).

**Judgement: PASS sound, with one PLAUSIBLE issue for the sitting (Q3).**

- Identity (review:34-41): verified. The cited commandDigests per laneId are `fallow:audit`
  c2a85a468f in all eight `fallow:audit` facts, `fallow:health` d5b8aa5291, `quality:docgen`
  2c26bd4796, `quality:lint-policy` 7299b9a2b1, `quality:coverage` 2f09449d7f and
  `quality:jsdoc-ratchet` d7fa11a473. They are pairwise distinct, so name lineage and command
  content never come apart, and the card leaves the criterion unresolved. Sound.
- Null (review:48-54): the review's twin ("a per-run label") is weak. The strongest twin is a
  per-lane config constant, and it reproduces the recurrence. Unlike tree-state and
  verification-attempt, though, the chain shows no separate implementation field that co-varies
  with `commandDigest` per lane. `laneClass` and the schema version are constant across all
  lanes. The DH also lists "the lane's command definition as a document" as a viable referent
  reading (`H/…:48-50`), so the per-lane-constant twin merges with a rival reading of the
  referent rather than with the null. I judge the recurrence of one command digest under one name
  across seven clone ledgers with different heads and inputs to be the spec/execution test that
  `foundational-analysis.md` names ("if it can be rerun, split specification from execution").
  Survived.
- Warrant (review:43-47): CQ:45 types `?lane rdf:type ciops:VerificationLane`, which warrants the
  class. For CQ-006, `?lane` is untyped and VerificationLane is absent from `required_classes`
  (CQ:154-165). The review says so in its revision request (review:13-17). CQ-001 carries the
  warrant on its own. Sound.
- Taxonomy, reuse semantic match (review:22-26): the survived row describes the ratified term as
  "the repeatable procedure the ratified row names". The lookup row names no procedure: it gives
  `kind`, `rigidity`, `identity_ref` and `ratification`. The same lookup places `FallowAuditLane`,
  the lane all seven discriminator facts are about, as an individual `instance_of:
  WorkUnitSpecification` with `placement_pending_ratification: true` (TAX:378-385). Lookups are
  never evidence (AB:50), and that placement is pending, so I do not count it as a landed missed
  attack. It is a real grain question; see Q3.

---

## Calibration

- C1. Twin quality is the common failure. In all three unsound PASS verdicts the reviewer did
  attempt the attack, but built the twin or read the record narrowly enough that the closure
  refuted it by construction: a label with no start row, a per-attempt stamp, and parthood read
  from `parentLaneId` alone. A workable check for later rounds is to search the closure for an
  implementation field (attemptId, runId, recordedAt, a record's own startedAt) with the same
  pattern as the discriminating value before scoring a null row as survived.
- C2. Cross-chain refuters held by the batch. The adversary reviews a batch, so it holds every
  chain at once. so-5d4b45aa3226 (lane-execution chain) also bears on:
  - committed-failure: its `failedStepId=full:01-pre-push` names the wrapper, while the child
    `quality:coverage` is a separate failed exit (exitCode 1) inside it. That gives two candidate
    "committing" step exits for one attempt, against the (attempt, step) criterion.
  - verification-attempt: its journal attemptId `097f46f5-…` equals the ledger attemptId on
    so-2601c6b77d87. That is exactly the "reach beyond the journal" evidence the VA proposal says
    is missing (proposal:69-71; `F/fa-vfy-verification-attempt-001.yaml:39-41`).

  so-bbe03a405b80 bears on tree-state (same `runId`, different `resolvedHeadSha`). AB:126-127
  lets the adversary name such stems and ask for citation. None of the five reviews did. A sitting
  could make that a duty for a batch adversary.
- C3. Analyzed verdict with an identity-differing rival still viable. Three FAs record
  `verdict: analyzed` while keeping a rival viable that differs in identity, not only in
  category:
  - committed-failure: the obsoletion point vs the step exit (`F/fa-vfy-committed-failure-001.yaml:19-22`).
  - verification-attempt: alias of the seat request (`F/fa-vfy-verification-attempt-001.yaml:18-20`).
  - lane-execution: two referents, now decided (see above).

  Each proposal routes the rival to a steward-choice open issue, citing AB:182-183. That rule
  speaks of a *category* rival. An identity rival is a disagreement about the criterion the card
  asserts, and that is the surface the PASS certifies.
- C4. Unresolved rigidity on identity-supplying event classes. Committed-failure, lane-execution
  and verification-attempt all carry `rigidity: unresolved` with `identity: supplies`.
  `ontoclean-rules.yaml:19` blocks this at the step-8 gate, not at the adversary round. The
  committed-failure card's rigidity rationale (`F/ic-…:61-67`) describes how the classification
  could be lost while the individual persists, which is an anti-rigidity signal, so OntoClean
  would deny identity supply. Expect all three to stop at step 8 unless rigidity is settled.
- C5. Exact reuse claiming a flag the lookup does not show. verification-attempt says "flag
  VerificationAttempt persists" while TAX:401-407 has no flag. The semantic-match-only
  relaxation (AB:180-182) is triggered by the proposal's sentence, but it presupposes a flagged
  ratified term. I applied the full standard because the lookup shows no flag.
- C6. Committed-failure vs WorkUnitExecution grain. The committed-failure card leaves temporality
  open between the exit instant and "the failing step's interval" (`F/ic-…:74-78`). On the
  interval reading, the individual (attempt d1e2faf7-…, `prepare:05-docgen`) is the same
  occurrence that otp:vfy-lane-execution:001 counts as a WorkUnitExecution. CommittedFailure
  would then be an anti-rigid, relationally fixed classification of an execution (it holds only
  under fail-fast, as the first failure), not an identity-supplying event class. This does not
  land in-chain because the card keeps the instant reading open, but the two proposals need a
  joint reading.
- C7. Seed-only and parked predicates on the warrant path. `inAttempt` is `parked-run-2`
  (PRED:464-465). `provesTree`, `hasCurrentEpoch`, `requiresLane`, `dischargesObligation` and
  `hasLaneKind` are `seed-only` (PRED:572-573, 317-318, 639-640, 165-166, 356-357). Each warrant
  above stands on a CQ query whose join predicates are not ratified. None of the reviews claims
  otherwise, but a decision term warranted only through unratified edges is a pattern a sitting
  may want to price.

## Sitting questions

- Q1. Does a Must/Should CQ warrant a decision CLASS when its query binds the referent only as an
  untyped, harness-bound or join node, and the class appears only in `required_classes`?
  Affected: tree-state (CQ-005, CQ-006, CQ-014, where no query types `?tree`) and
  verification-attempt (CQ-022, untyped `?attempt`). VerificationLane's CQ-006 citation is the
  same, but CQ-001 types the class. AB:143-144 states the QUERY-binding test only for the tier
  member. If the sitting extends it, the tree-state warrant fails outright, and the
  verification-attempt warrant rests on its ratified status (rat-033) and CQ:600 prose, not on
  the query.
- Q2. May a proposal keep `foundational_status: analyzed` while its FA keeps a rival that differs
  in identity (committed-failure: obsoletion point; verification-attempt: request alias)? Or does
  an identity rival force `explicitly_deferred`, which AB:182-183 only routes to an open issue for
  category rivals?
- Q3. Exact reuse of VerificationLane at the grain of ledger `laneId` (`fallow:audit`): the lookup
  places `FallowAuditLane` as `instance_of: WorkUnitSpecification` (pending, TAX:378-385), the
  ratified VerificationLane's card is a turbo-task-specification card (TAX:423), and CQ-002
  separates WorkUnit from the lane it `executesLane` (CQ:65-72). Should an exact-reuse
  compatibility claim be allowed to rest on the ratified label alone, with no closure record of
  the ratified grain? If not, which evidence class settles lane versus work-unit grain?
- Q4. Should the batch adversary be required to name out-of-chain refuters it holds (C2), so that
  a PASS cannot stand on a chain whose sibling chain refutes it?
- Q5. A wrapper lane whose execution contains child lane executions (so-5d4b45aa3226): is the
  wrapper a WorkUnitExecution, a composite of executions, or neither? The answer decides the
  CQ-025 calibration population and which exit is the committed failure for CQ-022. The KPI law
  already "keeps wrapper and inner lanes as separate populations" (po-fd56d2b008d1, outside the
  lane-execution chain).
