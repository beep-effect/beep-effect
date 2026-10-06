# Review-validity audit: prefix `chg` (auditor run 4, beep-ci-ops)

Auditor: independent review-validity auditor. This report rules nothing; the sitting rules on it.
Paths are repo-relative to the run lane. Abbreviations: `ONT` = `explorations/beep-ci-operational-ontology/ontology/extraction/s4/beep-ci-ops`,
`P` = `ONT/work/proposals`, `CQF` = `explorations/beep-ci-operational-ontology/ontology/docs/competency-questions.yaml`.

Closure read: the proposal `P/otp-chg-change-landing-001.yaml`, its two reviews, `ONT/work/hypotheses/dh-chg-change-landing-001.yaml`,
`ONT/work/foundational/{ic,fa}-chg-change-landing-001.yaml`, all 45 prose observations the hypothesis cites (44 control-interventions ledger
rows and the KPI law section 2 block `po-d63c0a7e9e45`), CQ-016 in `CQF`, the status lookups `s5/TAXONOMY.yaml` and `s6/PREDICATES.yaml`.
Not opened: `work/alternative/**`, archives, governance, sittings, review-audit, decision logs, the docket, other briefs, and the five sibling
`dh-chg-*` hypotheses that the proposal names in prose. No source observations (so-) are cited by this chain.

Standard applied: the adversary brief as written (`explorations/beep-ci-operational-ontology/research/run4-lanes/p3-seat-adversary-brief.md`),
including "A claim the proposal makes without evidence is a FAIL" (brief :260) and "A category rival on one hypothesis belongs in a
steward-choice open issue ... attack a still_viable rival the proposal leaves unnamed" (brief :342-343). The term is NEW (no
`OperationalChangeEvent` term in `s5/TAXONOMY.yaml`; `reuse.exact_reuse_found: false`, `P/otp-chg-change-landing-001.yaml:33-36`), so the
full new-term standard applies on all four surfaces; no exact-reuse relaxation was relevant.

Mechanical checks made by this audit (read-only):
- Current proposal bytes sha256 = `8164d4c90e0a...`, equal to the r2 review's `target_sha256` (`P/otp-chg-change-landing-001-r2.review.yaml:2`).
- Recomputed the framed chain digest (OTP + IC + FA + DH + 45 cited POs, sorted by basename, `name\nlen\n` + bytes, trailing `cq:e1ed9c0f65f5\n`):
  `0d550036a663...`, equal to r2's `chain_sha256` (`...-r2.review.yaml:3`).
- `CQF` sha256 12-hex = `e1ed9c0f65f5`, as r2 states (`...-r2.review.yaml:41`).
- Revision protocol: r1 FAILed `c771b3345865...` landing one rule; the revised proposal's `revision_log` names that digest and addresses
  `record-property-as-differentia` (`P/otp-chg-change-landing-001.yaml:29-32`); bytes changed. The post-FAIL PASS is mechanically lawful.
- Every `evidence` id in both reviews is inside the hypothesis's `observation_refs` (`dh-chg-change-landing-001.yaml:2-47`).
- The r1 bytes (`c771b...`) are not in the closure (the proposal file is untracked and was revised in place). The r1 definition wording is
  known only from the r1 review's quotation (`otp-chg-change-landing-001.review.yaml:19`), corroborated by the proposal's own revision note
  (`P/otp-chg-change-landing-001.yaml:60`).

## Summary

| Review | Verdict | Landed attacks | Audit judgement |
| --- | --- | --- | --- |
| `P/otp-chg-change-landing-001.review.yaml` (r1) | FAIL | taxonomy: `record-property-as-differentia` | Landed attack DEMONSTRATED (one supporting premise overstated, see below) |
| `P/otp-chg-change-landing-001-r2.review.yaml` (r2, latest) | PASS | none | PASS SOUND under the brief as written; four calibration points for the sitting |

## r1: `P/otp-chg-change-landing-001.review.yaml`

### Landed: `record-property-as-differentia` (taxonomy), lines 17-20. Judgement: demonstrated

- Claim attacked: the r1 definition made membership include "is recorded with one wall-clock landing instant at which KPI series are
  partitioned" (quoted at `:19`). The proposal concedes the wording in its revision note: "the definition no longer makes being recorded with
  an instant, or being a KPI partition point, part of membership" (`P/otp-chg-change-landing-001.yaml:60`). So the attack targets a claim
  the proposal did make.
- Counterexample built from the closure: the KPI law makes the partition point a property of the recorded `landedAt` field consumed by the
  ETL (`po-d63c0a7e9e45`, quote lines 9-13 of the block: "wall-clock `landedAt` is the series partition point"). The ledger rows are curated
  records whose fields carry editorial annotations distinct from the landing: `po-08cf23fabaa4` and `po-d2f81ee522b5` carry
  `mechanismChanged: gate-selection   # P0 Ruling 3: ...`; `po-0258120378b5` carries `# new value (ttc d1-ordering-handoff.md §4)`. A landing
  that no row records yet satisfies "landing of one change set" but fails the recorded-and-partitioned conjunct, and enters the class when a row
  is written. That makes membership depend on a later act, which contradicts the proposal's `ontoclean.rigidity: rigid` and the card's
  rigidity rationale, argued only for "the landing of a change" (`ic-chg-change-landing-001.yaml:107`). The OntoClean contradiction is
  internal to the proposal's own bytes plus the card, and the hypothetical unrecorded landing is the standard rigidity test, not a fact
  imported from outside the closure.
- Overstatement (does not void the landing): the counterexample calls Ruling 3 "a later 'P0 Ruling 3'". The quotes name a ruling and give its
  content. They do not date it against the landing, so "later" is an inference the closure does not state. The attack does not need it: each
  row records a `mergeCommit`, a value that exists only once the merge has happened, so the row postdates the landing on closure evidence. The
  same "later" wording then entered the revised proposal (`P/otp-chg-change-landing-001.yaml:61`) and r2's survived row `tagged-scope-versus-cq`
  (`...-r2.review.yaml:45`). See calibration point 5.
- Not a `ledger-governance-as-vocabulary` breach: the review uses the `mechanismChanged` comments as evidence that rows are curated. It does not
  propose them as a term, a criterion or a discriminator (brief :313).

Survived rows in r1 (`:21-52`) are not judged individually. r2 retried each of them on the revised bytes, and r2's rows are judged below.

## r2: `P/otp-chg-change-landing-001-r2.review.yaml` (latest; PASS). Judgement: sound

All four surfaces were attacked (`:6-10`). The r1 rule was re-attacked on the revised bytes (`:15-18`). Rivals are listed (`:59-63`), so the
gate will flag the proposal DISPUTED. That is the designed channel for steward-choice rivals. Per surface:

- Taxonomy. `parents: []` (`P/...001.yaml:28`). The placement in `ufo_category: event` and `gufo_alignment: gufo:Event` (`:22-23`) was
  attacked under `category-event-versus-information-object` (`:24-26`). Survived on the brief's rule that a still-viable category rival goes in
  a steward-choice open issue: all four FA rivals with `still_viable: true` (`fa-chg-change-landing-001.yaml:10-17`) are named in the
  proposal's open issues (`P/...001.yaml:51-54`) with discriminators, and none is left unnamed. `record-property-as-differentia` (`:16-18`) is
  correctly re-run against the revised definition (`P/...001.yaml:11`), which now puts recording, tagging and partitioning outside membership.
  `success-dependent-differentia` (`:20-22`) survived defensibly because the same definition places per-checkout taking effect in a separate
  adoption-qualified relation (`P/...001.yaml:11`, last clause; `ic-...:12-17`). r2 also left this as an optional wording request (`:13`).
  No missed taxonomy attack lands: the definition's examples are present in cited rows (heavy CI pool `po-95263f790b62`/`po-6a21b95a56d8`;
  pre-push wave `po-0258120378b5`; gate-order ladder `po-b754409ff756`), and all `definition.source` ids are inside the chain
  (`P/...001.yaml:12-20` against `dh-...:2-47`).
- Identity. The proposal claims nothing finished: `ontoclean.identity: unresolved` (`P/...001.yaml:26`), and the card has `supplies_identity`
  and `carries_identity` both unresolved (`ic-...:4`, `:31-32`). It names pr and mergeCommit as re-identification evidence only (`ic-...:26-28`).
  `identifier-is-identity` (`:27-30`), `identity-conflict` (`:31-34`) and `landing-versus-adoption` (`:35-38`) each survive on facts this audit
  checked against the observations: #1050 `landedAt 2026-09-09T09:13:51Z` (`po-95263f790b62`); #1364 `12:05:00Z` and #1422 `02:22:00Z`, the
  only whole-minute values among the 44 rows (`po-846d044b5a5d`, `po-1123c7cf085b`); #1141 "live 2026-09-15" against `2026-09-16T00:18:38Z`
  (`po-6a21b95a56d8`). The card's counterexamples also check out: #1067/#1068 are 16 s apart under one tag (`po-b4578e170e3a`,
  `po-bf3e9b98c990`); #1380/#1384 are 13 s apart under distinct tags (`po-55f2cd5382bf`, `po-c44335db46ef`); #874 and #1068 each bundle
  several alterations (`po-db48832ece45`, `po-bf3e9b98c990`). No row in the closure lacks a pr, so the brief's "runbook apply with no PR"
  candidate (brief :311) has no instance here. The one-PR-several-mechanisms candidate is answered by the card's unity clause (`ic-...:33`).
  Under the brief's standard nothing lands: an abstention cannot be falsified. Whether a term may pass with identity unresolved is calibration
  point 3.
- Warrant. CQ-016 is `should_have` (`CQF:405`). Its executable query types the referent directly:
  `?iv a ciops:OperationalChangeEvent ; ciops:landedAt ?landedAt .` (`CQF:413`). The class is not an untyped join node with the type only in
  `required_classes` (`CQF:416`), so `listing-cq-warrant` (`:39-42`) correctly survived: without the class the type pattern selects nothing
  and `expected_result: non_empty` (`CQF:415`) fails. `semantic_support_for: []` (`P/...001.yaml:40`). `landedAt` is `seed-only`
  (`s6/PREDICATES.yaml:492-493`) and the proposal does not claim it. `tagged-scope-versus-cq` (`:43-46`) survived correctly: the query has no
  tag pattern, so NL "tagged" (`CQF:403`) bounds the A-Box answer set, not the class. `ledger-governance-as-vocabulary` (`:47-50`) survived:
  `mechanismChanged` subclassing is rejected (`P/...001.yaml:46`).
- Null discriminator. `discriminator-true-of-dto` (`:51-54`) survived. The discriminator (`dh-...:71`) has two legs. Leg 1: rows date changes
  to the heavy CI pool, which the ledger does not hold (`po-95263f790b62`, `po-6a21b95a56d8`). A pure bookkeeping record has no referent of
  that kind, so leg 1 is false in the null world and carries the rejection. Leg 2 (the KPI law partitions series at `landedAt`; membership is
  tied to "the event's merge commit", `po-d63c0a7e9e45`) would also be true of a DTO timestamp field and a commit-hash field. r2 treated the
  conjunction as a whole and did not separate the legs. That is a reasoning gap but not a missed landing, because leg 1 alone rejects the
  null. `temporal-association-as-causation` (`:55-58`) survived correctly (`P/...001.yaml:11`, `:42`).

Missed attacks tested and not landed (not counted against the PASS):
- `claim-without-evidence` on `alternatives_rejected` (`P/...001.yaml:44`): "the reuse scan lists schema:Action as a closeMatch (medium) and
  sosa:Actuation as related (low) ... and the landedAt property against prov:atTime". No record in the closure holds a reuse scan. The claim
  only supports `mappings: []` and `exact_reuse_found: false`, so it cannot make the term wrong as proposed (brief :259). Calibration point 4.
- Open issues assert the null status of five sibling hypotheses (`P/...001.yaml:49`, `:53-54`, `:57-58`), which are outside this chain's
  closure. They are not claims about the term. Calibration point 4.
- Overstatement in `P/...001.yaml:49`, "Until a landedAt chain survives, CQ-016 is answered for its subject only": the query joins both
  patterns in one basic graph pattern (`CQF:413`), so without `landedAt` it returns no rows. Nothing is "answered for its subject". This is
  wording in an open issue, not a warrant claim. Calibration point 1.
- Hypothesis wording "All 44 change-event rows instantiate it" and "An instance is the change one row records" (`dh-...:52`): rows
  instantiating an event class is a world/information slip at the hypothesis level. The card and FA correct it to a row-grain *reading*
  (`ic-...:105`; `fa-...:73`), and the proposal claims no instance count (`P/...001.yaml:52`). It does not land on the proposal.

## Calibration

1. Warrant when the co-required predicate has no surviving chain. CQ-016 types the referent directly (`CQF:413`), so this proposal does not
   test the untyped-join-node pattern. It does raise the adjacent case: the class is necessary but not sufficient, because `landedAt` is
   seed-only (`s6/PREDICATES.yaml:492-493`) and, by the proposal's own account, its chain is not surviving (`P/...001.yaml:49`). In run 4, no
   ratified vocabulary answers CQ-016 non-empty. Both reviews read "a Must/Should CQ requires it" as necessity. For the untyped-join-node
   case, this audit's reading is that only a type pattern in the executable query, never `required_classes` alone, warrants a decision term.
   r2 applied that test (`:41`, "the query, not only required_classes, needs the class").
2. Steward-choice rivals and an `analyzed` verdict. The FA is `verdict: analyzed` with four `still_viable: true` rivals
   (`fa-...:10-17`, `:21`). Two are category rivals (information_object: the ledger row; the PR or merge commit). The card itself concedes
   that "on that reading no cited record separates row or artifact from landing" (`ic-...:110`). The proposal still asserts
   `ufo_category: event` (`P/...001.yaml:22`). The brief's rule that a category rival goes in a steward-choice open issue (brief :342-343) and
   its rule that a claim without evidence is a FAIL (brief :260) pull in opposite directions. r2 applied the former and flagged the rivals
   (DISPUTED). This audit counts the event claim as evidenced, though not discriminated: leg 1 rows show a world change occurred
   (`po-95263f790b62`, `po-6a21b95a56d8`). That is why the PASS is judged sound. The rows do not show whether the term denotes that change or
   the artifact that carries it.
3. PASS with identity unresolved. `ontoclean-rules.yaml` blocks "Kind with no identity provider", which does not apply to an event class. No
   check blocks `identity: unresolved` on a rigid event class. The card's criterion is close to circular ("the same landing when they are the
   same dated landing act", `ic-...:6-7`). The adversary can only falsify claims, so an abstention survives by construction.
4. Unsourced side claims. Assertions with no closure record, in fields that do not define the term (the "reuse scan" at `P/...001.yaml:44`;
   sibling hypotheses' null status at `:49`, `:53-54`, `:57-58`), were attacked by neither review.
5. Inference introduced by a review and propagated into the proposal. The adjective "later" for P0 Ruling 3 originated in r1 (`:14`, `:19`). It
   was adopted into the proposal (`P/...001.yaml:61`) and then used by r2 as survived reasoning (`:45`). Better closure support exists: the
   `mergeCommit` field can only be filled after the merge.

## Sitting questions

1. Does a decision-term warrant stand when the CQ's query types the class but every co-required predicate (here `ciops:landedAt`) is
   seed-only with no surviving chain, so that the CQ cannot return non-empty on run-4 vocabulary?
2. When the card concedes that no cited record separates the proposed category (event) from viable information-object rivals, does the
   adversary brief's "claim without evidence is a FAIL" reach the category claim? Or are the steward-choice open issue and the gate's
   DISPUTED flag the whole remedy, as r2 assumed?
3. May a PASS stand on a rigid event class whose identity criterion is `unresolved` on both supply and carriage, or should such a proposal
   draw INDETERMINATE with the card's needed evidence (merge-versus-apply times; the supersession record; a per-checkout HEAD-ancestry census)?
4. Are unsourced statements in `alternatives_rejected` and `open_issues` (an out-of-closure reuse scan; null status of sibling chains) reached
   by the claim-without-evidence rule, or only claims that define the term?
5. Should the adjective "later" in `P/...001.yaml:61` be corrected in a later synthesis pass to the closure-grounded reason (the row records a
   `mergeCommit`, so it postdates the merge), so that a review inference does not stand as proposal text?
