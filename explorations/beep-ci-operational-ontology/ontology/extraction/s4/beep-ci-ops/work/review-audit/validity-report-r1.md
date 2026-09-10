# Run 3 review-validity audit — round r1, sitting 1

Run: `orun-2026-09-10T02:10:52Z`; ontology: `beep-ci-ops`.
Frozen repository pin: `1c7cd98289150f481fd40721efa6b7fe6109e711`.
Authority: review-validity recommendations only. This auditor authored none of the proposals or reviews.

**All 13 landed attacks are demonstrated. No landed attack is invalid, no FAIL collapses, and all four INDETERMINATE reviews are honest abstentions.**

The round has 26 reviews: 11 FAIL, 11 PASS and 4 INDETERMINATE. Their attacks arrays contain 79
rows: 13 marked outcome: landed and 66 marked outcome: survived. This report accounts for every row
with the brief's binary judgment. A survived row is marked invalid as an adverse objection, with its
applicable class, because the counterexample does not defeat the proposal. That is agreement with
the review's existing survived outcome, not a finding that its author landed an invalid attack.
Those 66 rows require no new strike and are excluded from the steward's active attack docket.

Attack indices are **one-based positions in the unchanged review's `attacks` array**. They are not
renumbered after filtering to landed attacks.

## Totals and recommended cluster dispositions

| Measure | Count |
| --- | ---: |
| Reviews | 26 |
| Attack-array rows examined | 79 |
| Landed attacks | 13 |
| Demonstrated landed attacks | 13 |
| Invalid landed attacks / recommended strikes | 0 |
| Already-survived attempts, invalid as adverse objections | 66 |
| Collapsed FAILs | 0 |
| Honest / disengaged abstentions | 4 / 0 |
| Contested judgments | 0 |

| Cluster | Landed | Demonstrated | Invalid landed | Recommendation |
| --- | ---: | ---: | ---: | --- |
| warrant-necessity | 5 | 5 | 0 | Revise the new-class warrants or park the additional classes. |
| grain/dto-discriminator | 4 | 4 | 0 | Revise operational null rejection using observed effective-operation evidence, or retain the informational model. |
| null-discriminator | 4 | 4 | 0 | Revise the synthetic reconstruction claims using an observed modeled-state/consumer result, or leave them unresolved. |
| identity-card | 0 | 0 | 0 | Retain the four honest deferrals; no new identity attack is landed. |

All 26 proposals have `parents: []`. There is no asserted subsumption edge and no landed taxonomy
attack. Exact reuse is a mapping, not a superclass assertion; an empty taxonomy cluster is therefore
not manufactured. The four-cluster docket is
[sitting-1-docket.yaml](../sittings/sitting-1-docket.yaml).

| Invalid-attack class | Invalid landed attacks | Already-survived attempts, binary row accounting only |
| --- | ---: | ---: |
| misread CQ | 0 | 10 |
| superseded spelling used against a ratified split | 0 | 0 |
| exact-reuse-treated-as-new-subclass | 0 | 11 |
| carrier-only attack on already-supported content | 0 | 18 |
| evidence misquote | 0 | 0 |
| category error in the attack itself | 0 | 13 |
| attack on a rival the proposal already exposes as an explicit steward-choice issue | 0 | 14 |
| **Total** | **0** | **66** |

## Governing evidence and judgment boundaries

The adversary prompt requires a concrete identity counterexample, necessity under each executable
CQ, and an observation-backed fact that fails under the implementation-only null. The shared
foundational analysis separates syntax from domain commitment, report content from the reported
world, and decision/support warrant from implementation usefulness. The OntoClean rules apply only
on their stated surfaces; no new taxonomy or identity attack is introduced here.

Warrant judgments use the SPARQL bodies in competency-questions.yaml, not only natural-language
labels or required_classes. CQ-022's common inAttempt subject is necessary even without a type
pattern, and CQ-020's common step subject is necessary to preserve its index/request/tag joins.
Conversely, CQ-015 and CQ-025 do not require the proposed extra record/assertion individual when
their existing qualified subjects and joins are retained. This is not a satisfiable-by-subset
reading.

TAXONOMY.yaml establishes exact reuse for SeatRequest, SeatGrant, ScheduleProposal,
VerificationResultArtifact, admissionChargeTokens and hasOriginKey. It contains none of the five new
classes challenged on warrant. The 2026-09-03 run-2 sitting-1 ruling in DECISIONS.md ratified five
warrant, eleven DTO and four identity strikes. Its archived validity-report.md is used as format and
strike-class precedent, not as current-run evidence or as a numerical target. The present warrant
counterexamples preserve complete query answers; the eight landed null attacks target operational
referents, not already-supported assertion/specification content.

A disclosed rival does not itself make a proposal fail. Every such non-landed identity objection
remains non-landed below. However, retaining a rival does not establish the independently claimed
necessity of a new class or make rejected: true observation-backed. The five warrant and eight null
defects persist even though the proposals openly name alternatives and revision may be
straightforward. Synthetic provenance is retained: the four synthetic attacks require no
production-fleet claim and demonstrate no production absence.

Read inputs:

- `.claude/skills/ontology-foundational-auditor/prompts/ontoclean-adversary.md`
- `.claude/skills/_shared/ontoclean-rules.yaml`
- `.claude/skills/_shared/foundational-analysis.md`
- [Competency questions](../../../../../docs/competency-questions.yaml)
- [Ratified taxonomy](../../../../s5/TAXONOMY.yaml)
- [Run-2 sitting-1 rulings](../../../../../../DECISIONS.md)
- `ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.work/review-audit/validity-report.md`

## Per-proposal, per-attack judgments

### otp:admb-journal-entry:001

Review: [otp-admb-journal-entry-001.review.yaml](../proposals/otp-admb-journal-entry-001.review.yaml); original verdict: **FAIL**.
Proposal: [otp-admb-journal-entry-001.yaml](../proposals/otp-admb-journal-entry-001.yaml).
Bound records: [ic:admb-journal-entry:001](../foundational/ic-admb-journal-entry-001.yaml),
[fa:admb-journal-entry:001](../foundational/fa-admb-journal-entry-001.yaml),
[dh:admb-journal-entry:001](../hypotheses/dh-admb-journal-entry-001.yaml).

**Attack 1: `assertion-content-versus-empty-envelope`** (null_discriminator; review outcome: `survived`).
Audit verdict: **invalid — carrier-only attack on already-supported content** (already survived; no strike).

Copying the enqueue, admission and release assertions preserves three different meanings about the
represented boundaries. The selected referent is that assertion content, which may exist even when
its report is false. A DTO carrying those meanings therefore retains the proposed information
object; it does not establish the implementation-only null. Evidence:
[so:sha256:0cb159aa5cd447c7b42d80f0dcd792382db039de48f6cedab98b7fa24eefd929](../observations/so-0cb159aa5cd4.yaml);
[so:sha256:fa3b258421f3351e59071c2e155362cfecf3f26f91deb6077508331c112a5732](../observations/so-fa3b258421f3.yaml).

**Attack 2: `content-versus-token`** (identity; review outcome: `survived`).
Audit verdict: **invalid — attack on a rival the proposal already exposes as an explicit steward-choice issue** (already survived; no strike).

The card explicitly selects bounded assertion content and distinguishes it from an append token or
the operational event. Copies with the same complete meaning can realize one content; a correction
changes that meaning. Separate emissions are the expressly docketed token alternative, so this
countermodel does not contradict the selected criterion. Evidence:
[so:sha256:0cb159aa5cd447c7b42d80f0dcd792382db039de48f6cedab98b7fa24eefd929](../observations/so-0cb159aa5cd4.yaml);
[so:sha256:37556df811790ceed8c174c904a5bd979cf31fca012c98885bf9c56bd2408e06](../observations/so-37556df81179.yaml).

**Attack 3: `support-reification-not-required`** (warrant; review outcome: `landed`).
Audit verdict: **demonstrated**.

The novel AdmissionJournalEntry class is supported only through the two request/grant decision
proposals. CQ-021 and CQ-023 query the request and its qualified attributes; CQ-008 through CQ-010
query grants, standing and charge. The distinct boundary assertions and terminal-only ticket report
can be preserved by generic qualified assertions with those same targets and times, without an
AdmissionJournalEntry individual. The proposal demonstrates the need for assertion context but
supplies no necessary dependency on this new class. Its explicit generic-assertion choice does not
discharge the admission law for the submitted class; this is a warrant defect, not an attack merely
because a rival remains viable. Evidence:
[so:sha256:0cb159aa5cd447c7b42d80f0dcd792382db039de48f6cedab98b7fa24eefd929](../observations/so-0cb159aa5cd4.yaml);
[so:sha256:37556df811790ceed8c174c904a5bd979cf31fca012c98885bf9c56bd2408e06](../observations/so-37556df81179.yaml);
[CQ-008](../../../../../docs/competency-questions.yaml);
[CQ-009](../../../../../docs/competency-questions.yaml);
[CQ-010](../../../../../docs/competency-questions.yaml);
[CQ-021](../../../../../docs/competency-questions.yaml);
[CQ-023](../../../../../docs/competency-questions.yaml).

**FAIL does not collapse:** 1 landed attack remains demonstrated.

### otp:admb-seat-grant:001

Review: [otp-admb-seat-grant-001.review.yaml](../proposals/otp-admb-seat-grant-001.review.yaml); original verdict: **FAIL**.
Proposal: [otp-admb-seat-grant-001.yaml](../proposals/otp-admb-seat-grant-001.yaml).
Bound records: [ic:admb-seat-grant:001](../foundational/ic-admb-seat-grant-001.yaml),
[fa:admb-seat-grant:001](../foundational/fa-admb-seat-grant-001.yaml),
[dh:admb-seat-grant:001](../hypotheses/dh-admb-seat-grant-001.yaml).

**Attack 1: `discriminator-true-of-dto`** (null_discriminator; review outcome: `landed`).
Audit verdict: **demonstrated**.

The observations contain admitted/released assertions, a five-token charge and an origin value. The
hypothesis rejects the operational null because the asserted holding would be false without a grant.
A serializer preserving those statements while conferring no capacity leaves every cited
config_key_value fact true; the changed proposition is the report's truth, not an observed
allocating or consuming action. The definition nevertheless selects a conferred authorization
relator. The disclosed report alternative preserves a legitimate future choice but does not supply
the missing falsity-if-null fact for rejected: true. This is not a carrier-only objection to an
information-content proposal. Evidence:
[so:sha256:0cb159aa5cd447c7b42d80f0dcd792382db039de48f6cedab98b7fa24eefd929](../observations/so-0cb159aa5cd4.yaml);
[so:sha256:fa3b258421f3351e59071c2e155362cfecf3f26f91deb6077508331c112a5732](../observations/so-fa3b258421f3.yaml);
[CQ-008](../../../../../docs/competency-questions.yaml);
[CQ-009](../../../../../docs/competency-questions.yaml).

**Attack 2: `identifier-is-identity`** (identity; review outcome: `survived`).
Audit verdict: **invalid — category error in the attack itself** (already survived; no strike).

The criterion uses founding conferment and authorization continuity, not ownerRef, nonce, origin or
charge equality. A new conferment after release is another grant and a copied admission report is
not. The admission-only histories have unknown subsequent standing, which the proposal expressly
preserves. The countermodel attacks keys and missing-endpoint reasoning that the card does not
adopt. Evidence:
[so:sha256:0cb159aa5cd447c7b42d80f0dcd792382db039de48f6cedab98b7fa24eefd929](../observations/so-0cb159aa5cd4.yaml);
[so:sha256:2d8248aa5f752505a2e05771121da52124703fc12f9b5e7e93f7b0b9c19d31f0](../observations/so-2d8248aa5f75.yaml);
[so:sha256:c3e1661cf03110ab9ce93f8d312819fd42aaffb02151349fd866ff276585f51a](../observations/so-c3e1661cf031.yaml).

**Attack 3: `exact-reuse-decision-warrant`** (warrant; review outcome: `survived`).
Audit verdict: **invalid — exact-reuse-treated-as-new-subclass** (already survived; no strike).

SeatGrant is an exact reuse in TAXONOMY.yaml. CQ-008 and CQ-009 explicitly require typed active
SeatGrant subjects, and CQ-010 joins admitted work to its grant's charge and capacity context.
Replacing that subject by a request or holder loses the required query bindings. An
optional-new-subclass objection is outside the actual proposal. Evidence:
[so:sha256:0cb159aa5cd447c7b42d80f0dcd792382db039de48f6cedab98b7fa24eefd929](../observations/so-0cb159aa5cd4.yaml);
[CQ-008](../../../../../docs/competency-questions.yaml);
[CQ-009](../../../../../docs/competency-questions.yaml);
[CQ-010](../../../../../docs/competency-questions.yaml).

**FAIL does not collapse:** 1 landed attack remains demonstrated.

### otp:admb-seat-request:001

Review: [otp-admb-seat-request-001.review.yaml](../proposals/otp-admb-seat-request-001.review.yaml); original verdict: **FAIL**.
Proposal: [otp-admb-seat-request-001.yaml](../proposals/otp-admb-seat-request-001.yaml).
Bound records: [ic:admb-seat-request:001](../foundational/ic-admb-seat-request-001.yaml),
[fa:admb-seat-request:001](../foundational/fa-admb-seat-request-001.yaml),
[dh:admb-seat-request:001](../hypotheses/dh-admb-seat-request-001.yaml).

**Attack 1: `discriminator-true-of-dto`** (null_discriminator; review outcome: `landed`).
Audit verdict: **demonstrated**.

Both cited nonce chains positively report enqueue followed by withdrawal, with request kind,
priority, charge and times. Those fields remain present if a diagnostic/replay serializer emits the
histories without effective queue registration. The discriminator instead says that the claim of an
operational contender would be false. Its own rationale acknowledges that independent
registration/removal evidence is absent. The proposed registered-demand relator thus remains
vulnerable to the pure-record null despite the coherent demand/grant distinction and the explicitly
retained informational rival. Evidence:
[so:sha256:32c61047477e38037e83f1ea36f043d374648bec64c0322c760e28b1e186a1ab](../observations/so-32c61047477e.yaml);
[so:sha256:7ac3b5cb1ac099826f2b25a84c8accb975c476ddd0e528b779051cb733beb959](../observations/so-7ac3b5cb1ac0.yaml);
[CQ-021](../../../../../docs/competency-questions.yaml);
[CQ-023](../../../../../docs/competency-questions.yaml).

**Attack 2: `registration-versus-enduring-demand`** (identity; review outcome: `survived`).
Audit verdict: **invalid — attack on a rival the proposal already exposes as an explicit steward-choice issue** (already survived; no strike).

Registration continuity separates a fresh submission from a copy of the original report. The
proposal expressly presents an enduring demand with an anti-rigid queued role as a different steward
choice. Withdrawal therefore need not destroy that rival's bearer, and the attack cannot attribute
that consequence to the selected registration-bound relation. Evidence:
[so:sha256:32c61047477e38037e83f1ea36f043d374648bec64c0322c760e28b1e186a1ab](../observations/so-32c61047477e.yaml);
[so:sha256:7ac3b5cb1ac099826f2b25a84c8accb975c476ddd0e528b779051cb733beb959](../observations/so-7ac3b5cb1ac0.yaml);
[so:sha256:c172763fdd33d19ff88f00216028de800fb8247ea143740e4f4c8f7d7957ee6b](../observations/so-c172763fdd33.yaml);
[so:sha256:53a0cccc831c1b1a79553dd940a05f9dffd030177bddb3179c798aab17c4b973](../observations/so-53a0cccc831c.yaml).

**Attack 3: `exact-reuse-decision-warrant`** (warrant; review outcome: `survived`).
Audit verdict: **invalid — exact-reuse-treated-as-new-subclass** (already survived; no strike).

The proposal exactly reuses SeatRequest. CQ-021 requires the request subject with requester, work
kind, priority, charge and enqueue time; CQ-023 joins that same subject to wait and policy. A
withdrawn request need not have a grant. Replacing it with an agent or grant cannot preserve the
actual queries. Evidence:
[so:sha256:32c61047477e38037e83f1ea36f043d374648bec64c0322c760e28b1e186a1ab](../observations/so-32c61047477e.yaml);
[so:sha256:37556df811790ceed8c174c904a5bd979cf31fca012c98885bf9c56bd2408e06](../observations/so-37556df81179.yaml);
[CQ-021](../../../../../docs/competency-questions.yaml);
[CQ-023](../../../../../docs/competency-questions.yaml).

**FAIL does not collapse:** 1 landed attack remains demonstrated.

### otp:att-admission-allocation:001

Review: [otp-att-admission-allocation-001.review.yaml](../proposals/otp-att-admission-allocation-001.review.yaml); original verdict: **FAIL**.
Proposal: [otp-att-admission-allocation-001.yaml](../proposals/otp-att-admission-allocation-001.yaml).
Bound records: [ic:att-admission-allocation:001](../foundational/ic-att-admission-allocation-001.yaml),
[fa:att-admission-allocation:001](../foundational/fa-att-admission-allocation-001.yaml),
[dh:att-admission-allocation:001](../hypotheses/dh-att-admission-allocation-001.yaml).

**Attack 1: `discriminator-true-of-dto`** (null_discriminator; review outcome: `landed`).
Audit verdict: **demonstrated**.

The two lease records preserve admission/enqueue times, five-token charge, origin and attachment
time while their heartbeats differ. In the proposed null world, maintaining or replaying that lease
body can update heartbeat metadata without instituting effective charged capacity. The records
contain an attachment assertion, not an independently observed allocation or consuming scheduler
decision. The hypothesis rejects the null by appealing to the truth of its admission-and-charge
assertion. The proposal's explicit continuity deferral does not repair this separate rejection at
operational-allocation grain. Evidence:
[so:sha256:430e175a6bdb8aab1de9861e04c6cb1d1c2da64029b5bbf10f3a7a74a43b7f72](../observations/so-430e175a6bdb.yaml);
[so:sha256:afd98d3ec3075c1f779cfdc91884602818d783a17fe96a90a89c76333f773f3d](../observations/so-afd98d3ec307.yaml);
[CQ-008](../../../../../docs/competency-questions.yaml);
[CQ-010](../../../../../docs/competency-questions.yaml).

**Attack 2: `unresolved-allocation-continuity`** (identity; review outcome: `survived`).
Audit verdict: **invalid — attack on a rival the proposal already exposes as an explicit steward-choice issue** (already survived; no strike).

The snapshots do not distinguish uninterrupted allocation from replay or reacquisition of an equal
lease body. The card's identity supply is already unresolved and the proposal expressly defers that
continuity decision. The review correctly does not land an identity attack against a settled
criterion that was never asserted. Evidence:
[so:sha256:430e175a6bdb8aab1de9861e04c6cb1d1c2da64029b5bbf10f3a7a74a43b7f72](../observations/so-430e175a6bdb.yaml);
[so:sha256:afd98d3ec3075c1f779cfdc91884602818d783a17fe96a90a89c76333f773f3d](../observations/so-afd98d3ec307.yaml).

**Attack 3: `exact-reuse-decision-warrant`** (warrant; review outcome: `survived`).
Audit verdict: **invalid — exact-reuse-treated-as-new-subclass** (already survived; no strike).

SeatGrant is exactly reused. Counting its two lease snapshots as two grants or replacing it by a
pending ticket alters the active-grant population and double counts or misassigns charge. CQ-008
through CQ-010 require the allocation subject independently of whether this evidence settles its
identity. Evidence:
[so:sha256:430e175a6bdb8aab1de9861e04c6cb1d1c2da64029b5bbf10f3a7a74a43b7f72](../observations/so-430e175a6bdb.yaml);
[so:sha256:afd98d3ec3075c1f779cfdc91884602818d783a17fe96a90a89c76333f773f3d](../observations/so-afd98d3ec307.yaml);
[CQ-008](../../../../../docs/competency-questions.yaml);
[CQ-009](../../../../../docs/competency-questions.yaml);
[CQ-010](../../../../../docs/competency-questions.yaml).

**FAIL does not collapse:** 1 landed attack remains demonstrated.

### otp:att-attempt-verdict:001

Review: [otp-att-attempt-verdict-001.review.yaml](../proposals/otp-att-attempt-verdict-001.review.yaml); original verdict: **PASS**.
Proposal: [otp-att-attempt-verdict-001.yaml](../proposals/otp-att-attempt-verdict-001.yaml).
Bound records: [ic:att-attempt-verdict:001](../foundational/ic-att-attempt-verdict-001.yaml),
[fa:att-attempt-verdict:001](../foundational/fa-att-attempt-verdict-001.yaml),
[dh:att-attempt-verdict:001](../hypotheses/dh-att-attempt-verdict-001.yaml).

**Attack 1: `assessment-content-versus-empty-envelope`** (null_discriminator; review outcome: `survived`).
Audit verdict: **invalid — carrier-only attack on already-supported content** (already survived; no strike).

The failed verification and the later successful monitor carry distinct assessment content in their
own attempts and heads. Copying a report preserves that information even if the assessed execution
or readiness claim is wrong. The selected information object survives the DTO twin; it does not
assert present readiness or evidence-transfer authority. Evidence:
[so:sha256:3763576ed6977fcfbfc792faf096892f5e34923a008d37d2020de5f2d6aee198](../observations/so-3763576ed697.yaml);
[so:sha256:6bbb475abc365a8e1141fc2866a2068a16537948a20181b17bb9f5e14c83665f](../observations/so-6bbb475abc36.yaml).

**Attack 2: `assessment-origin-versus-content`** (identity; review outcome: `survived`).
Audit verdict: **invalid — attack on a rival the proposal already exposes as an explicit steward-choice issue** (already survived; no strike).

The selected criterion includes the originating assessment as well as its asserted content, so
independent equal-content assessments may be distinct while a faithful copy is not. The content-only
criterion in otp:ver-attempt-verdict:001 is explicitly presented as a joint steward choice. The
proposal does not claim the two criteria are already equivalent. Evidence:
[so:sha256:3763576ed6977fcfbfc792faf096892f5e34923a008d37d2020de5f2d6aee198](../observations/so-3763576ed697.yaml);
[so:sha256:6bbb475abc365a8e1141fc2866a2068a16537948a20181b17bb9f5e14c83665f](../observations/so-6bbb475abc36.yaml).

**Attack 3: `exact-reuse-support-targets`** (warrant; review outcome: `survived`).
Audit verdict: **invalid — exact-reuse-treated-as-new-subclass** (already survived; no strike).

VerificationResultArtifact is exact reuse of a ratified term. Its named targets are decision
proposals, and the cited results show why failure and measurement claims must retain their own
attempt and scope. Generic assertions remain an explicit representation alternative; they do not
turn this reused term into a newly invented optional subclass. Dependency on the duration proposal
remains conditional on that target's later disposition. Evidence:
[so:sha256:3763576ed6977fcfbfc792faf096892f5e34923a008d37d2020de5f2d6aee198](../observations/so-3763576ed697.yaml);
[so:sha256:6bbb475abc365a8e1141fc2866a2068a16537948a20181b17bb9f5e14c83665f](../observations/so-6bbb475abc36.yaml);
[CQ-022](../../../../../docs/competency-questions.yaml);
[CQ-025](../../../../../docs/competency-questions.yaml).

**No landed attacks.** The existing PASS has no demonstrated adverse attack in this audit; explicit
model choices and downstream dependencies remain for the steward.

### otp:att-verification-attempt:001

Review: [otp-att-verification-attempt-001.review.yaml](../proposals/otp-att-verification-attempt-001.review.yaml); original verdict: **FAIL**.
Proposal: [otp-att-verification-attempt-001.yaml](../proposals/otp-att-verification-attempt-001.yaml).
Bound records: [ic:att-verification-attempt:001](../foundational/ic-att-verification-attempt-001.yaml),
[fa:att-verification-attempt:001](../foundational/fa-att-verification-attempt-001.yaml),
[dh:att-verification-attempt:001](../hypotheses/dh-att-verification-attempt-001.yaml).

**Attack 1: `discriminator-true-of-dto`** (null_discriminator; review outcome: `landed`).
Audit verdict: **demonstrated**.

The cited start/finish pair reports an 81,605 ms failed repair, failed docgen, and subsequent
not-run feedback; a later pair reports a 135,370 ms successful repair. These are genuine
distinctions in recorded assertions. An unexecuted replay history preserves those parser facts and
their grouping, however. The discriminator says the execution claims would be false in that world,
rather than naming an observed execution/consumer fact that the null cannot preserve. CQ-022
warrants an attempt-scoped subject but cannot establish the causally continuous invocation selected
by this proposal. This does not dispute the card's coherent separation of retries or its explicit
event/process choice. Evidence:
[so:sha256:0b869db1f6652fd57dc5d94909efaba02e59d036d6c9756836013cc3f9eedf31](../observations/so-0b869db1f665.yaml);
[so:sha256:3c12eecfeade83fd24add873e6ddc1730a9afe60d0d2ea5d876309a1502a062c](../observations/so-3c12eecfeade.yaml);
[CQ-022](../../../../../docs/competency-questions.yaml).

**Attack 2: `specification-versus-invocation`** (identity; review outcome: `survived`).
Audit verdict: **invalid — category error in the attack itself** (already survived; no strike).

The card individuates the originating invocation and actual execution history. It does not identify
attempts by command or branch, include not-run steps as performed parts, or extend work to the later
reconciliation notice. The failed repair and healthy retry therefore stay separate under its stated
criterion; the alleged merge concerns a different criterion. Evidence:
[so:sha256:0b869db1f6652fd57dc5d94909efaba02e59d036d6c9756836013cc3f9eedf31](../observations/so-0b869db1f665.yaml);
[so:sha256:3c12eecfeade83fd24add873e6ddc1730a9afe60d0d2ea5d876309a1502a062c](../observations/so-3c12eecfeade.yaml);
[CQ-022](../../../../../docs/competency-questions.yaml).

**Attack 3: `attempt-scoped-cancellation-required`** (warrant; review outcome: `survived`).
Audit verdict: **invalid — misread CQ** (already survived; no strike).

CQ-022 joins both the committed failure and the running execution through the same inAttempt
variable. Removing the attempt boundary or joining only at run/episode grain admits a healthy retry
to the earlier failure's cancellation set. The absence of an rdf:type constraint on the join
variable does not erase this executable dependency. Evidence:
[so:sha256:0b869db1f6652fd57dc5d94909efaba02e59d036d6c9756836013cc3f9eedf31](../observations/so-0b869db1f665.yaml);
[CQ-022](../../../../../docs/competency-questions.yaml).

**FAIL does not collapse:** 1 landed attack remains demonstrated.

### otp:bind-admission-grant:001

Review: [otp-bind-admission-grant-001.review.yaml](../proposals/otp-bind-admission-grant-001.review.yaml); original verdict: **FAIL**.
Proposal: [otp-bind-admission-grant-001.yaml](../proposals/otp-bind-admission-grant-001.yaml).
Bound records: [ic:bind-admission-grant:001](../foundational/ic-bind-admission-grant-001.yaml),
[fa:bind-admission-grant:001](../foundational/fa-bind-admission-grant-001.yaml),
[dh:bind-admission-grant:001](../hypotheses/dh-bind-admission-grant-001.yaml).

**Attack 1: `discriminator-hypothetical-consumer`** (null_discriminator; review outcome: `landed`).
Audit verdict: **demonstrated**.

The sole synthetic observation records the correlated admission and release with a three-token
charge and a 69 ms represented holding interval. It records neither a before/after modeled
allocation state nor an active-holder reconstruction result. The discriminator's claim that removing
the allocation would change a reconstruction presupposes an unobserved consumer. A fixture
serializer can retain every supplied record without such an effective modeled allocation. Synthetic
provenance properly limits production claims but does not replace the required observation-backed
discriminator for the allocation relator. Evidence:
[so:sha256:27fc89410ea6dbdacff098a5500ba7a968df33a96e89d47c65b107e436fc301f](../observations/so-27fc89410ea6.yaml);
[CQ-008](../../../../../docs/competency-questions.yaml);
[CQ-009](../../../../../docs/competency-questions.yaml);
[CQ-010](../../../../../docs/competency-questions.yaml).

**Attack 2: `allocation-versus-token-provenance`** (identity; review outcome: `survived`).
Audit verdict: **invalid — category error in the attack itself** (already survived; no strike).

The card separates allocation identity from its nonce, charge, origin and ownerRef rendering.
Copying release does not create a second allocation; another instituting admission does. The
observed ownerRef change is capture metadata, not a participant transition. The countermodel
therefore targets a token/provenance criterion the proposal explicitly excludes. Evidence:
[so:sha256:27fc89410ea6dbdacff098a5500ba7a968df33a96e89d47c65b107e436fc301f](../observations/so-27fc89410ea6.yaml).

**Attack 3: `exact-reuse-decision-warrant`** (warrant; review outcome: `survived`).
Audit verdict: **invalid — exact-reuse-treated-as-new-subclass** (already survived; no strike).

The target is the ratified SeatGrant class. CQ-008 and CQ-009 require an active grant subject, while
CQ-010 associates the grant with its charge and pre-admission capacity. A requested demand or scalar
cannot replace that jointly qualified subject. Limited synthetic coverage constrains instance
conclusions, not exact-reuse necessity. Evidence:
[so:sha256:27fc89410ea6dbdacff098a5500ba7a968df33a96e89d47c65b107e436fc301f](../observations/so-27fc89410ea6.yaml);
[CQ-008](../../../../../docs/competency-questions.yaml);
[CQ-009](../../../../../docs/competency-questions.yaml);
[CQ-010](../../../../../docs/competency-questions.yaml).

**FAIL does not collapse:** 1 landed attack remains demonstrated.

### otp:bind-admission-request:001

Review: [otp-bind-admission-request-001.review.yaml](../proposals/otp-bind-admission-request-001.review.yaml); original verdict: **FAIL**.
Proposal: [otp-bind-admission-request-001.yaml](../proposals/otp-bind-admission-request-001.yaml).
Bound records: [ic:bind-admission-request:001](../foundational/ic-bind-admission-request-001.yaml),
[fa:bind-admission-request:001](../foundational/fa-bind-admission-request-001.yaml),
[dh:bind-admission-request:001](../hypotheses/dh-bind-admission-request-001.yaml).

**Attack 1: `discriminator-hypothetical-consumer`** (null_discriminator; review outcome: `landed`).
Audit verdict: **demonstrated**.

The synthetic observation supplies one enqueue/admission chain and one enqueue/withdrawal chain. It
contains no effective queue-state observation, interpreted request emission, or consumer result that
distinguishes a registered submission from the same serialized claims. The discriminator's
reconstruction argument therefore assumes the demand interpretation it must support. Deferring
demand-versus-role-versus-ticket identity is legitimate, but it does not establish the separately
asserted rejection of the implementation-only null. Evidence:
[so:sha256:27fc89410ea6dbdacff098a5500ba7a968df33a96e89d47c65b107e436fc301f](../observations/so-27fc89410ea6.yaml);
[CQ-021](../../../../../docs/competency-questions.yaml);
[CQ-023](../../../../../docs/competency-questions.yaml).

**Attack 2: `deferred-demand-identity`** (identity; review outcome: `survived`).
Audit verdict: **invalid — attack on a rival the proposal already exposes as an explicit steward-choice issue** (already survived; no strike).

The card and proposal explicitly leave demand identity, rigidity and category unresolved. They name
withdrawal/resubmission and ticket-copy observations to choose between one enduring demand and
separate queue participations. The given prefix fits both models; identifying that disclosed
uncertainty is not a contradiction of an accepted sameness criterion. Evidence:
[so:sha256:27fc89410ea6dbdacff098a5500ba7a968df33a96e89d47c65b107e436fc301f](../observations/so-27fc89410ea6.yaml).

**Attack 3: `exact-reuse-decision-warrant`** (warrant; review outcome: `survived`).
Audit verdict: **invalid — exact-reuse-treated-as-new-subclass** (already survived; no strike).

SeatRequest is exact reuse. The enqueue/withdrawal example needs no acquired grant, whereas CQ-021
and CQ-023 require the queued request subject and its own attributes/wait context. A grant-only
substitute drops that population and does not satisfy the actual query. Evidence:
[so:sha256:27fc89410ea6dbdacff098a5500ba7a968df33a96e89d47c65b107e436fc301f](../observations/so-27fc89410ea6.yaml);
[CQ-021](../../../../../docs/competency-questions.yaml);
[CQ-023](../../../../../docs/competency-questions.yaml).

**FAIL does not collapse:** 1 landed attack remains demonstrated.

### otp:bind-checkout-cache-binding:001

Review: [otp-bind-checkout-cache-binding-001.review.yaml](../proposals/otp-bind-checkout-cache-binding-001.review.yaml); original verdict: **FAIL**.
Proposal: [otp-bind-checkout-cache-binding-001.yaml](../proposals/otp-bind-checkout-cache-binding-001.yaml).
Bound records: [ic:bind-checkout-cache-binding:001](../foundational/ic-bind-checkout-cache-binding-001.yaml),
[fa:bind-checkout-cache-binding:001](../foundational/fa-bind-checkout-cache-binding-001.yaml),
[dh:bind-checkout-cache-binding:001](../hypotheses/dh-bind-checkout-cache-binding-001.yaml).

**Attack 1: `binding-content-versus-operational-relation`** (null_discriminator; review outcome: `survived`).
Audit verdict: **invalid — carrier-only attack on already-supported content** (already survived; no strike).

The two successful probes distinguish common Git administration from local-cache availability.
Retaining the absence report after a cache is created preserves an information object even though
accessibility changes. The proposal explicitly selects that qualified content, not a positive access
relator or skip authorization, so the carrier twin leaves the selected referent intact. Evidence:
[so:sha256:a90c39610e4a49911ace23bfa329876914961182bc6fbf2b9e8049b49ad3e3b9](../observations/so-a90c39610e4a.yaml);
[so:sha256:f4532e29f3f1752921effc1f49c1712e5662464ce09f553e1f81130927db3e6b](../observations/so-f4532e29f3f1.yaml);
[CQ-015](../../../../../docs/competency-questions.yaml).

**Attack 2: `capture-provenance-as-identity`** (identity; review outcome: `survived`).
Audit verdict: **invalid — category error in the attack itself** (already survived; no strike).

The card uses temporally qualified assertions about the denoted subjects, not capture-token lineage
or path spelling. It distinguishes the earlier branch/head snapshot from the two later probe
instants. Copies can preserve content and a later reference instant changes the asserted snapshot.
The countermodel therefore does not expose a capture-provenance identity criterion in the actual
card. Evidence:
[so:sha256:a90c39610e4a49911ace23bfa329876914961182bc6fbf2b9e8049b49ad3e3b9](../observations/so-a90c39610e4a.yaml);
[so:sha256:f4532e29f3f1752921effc1f49c1712e5662464ce09f553e1f81130927db3e6b](../observations/so-f4532e29f3f1.yaml).

**Attack 3: `decision-class-not-required-by-cq`** (warrant; review outcome: `landed`).
Audit verdict: **demonstrated**.

CQ-015's ASK traverses validInEpoch, cachedIn, mountsCache and inEpoch for the given proof and
checkout. The clone's present local cache and the linked worktree's absent local cache, together
with their separate probe times, can be retained as qualified source assertions without a
CheckoutCacheBindingRecord individual. Neither the query nor the observed probes consumes that
record's independent identity. The proposal is a new class, not an exact reuse in TAXONOMY.yaml; its
necessary association content does not establish the claimed decision-class warrant. Offering a
direct-relation steward choice does not make the submitted class query-required. Evidence:
[so:sha256:a90c39610e4a49911ace23bfa329876914961182bc6fbf2b9e8049b49ad3e3b9](../observations/so-a90c39610e4a.yaml);
[so:sha256:f4532e29f3f1752921effc1f49c1712e5662464ce09f553e1f81130927db3e6b](../observations/so-f4532e29f3f1.yaml);
[CQ-015](../../../../../docs/competency-questions.yaml).

**FAIL does not collapse:** 1 landed attack remains demonstrated.

### otp:bind-grant-termination:001

Review: [otp-bind-grant-termination-001.review.yaml](../proposals/otp-bind-grant-termination-001.review.yaml); original verdict: **FAIL**.
Proposal: [otp-bind-grant-termination-001.yaml](../proposals/otp-bind-grant-termination-001.yaml).
Bound records: [ic:bind-grant-termination:001](../foundational/ic-bind-grant-termination-001.yaml),
[fa:bind-grant-termination:001](../foundational/fa-bind-grant-termination-001.yaml),
[dh:bind-grant-termination:001](../hypotheses/dh-bind-grant-termination-001.yaml).

**Attack 1: `discriminator-hypothetical-consumer`** (null_discriminator; review outcome: `landed`).
Audit verdict: **demonstrated**.

The synthetic journal has a release correlated with a prior admission and a separate lease-eviction
report whose admission is absent. It supplies no observed active-holder reconstruction or
before/after effective holding state. The discriminator appeals to what a reconstruction would do
after removing release, but a record-only fixture can retain the same tags and times without a
modeled holding-ending transition. The attack applies to the proposed event denotation; it does not
refute the meaningful terminal assertion or assume the separate eviction really ended an effective
allocation. Evidence:
[so:sha256:27fc89410ea6dbdacff098a5500ba7a968df33a96e89d47c65b107e436fc301f](../observations/so-27fc89410ea6.yaml);
[CQ-008](../../../../../docs/competency-questions.yaml);
[CQ-009](../../../../../docs/competency-questions.yaml).

**Attack 2: `termination-event-versus-report`** (identity; review outcome: `survived`).
Audit verdict: **invalid — attack on a rival the proposal already exposes as an explicit steward-choice issue** (already survived; no strike).

The proposal expressly limits the event family to effective holding ends, keeps duplicated reports
separate from occurrences, and leaves stale-lease cleanup versus effective termination open. Its
criterion would count a copy once and need not count cleanup as the holding end. The rival that the
countermodel raises is already before the steward. Evidence:
[so:sha256:27fc89410ea6dbdacff098a5500ba7a968df33a96e89d47c65b107e436fc301f](../observations/so-27fc89410ea6.yaml).

**Attack 3: `support-reification-not-required`** (warrant; review outcome: `landed`).
Audit verdict: **demonstrated**.

The two supported SeatGrant proposals need qualified standing and an end boundary; CQ-008 and CQ-009
read hasGrantState and hasOriginKey. A complete active-grant snapshot or properly qualified holding
interval retains exactly those holder/conflict answers without an AdmissionGrantTermination
individual. Nothing in the cited synthetic record establishes a decision that must address that
event's identity. This is the missing necessity of a new support class, independently of both the
null defect and the explicitly exposed event/report choice. Evidence:
[so:sha256:27fc89410ea6dbdacff098a5500ba7a968df33a96e89d47c65b107e436fc301f](../observations/so-27fc89410ea6.yaml);
[CQ-008](../../../../../docs/competency-questions.yaml);
[CQ-009](../../../../../docs/competency-questions.yaml).

**FAIL does not collapse:** 2 landed attacks remain demonstrated.

### otp:bind-request-termination:001

Review: [otp-bind-request-termination-001.review.yaml](../proposals/otp-bind-request-termination-001.review.yaml); original verdict: **FAIL**.
Proposal: [otp-bind-request-termination-001.yaml](../proposals/otp-bind-request-termination-001.yaml).
Bound records: [ic:bind-request-termination:001](../foundational/ic-bind-request-termination-001.yaml),
[fa:bind-request-termination:001](../foundational/fa-bind-request-termination-001.yaml),
[dh:bind-request-termination:001](../hypotheses/dh-bind-request-termination-001.yaml).

**Attack 1: `discriminator-hypothetical-consumer`** (null_discriminator; review outcome: `landed`).
Audit verdict: **demonstrated**.

The synthetic source records a paired enqueue/withdrawal and a separate ticket eviction without
prior membership. The claimed changed queue reconstruction is not an observed result in that source.
A diagnostic serializer can preserve the terminal assertions while no effective pending
participation changes. The proposal selects a causal queue-exit event, so the attack reaches its
null rejection without treating every terminal report as an actual exit or using the unobserved
eviction prefix as fact. Evidence:
[so:sha256:27fc89410ea6dbdacff098a5500ba7a968df33a96e89d47c65b107e436fc301f](../observations/so-27fc89410ea6.yaml);
[CQ-021](../../../../../docs/competency-questions.yaml);
[CQ-023](../../../../../docs/competency-questions.yaml).

**Attack 2: `participation-end-versus-demand-destruction`** (identity; review outcome: `survived`).
Audit verdict: **invalid — attack on a rival the proposal already exposes as an explicit steward-choice issue** (already survived; no strike).

One enduring demand can have two pending participations with distinct exits while one exit has
multiple reports. The criterion explicitly follows the participation-ending transition, not demand
destruction, and the proposal keeps stale-record cleanup open. Those alternatives are already
exposed and do not contradict the selected conditional event criterion. Evidence:
[so:sha256:27fc89410ea6dbdacff098a5500ba7a968df33a96e89d47c65b107e436fc301f](../observations/so-27fc89410ea6.yaml).

**Attack 3: `support-reification-not-required`** (warrant; review outcome: `landed`).
Audit verdict: **demonstrated**.

CQ-021 enumerates currently queued request attributes and CQ-023 reads each request's observed wait,
policy and exception. Complete snapshot membership plus qualified historical boundaries can remove
the withdrawn request and stop its wait without an AdmissionRequestTermination individual. The
supported request proposal already separates pending participation from unresolved enduring-demand
identity. The observation supplies terminal claim content but no necessary decision dependency on a
separately identified exit event; an explicit modeling choice does not by itself satisfy that
support warrant. Evidence:
[so:sha256:27fc89410ea6dbdacff098a5500ba7a968df33a96e89d47c65b107e436fc301f](../observations/so-27fc89410ea6.yaml);
[CQ-021](../../../../../docs/competency-questions.yaml);
[CQ-023](../../../../../docs/competency-questions.yaml).

**FAIL does not collapse:** 2 landed attacks remain demonstrated.

### otp:ov-admission-token-charge:001

Review: [otp-ov-admission-token-charge-001.review.yaml](../proposals/otp-ov-admission-token-charge-001.review.yaml); original verdict: **INDETERMINATE**.
Proposal: [otp-ov-admission-token-charge-001.yaml](../proposals/otp-ov-admission-token-charge-001.yaml).
Bound records: [ic:ov-admission-token-charge:001](../foundational/ic-ov-admission-token-charge-001.yaml),
[fa:ov-admission-token-charge:001](../foundational/fa-ov-admission-token-charge-001.yaml),
[dh:ov-admission-token-charge:001](../hypotheses/dh-ov-admission-token-charge-001.yaml).

**Attack 1: `discriminator-true-of-dto`** (null_discriminator; review outcome: `survived`).
Audit verdict: **invalid — carrier-only attack on already-supported content** (already survived; no strike).

The quoted admission inequality consumes the represented weight, and the emitter records it as an
integer. Changing five to four against six active tokens and capacity ten changes the specified
comparison. A DTO retaining that policy quantity retains the selected recorded-value content;
neither the arithmetic example nor fixture values establish an actual admission. Evidence:
[po:sha256:2e21ce839f96febdf894e032e2ca261e4c23bf370efc690bf6693c8c5ecad944](../prose-observations/po-2e21ce839f96.yaml);
[po:sha256:311749b614c23138639131cb71b425997e745ddd05e189c7f2891f032756d4b8](../prose-observations/po-311749b614c2.yaml);
[po:sha256:a8c7221f4f2922f07fd3d1050fedcbc6619b8f517f520a04d74bcb428bd48f99](../prose-observations/po-a8c7221f4f29.yaml);
[CQ-010](../../../../../docs/competency-questions.yaml);
[CQ-021](../../../../../docs/competency-questions.yaml).

**Attack 2: `charge-assignment-versus-record-identity`** (identity; review outcome: `survived`).
Audit verdict: **invalid — attack on a rival the proposal already exposes as an explicit steward-choice issue** (already survived; no strike).

Three separate fixture requests share the value five, but the card does not merge them. It
explicitly defers whether repricing preserves a burden or replaces an assignment, while the proposal
selects a contextual scalar surface and preserves the joined card's unresolved grain. The
countermodel identifies that open choice rather than falsifying a settled identity. Evidence:
[po:sha256:16fb809acb88accc8782ac305315721aa1cebc3d2027d6ff011e61530bbf534e](../prose-observations/po-16fb809acb88.yaml);
[po:sha256:760f0329ca9cf07de6e0cee5cca9b529339ab28b7effd47602ece8c562d36215](../prose-observations/po-760f0329ca9c.yaml);
[po:sha256:ff30f28f0d1ca00f581157144cf6feeb9215e8249adf58e942b7989096c4f305](../prose-observations/po-ff30f28f0d1c.yaml);
[po:sha256:2e21ce839f96febdf894e032e2ca261e4c23bf370efc690bf6693c8c5ecad944](../prose-observations/po-2e21ce839f96.yaml).

**Attack 3: `listing-cq-warrant`** (warrant; review outcome: `survived`).
Audit verdict: **invalid — exact-reuse-treated-as-new-subclass** (already survived; no strike).

admissionChargeTokens is a ratified recorded-value property. CQ-021 requires the request charge
binding and CQ-010 compares the grant's charge with pre-admission capacity. P95 or physical memory
cannot replace it. Equal request/grant values do not establish continuity, which the proposal
explicitly leaves open. Evidence: [CQ-010](../../../../../docs/competency-questions.yaml);
[CQ-021](../../../../../docs/competency-questions.yaml);
[po:sha256:2e21ce839f96febdf894e032e2ca261e4c23bf370efc690bf6693c8c5ecad944](../prose-observations/po-2e21ce839f96.yaml);
[po:sha256:311749b614c23138639131cb71b425997e745ddd05e189c7f2891f032756d4b8](../prose-observations/po-311749b614c2.yaml).

**Abstention: honest.** No bound observation follows one independently reidentified request through repricing or establishes
whether a burden persists, an assignment is replaced, or successive assertions are distinct. Three
equal fixture values and the admission inequality establish recorded-charge content, not that
continuity rule. The joined IdentityCard explicitly retains this deferral. This abstention does not
deny the ratified scalar property's CQ warrant; selecting that scalar model and aligning its card
remains a steward/synthesis choice.

**Named missing observation:** A paired observation of one independently reidentified admission request before and after a policy
repricing, recording the effective policy, assessment instant, both token values, and whether the
charge assignment persists or is replaced. If the intended subject is only recorded charge content,
an observation-backed account must distinguish successive assertions from that continuing burden. A
subsequent grant assessment is also needed before any request/grant charge continuity can be
asserted.

**No landed attacks.** INDETERMINATE remains a substantive deferral, not a disguised FAIL or a
demonstrated identity contradiction.

### otp:ov-current-proposal-selection:001

Review: [otp-ov-current-proposal-selection-001.review.yaml](../proposals/otp-ov-current-proposal-selection-001.review.yaml); original verdict: **PASS**.
Proposal: [otp-ov-current-proposal-selection-001.yaml](../proposals/otp-ov-current-proposal-selection-001.yaml).
Bound records: [ic:ov-current-proposal-selection:001](../foundational/ic-ov-current-proposal-selection-001.yaml),
[fa:ov-current-proposal-selection:001](../foundational/fa-ov-current-proposal-selection-001.yaml),
[dh:ov-current-proposal-selection:001](../hypotheses/dh-ov-current-proposal-selection-001.yaml).

**Attack 1: `discriminator-true-of-dto`** (null_discriminator; review outcome: `survived`).
Audit verdict: **invalid — carrier-only attack on already-supported content** (already survived; no strike).

The fixture and emitter record the episode's selection of a proposal. A plain association to every
historical proposal cannot preserve CQ-020's current-sequence answer. A DTO that retains the
contextual selection retains the proposed information relation, without needing a separate selection
individual or proof of the globally latest operational plan. Evidence:
[po:sha256:0edda9c35fd73ea03c8097d5af03083ac39ed1c36db53c30f75ccff9b37018f7](../prose-observations/po-0edda9c35fd7.yaml);
[po:sha256:3aaad4dd6cb4ece15e0f3a57541ab2f4c6c43628046d086b4ed44da86e14ecf3](../prose-observations/po-3aaad4dd6cb4.yaml);
[CQ-020](../../../../../docs/competency-questions.yaml).

**Attack 2: `current-status-as-rigid-content`** (identity; review outcome: `survived`).
Audit verdict: **invalid — category error in the attack itself** (already survived; no strike).

The criterion includes projection context and reference instant. Changing selection from P to Q
leaves P's prescription and the archived earlier assertion intact; it does not make currentness a
rigid property of P. The timeless-union countermodel attacks a use the proposal explicitly excludes.
Evidence:
[po:sha256:0edda9c35fd73ea03c8097d5af03083ac39ed1c36db53c30f75ccff9b37018f7](../prose-observations/po-0edda9c35fd7.yaml);
[po:sha256:3aaad4dd6cb4ece15e0f3a57541ab2f4c6c43628046d086b4ed44da86e14ecf3](../prose-observations/po-3aaad4dd6cb4.yaml);
[po:sha256:793aeb58197f9924d61bfea309e8bdcf7c5a72b12d18f14a1c8aa42192631bd6](../prose-observations/po-793aeb58197f.yaml);
[CQ-020](../../../../../docs/competency-questions.yaml).

**Attack 3: `listing-cq-warrant`** (warrant; review outcome: `survived`).
Audit verdict: **invalid — misread CQ** (already survived; no strike).

CQ-020's first mandatory join is hasCurrentProposal from the supplied episode. Removing that edge
while keeping all plans and steps loses the answer; returning every historical proposal changes the
decision. This is an executable dependency, not a listing-only warrant. Evidence:
[CQ-020](../../../../../docs/competency-questions.yaml);
[po:sha256:0edda9c35fd73ea03c8097d5af03083ac39ed1c36db53c30f75ccff9b37018f7](../prose-observations/po-0edda9c35fd7.yaml).

**No landed attacks.** The existing PASS has no demonstrated adverse attack in this audit; explicit
model choices and downstream dependencies remain for the steward.

### otp:ov-origin-ordering-key:001

Review: [otp-ov-origin-ordering-key-001.review.yaml](../proposals/otp-ov-origin-ordering-key-001.review.yaml); original verdict: **PASS**.
Proposal: [otp-ov-origin-ordering-key-001.yaml](../proposals/otp-ov-origin-ordering-key-001.yaml).
Bound records: [ic:ov-origin-ordering-key:001](../foundational/ic-ov-origin-ordering-key-001.yaml),
[fa:ov-origin-ordering-key:001](../foundational/fa-ov-origin-ordering-key-001.yaml),
[dh:ov-origin-ordering-key:001](../hypotheses/dh-ov-origin-ordering-key-001.yaml).

**Attack 1: `decorative-ordering-key`** (null_discriminator; review outcome: `survived`).
Audit verdict: **invalid — carrier-only attack on already-supported content** (already survived; no strike).

The quoted canonical ordering tuple uses originKey before nonce when priority and enqueue time tie.
The emitter records that same comparison value. A decorative-string null cannot retain this
prescribed ordering role; a scalar implementation with that meaning still represents the selected
content. Evidence:
[po:sha256:0a705ee8990d0a77dc4f0056df8e60b331a8185ea2683459ea00998a977cb864](../prose-observations/po-0a705ee8990d.yaml);
[po:sha256:f21cd34ba9f97d991f2367f331b58ec556fb670642b2d02f434b141a1a69e78d](../prose-observations/po-f21cd34ba9f9.yaml);
[po:sha256:d5a14f495e7b2778abacb3727637a629965dec0f85bbefec53d76cba5a7690e3](../prose-observations/po-d5a14f495e7b.yaml);
[po:sha256:fe4b4d49ef566d86584b1cea395485bf0f230233e91478c746d3a8d23208e05c](../prose-observations/po-fe4b4d49ef56.yaml).

**Attack 2: `identifier-is-identity`** (identity; review outcome: `survived`).
Audit verdict: **invalid — category error in the attack itself** (already survived; no strike).

Three requests sharing origin-test are not identified with each other or with one repository by the
card. Its criterion is a contextual request/value assignment under the ordering convention. The
repository-identity and active-grant countermodels apply to interpretations explicitly excluded from
this property. Evidence:
[po:sha256:d4f2e09398646bf875ee3cbeeec6471c327a8a7b9d9d82425c754dbebd84c7f9](../prose-observations/po-d4f2e0939864.yaml);
[po:sha256:d5a14f495e7b2778abacb3727637a629965dec0f85bbefec53d76cba5a7690e3](../prose-observations/po-d5a14f495e7b.yaml);
[po:sha256:fe4b4d49ef566d86584b1cea395485bf0f230233e91478c746d3a8d23208e05c](../prose-observations/po-fe4b4d49ef56.yaml);
[po:sha256:f21cd34ba9f97d991f2367f331b58ec556fb670642b2d02f434b141a1a69e78d](../prose-observations/po-f21cd34ba9f9.yaml).

**Attack 3: `support-chain-or-optional-subclass`** (warrant; review outcome: `survived`).
Audit verdict: **invalid — exact-reuse-treated-as-new-subclass** (already survived; no strike).

The proposal reuses hasOriginKey and gives support warrants to the schedule and governing
specification, both CQ-020 decision proposals. The contract's tie-breaking tuple demonstrates the
comparison value's role in their ordering semantics. It does not claim that CQ-020 directly queries
the key or that repeated request values prove an exclusion violation. Evidence:
[po:sha256:0a705ee8990d0a77dc4f0056df8e60b331a8185ea2683459ea00998a977cb864](../prose-observations/po-0a705ee8990d.yaml);
[CQ-020](../../../../../docs/competency-questions.yaml);
[po:sha256:f21cd34ba9f97d991f2367f331b58ec556fb670642b2d02f434b141a1a69e78d](../prose-observations/po-f21cd34ba9f9.yaml).

**No landed attacks.** The existing PASS has no demonstrated adverse attack in this audit; explicit
model choices and downstream dependencies remain for the steward.

### otp:ov-projection-specification:001

Review: [otp-ov-projection-specification-001.review.yaml](../proposals/otp-ov-projection-specification-001.review.yaml); original verdict: **INDETERMINATE**.
Proposal: [otp-ov-projection-specification-001.yaml](../proposals/otp-ov-projection-specification-001.yaml).
Bound records: [ic:ov-projection-specification:001](../foundational/ic-ov-projection-specification-001.yaml),
[fa:ov-projection-specification:001](../foundational/fa-ov-projection-specification-001.yaml),
[dh:ov-projection-specification:001](../hypotheses/dh-ov-projection-specification-001.yaml).

**Attack 1: `discriminator-true-of-dto`** (null_discriminator; review outcome: `survived`).
Audit verdict: **invalid — carrier-only attack on already-supported content** (already survived; no strike).

The contract's ordering/admissibility constraints and the typed descriptive target support governing
information beyond an engine-run identifier. A DTO preserving that description retains the
information referent. The record-versus-reusable-rule grain remains explicitly open; the null test
does not settle it. Evidence:
[po:sha256:0e020e7ef4275a1870aa1bbe2dfd7c7dc9a43ac917734524b196108f57af6144](../prose-observations/po-0e020e7ef427.yaml);
[po:sha256:d7595abca1140723e1528dde7dc55311dd8ccaf15fecf1539a16050265e0eaf2](../prose-observations/po-d7595abca114.yaml);
[po:sha256:0a705ee8990d0a77dc4f0056df8e60b331a8185ea2683459ea00998a977cb864](../prose-observations/po-0a705ee8990d.yaml);
[po:sha256:a8c7221f4f2922f07fd3d1050fedcbc6619b8f517f520a04d74bcb428bd48f99](../prose-observations/po-a8c7221f4f29.yaml);
[CQ-020](../../../../../docs/competency-questions.yaml).

**Attack 2: `specification-versus-application-identity`** (identity; review outcome: `survived`).
Audit verdict: **invalid — attack on a rival the proposal already exposes as an explicit steward-choice issue** (already survived; no strike).

Unchanged rules with a different journal input distinguish reusable rule identity from
application-context identity. The card, analysis and proposal explicitly defer exactly this choice
and reject digest-only sameness. A single typed target with two digest fields does not provide a
contrary settled criterion. Evidence:
[po:sha256:2cbe4a487c0ebb475da0d4b4e9833105b7c1d677e942f04484e74049b825ee53](../prose-observations/po-2cbe4a487c0e.yaml);
[po:sha256:5fca51afd41b867323153c04a130b17cb4e394197487d89eb56a2eeb40ea42d3](../prose-observations/po-5fca51afd41b.yaml);
[po:sha256:9081cf3d4060a87388a3b4285f7ed6165aa24f39dc350fc3b3c3aeffec0e6b26](../prose-observations/po-9081cf3d4060.yaml);
[po:sha256:e9df49623f67f2eac1d565f6ab8811c99128f33a8610358f0944f64ae390aa5e](../prose-observations/po-e9df49623f67.yaml);
[po:sha256:0a705ee8990d0a77dc4f0056df8e60b331a8185ea2683459ea00998a977cb864](../prose-observations/po-0a705ee8990d.yaml).

**Attack 3: `capture-provenance-as-identity`** (identity; review outcome: `survived`).
Audit verdict: **invalid — category error in the attack itself** (already survived; no strike).

The observed policy and journal-prefix digests bind operational inputs; they are not capture
metadata. The card expressly denies that their equality settles identity, and recapture alone
creates no specification. Applying capture-provenance-as-identity to these excluded criteria is
outside the proposal's scope. Evidence:
[po:sha256:2cbe4a487c0ebb475da0d4b4e9833105b7c1d677e942f04484e74049b825ee53](../prose-observations/po-2cbe4a487c0e.yaml);
[po:sha256:5fca51afd41b867323153c04a130b17cb4e394197487d89eb56a2eeb40ea42d3](../prose-observations/po-5fca51afd41b.yaml);
[po:sha256:9081cf3d4060a87388a3b4285f7ed6165aa24f39dc350fc3b3c3aeffec0e6b26](../prose-observations/po-9081cf3d4060.yaml);
[po:sha256:e9df49623f67f2eac1d565f6ab8811c99128f33a8610358f0944f64ae390aa5e](../prose-observations/po-e9df49623f67.yaml).

**Attack 4: `listing-cq-warrant`** (warrant; review outcome: `survived`).
Audit verdict: **invalid — misread CQ** (already survived; no strike).

CQ-020 requires both the proposal-to-specification edge and the target's
AdmissionProjectionSpecification type. Removing that type defeats the actual query. A genuine
decision warrant does not decide whether the emitted target is reusable rules or an application
description. Evidence: [CQ-020](../../../../../docs/competency-questions.yaml);
[po:sha256:d7595abca1140723e1528dde7dc55311dd8ccaf15fecf1539a16050265e0eaf2](../prose-observations/po-d7595abca114.yaml).

**Abstention: honest.** The closure contains one illustrated typed specification target with policy and journal-prefix
digests, emitter quotations, normative rules, and replay material. It contains no paired
rule-fixed/input-changed and input-fixed/rule-changed observation that independently settles the
target's rule-object versus application-context identity. The definition expressly defers that
choice; more digest equality alone would not answer it.

**Named missing observation:** A comparison that keeps ordering/admissibility rule content and rule version fixed while changing
the journal input, followed by a comparison that changes rule content with the input fixed. Each
must identify whether the emitted descriptive target is the same reusable rule object or a distinct
application-context record independently of policyDigest, journalPrefixDigest, or IRI spelling.

**No landed attacks.** INDETERMINATE remains a substantive deferral, not a disguised FAIL or a
demonstrated identity contradiction.

### otp:ov-proposal-specification-binding:001

Review: [otp-ov-proposal-specification-binding-001.review.yaml](../proposals/otp-ov-proposal-specification-binding-001.review.yaml); original verdict: **PASS**.
Proposal: [otp-ov-proposal-specification-binding-001.yaml](../proposals/otp-ov-proposal-specification-binding-001.yaml).
Bound records: [ic:ov-proposal-specification-binding:001](../foundational/ic-ov-proposal-specification-binding-001.yaml),
[fa:ov-proposal-specification-binding:001](../foundational/fa-ov-proposal-specification-binding-001.yaml),
[dh:ov-proposal-specification-binding:001](../hypotheses/dh-ov-proposal-specification-binding-001.yaml).

**Attack 1: `semantically-empty-governing-link`** (null_discriminator; review outcome: `survived`).
Audit verdict: **invalid — carrier-only attack on already-supported content** (already survived; no strike).

The observed designation links this proposal to its typed descriptive target. Retaining independent
specifications while removing the designation loses CQ-020's governing-target answer. A carrier that
preserves the association preserves the information relation being proposed. Evidence:
[po:sha256:6015bb00bfc13c38c74674dd34cfb03ed21b85bff50aec615fe80a9f1ca8ad36](../prose-observations/po-6015bb00bfc1.yaml);
[po:sha256:95a467e6ebaab375ff2ad57e62d923b29f7237987d9e83c521704777a9438853](../prose-observations/po-95a467e6ebaa.yaml);
[po:sha256:0e020e7ef4275a1870aa1bbe2dfd7c7dc9a43ac917734524b196108f57af6144](../prose-observations/po-0e020e7ef427.yaml);
[po:sha256:d7595abca1140723e1528dde7dc55311dd8ccaf15fecf1539a16050265e0eaf2](../prose-observations/po-d7595abca114.yaml);
[CQ-020](../../../../../docs/competency-questions.yaml).

**Attack 2: `binding-target-grain-collapse`** (identity; review outcome: `survived`).
Audit verdict: **invalid — attack on a rival the proposal already exposes as an explicit steward-choice issue** (already survived; no strike).

The binding card identifies the recorded designation by proposal version, target and context. It
does not identify an application description with reusable rules or establish compliance. The
target-grain question is explicitly assigned to the specification steward choice, so this is no
hidden identity merge. Evidence:
[po:sha256:6015bb00bfc13c38c74674dd34cfb03ed21b85bff50aec615fe80a9f1ca8ad36](../prose-observations/po-6015bb00bfc1.yaml);
[po:sha256:95a467e6ebaab375ff2ad57e62d923b29f7237987d9e83c521704777a9438853](../prose-observations/po-95a467e6ebaa.yaml);
[po:sha256:d7595abca1140723e1528dde7dc55311dd8ccaf15fecf1539a16050265e0eaf2](../prose-observations/po-d7595abca114.yaml).

**Attack 3: `listing-cq-warrant`** (warrant; review outcome: `survived`).
Audit verdict: **invalid — misread CQ** (already survived; no strike).

CQ-020 mandatorily joins the current proposal to its specification through
hasProjectionSpecification. Independent target typing or a generic derivation edge cannot replace
that query pattern. The binding's warrant therefore survives while target identity remains deferred.
Evidence: [CQ-020](../../../../../docs/competency-questions.yaml);
[po:sha256:95a467e6ebaab375ff2ad57e62d923b29f7237987d9e83c521704777a9438853](../prose-observations/po-95a467e6ebaa.yaml).

**No landed attacks.** The existing PASS has no demonstrated adverse attack in this audit; explicit
model choices and downstream dependencies remain for the steward.

### otp:ov-proposal-step-membership:001

Review: [otp-ov-proposal-step-membership-001.review.yaml](../proposals/otp-ov-proposal-step-membership-001.review.yaml); original verdict: **PASS**.
Proposal: [otp-ov-proposal-step-membership-001.yaml](../proposals/otp-ov-proposal-step-membership-001.yaml).
Bound records: [ic:ov-proposal-step-membership:001](../foundational/ic-ov-proposal-step-membership-001.yaml),
[fa:ov-proposal-step-membership:001](../foundational/fa-ov-proposal-step-membership-001.yaml),
[dh:ov-proposal-step-membership:001](../hypotheses/dh-ov-proposal-step-membership-001.yaml).

**Attack 1: `serializer-adjacency-as-membership`** (null_discriminator; review outcome: `survived`).
Audit verdict: **invalid — carrier-only attack on already-supported content** (already survived; no strike).

The fixture's two explicit hasStep edges and the contract's admitted-step/deferred-tail distinction
give membership content independently of serialization order. Moving a deferred request next to
those rows does not make it a component. A content-preserving field therefore defeats the
semantically empty adjacency null. Evidence:
[po:sha256:4b06f5efe076d7ed81dd9d5b200c268b1d9e42cbe4f8c78086928bdaf65bb41e](../prose-observations/po-4b06f5efe076.yaml);
[po:sha256:a1e5e0d0916deb0cb33ee62f307e85aabb52833a88511c4c1fdc4885ec667857](../prose-observations/po-a1e5e0d0916d.yaml);
[po:sha256:8081b5c15707c6f49878d6d871f17862c72605489c31de3a31d56b12a59c5fc9](../prose-observations/po-8081b5c15707.yaml);
[po:sha256:0a705ee8990d0a77dc4f0056df8e60b331a8185ea2683459ea00998a977cb864](../prose-observations/po-0a705ee8990d.yaml);
[po:sha256:a8408e04e6bb8f46e4ff90294a80b9ca6d03d3ad48e77577e11b887e0f56733a](../prose-observations/po-a8408e04e6bb.yaml).

**Attack 2: `cross-proposal-membership-collapse`** (identity; review outcome: `survived`).
Audit verdict: **invalid — category error in the attack itself** (already survived; no strike).

The card includes the containing fixed prescription and its component. Equal ordinal zero or a
repeated request in another prescription does not identify the same membership. The proposed
relation describes informational structure, not a grant occurrence; the countermodel substitutes an
excluded key criterion. Evidence:
[po:sha256:4b06f5efe076d7ed81dd9d5b200c268b1d9e42cbe4f8c78086928bdaf65bb41e](../prose-observations/po-4b06f5efe076.yaml);
[po:sha256:a1e5e0d0916deb0cb33ee62f307e85aabb52833a88511c4c1fdc4885ec667857](../prose-observations/po-a1e5e0d0916d.yaml);
[po:sha256:0a705ee8990d0a77dc4f0056df8e60b331a8185ea2683459ea00998a977cb864](../prose-observations/po-0a705ee8990d.yaml);
[CQ-020](../../../../../docs/competency-questions.yaml).

**Attack 3: `listing-cq-warrant`** (warrant; review outcome: `survived`).
Audit verdict: **invalid — misread CQ** (already survived; no strike).

CQ-020 requires proposal-to-step membership, and CQ-019 uses that path in both derived-scope and
literal-tag arms. Retaining disconnected step attributes loses proposal attribution and the actual
joins. This necessity does not establish an absence-based violation in an open observation set.
Evidence: [CQ-020](../../../../../docs/competency-questions.yaml);
[CQ-019](../../../../../docs/competency-questions.yaml);
[po:sha256:8081b5c15707c6f49878d6d871f17862c72605489c31de3a31d56b12a59c5fc9](../prose-observations/po-8081b5c15707.yaml).

**No landed attacks.** The existing PASS has no demonstrated adverse attack in this audit; explicit
model choices and downstream dependencies remain for the steward.

### otp:ov-schedule-proposal:001

Review: [otp-ov-schedule-proposal-001.review.yaml](../proposals/otp-ov-schedule-proposal-001.review.yaml); original verdict: **PASS**.
Proposal: [otp-ov-schedule-proposal-001.yaml](../proposals/otp-ov-schedule-proposal-001.yaml).
Bound records: [ic:ov-schedule-proposal:001](../foundational/ic-ov-schedule-proposal-001.yaml),
[fa:ov-schedule-proposal:001](../foundational/fa-ov-schedule-proposal-001.yaml),
[dh:ov-schedule-proposal:001](../hypotheses/dh-ov-schedule-proposal-001.yaml).

**Attack 1: `projection-result-without-prescriptive-content`** (null_discriminator; review outcome: `survived`).
Audit verdict: **invalid — carrier-only attack on already-supported content** (already survived; no strike).

The typed fixture and totality contract distinguish the coordinated prescription and deferred
remainder from an arbitrary list. Copying that representation preserves the proposed prescription
content. The contract reserves real admissions to the deployed scheduler, so the proposal does not
infer enacted admissions from an output object. Evidence:
[po:sha256:351a4375bf86d6f06e1e558697ef04f2a5e283645a772d4fe5b3e78ac0c722bd](../prose-observations/po-351a4375bf86.yaml);
[po:sha256:b18d0154d573355ca2ecfcd8a45787237eac6ba6a335c5a69c783c8d0a078f29](../prose-observations/po-b18d0154d573.yaml);
[po:sha256:40e7562cb1c7744f4472ab4db2e562024f5554997915678e4ec8c759f11f1852](../prose-observations/po-40e7562cb1c7.yaml);
[po:sha256:a8408e04e6bb8f46e4ff90294a80b9ca6d03d3ad48e77577e11b887e0f56733a](../prose-observations/po-a8408e04e6bb.yaml);
[po:sha256:5e660542834fa3d2e917207f5764b6905b0654cfb825a0f34b4ac27bfe96bb02](../prose-observations/po-5e660542834f.yaml).

**Attack 2: `content-token-and-provenance-collapse`** (identity; review outcome: `survived`).
Audit verdict: **invalid — attack on a rival the proposal already exposes as an explicit steward-choice issue** (already survived; no strike).

The criterion selects complete fixed prescription content, including problem, instant, governing
constraints and deferred partition, while explicitly retaining issuance identity as a rival. Two
identical computations or carrier copies therefore need not create two prescriptions, and changing
the deferred partition changes the selected content. The token alternative is already exposed.
Evidence:
[po:sha256:a8408e04e6bb8f46e4ff90294a80b9ca6d03d3ad48e77577e11b887e0f56733a](../prose-observations/po-a8408e04e6bb.yaml);
[po:sha256:420a8a239adca76ab424a92d99109409c629f18f044eecd35bad7102254f4a05](../prose-observations/po-420a8a239adc.yaml);
[po:sha256:351a4375bf86d6f06e1e558697ef04f2a5e283645a772d4fe5b3e78ac0c722bd](../prose-observations/po-351a4375bf86.yaml);
[po:sha256:40e7562cb1c7744f4472ab4db2e562024f5554997915678e4ec8c759f11f1852](../prose-observations/po-40e7562cb1c7.yaml).

**Attack 3: `listing-cq-warrant`** (warrant; review outcome: `survived`).
Audit verdict: **invalid — exact-reuse-treated-as-new-subclass** (already survived; no strike).

ScheduleProposal is exact reuse in the ratified taxonomy, and CQ-020 explicitly requires its type
and proposal boundary. Removing the type loses an answer; combining historical sequences loses the
selected prescription. A separate deferred-tail predicate is not required to defend this reused
class. Evidence: [CQ-020](../../../../../docs/competency-questions.yaml);
[po:sha256:351a4375bf86d6f06e1e558697ef04f2a5e283645a772d4fe5b3e78ac0c722bd](../prose-observations/po-351a4375bf86.yaml);
[po:sha256:793aeb58197f9924d61bfea309e8bdcf7c5a72b12d18f14a1c8aa42192631bd6](../prose-observations/po-793aeb58197f.yaml).

**No landed attacks.** The existing PASS has no demonstrated adverse attack in this audit; explicit
model choices and downstream dependencies remain for the steward.

### otp:ov-schedule-step:001

Review: [otp-ov-schedule-step-001.review.yaml](../proposals/otp-ov-schedule-step-001.review.yaml); original verdict: **PASS**.
Proposal: [otp-ov-schedule-step-001.yaml](../proposals/otp-ov-schedule-step-001.yaml).
Bound records: [ic:ov-schedule-step:001](../foundational/ic-ov-schedule-step-001.yaml),
[fa:ov-schedule-step:001](../foundational/fa-ov-schedule-step-001.yaml),
[dh:ov-schedule-step:001](../hypotheses/dh-ov-schedule-step-001.yaml).

**Attack 1: `incidental-array-element-as-step`** (null_discriminator; review outcome: `survived`).
Audit verdict: **invalid — carrier-only attack on already-supported content** (already survived; no strike).

The fixture types the two instruction components and the contract restricts steps to prescribed
admitted choices. A deferred array element therefore does not automatically become a step. A tuple
implementation preserving this prescriptive component meaning remains a representation of the
candidate, not an implementation-only counterexample. Evidence:
[po:sha256:06c80d2d5ac506caeb4cb1ce68b4c468f3649ae03073a76c76820d9f276208d0](../prose-observations/po-06c80d2d5ac5.yaml);
[po:sha256:ddf53db309cbc347c227b14717939a8ef20e13dd4e5dc71cfaf9c6079719846e](../prose-observations/po-ddf53db309cb.yaml);
[po:sha256:fd09509eefc4bbf65ba4644d947b832ebcab35cdbd460bc3e14ec93f7c2a95b6](../prose-observations/po-fd09509eefc4.yaml);
[po:sha256:0a705ee8990d0a77dc4f0056df8e60b331a8185ea2683459ea00998a977cb864](../prose-observations/po-0a705ee8990d.yaml);
[po:sha256:420a8a239adca76ab424a92d99109409c629f18f044eecd35bad7102254f4a05](../prose-observations/po-420a8a239adc.yaml).

**Attack 2: `request-or-ordinal-as-component-identity`** (identity; review outcome: `survived`).
Audit verdict: **invalid — category error in the attack itself** (already survived; no strike).

The card identifies one instruction in one fixed prescription by its place, request assignment and
scope content. It does not identify steps by request or raw ordinal across plans, or count them as
live execution steps. Both alleged merges concern criteria it explicitly rejects. Evidence:
[po:sha256:ddf53db309cbc347c227b14717939a8ef20e13dd4e5dc71cfaf9c6079719846e](../prose-observations/po-ddf53db309cb.yaml);
[po:sha256:fd09509eefc4bbf65ba4644d947b832ebcab35cdbd460bc3e14ec93f7c2a95b6](../prose-observations/po-fd09509eefc4.yaml);
[po:sha256:0a705ee8990d0a77dc4f0056df8e60b331a8185ea2683459ea00998a977cb864](../prose-observations/po-0a705ee8990d.yaml);
[CQ-020](../../../../../docs/competency-questions.yaml).

**Attack 3: `support-term-not-decision`** (warrant; review outcome: `survived`).
Audit verdict: **invalid — misread CQ** (already survived; no strike).

The proposal correctly uses support warrants to four decision properties rather than the unqueried
ScheduleStep type. CQ-020 and CQ-019 need a common contextual step subject to keep membership,
index, request and tag together. Removing that binding creates lost attribution or cross-products;
the retained tuple alternative is a steward representation choice. Evidence:
[CQ-020](../../../../../docs/competency-questions.yaml);
[CQ-019](../../../../../docs/competency-questions.yaml);
[po:sha256:420a8a239adca76ab424a92d99109409c629f18f044eecd35bad7102254f4a05](../prose-observations/po-420a8a239adc.yaml).

**No landed attacks.** The existing PASS has no demonstrated adverse attack in this audit; explicit
model choices and downstream dependencies remain for the steward.

### otp:ov-seat-request:001

Review: [otp-ov-seat-request-001.review.yaml](../proposals/otp-ov-seat-request-001.review.yaml); original verdict: **INDETERMINATE**.
Proposal: [otp-ov-seat-request-001.yaml](../proposals/otp-ov-seat-request-001.yaml).
Bound records: [ic:ov-seat-request:001](../foundational/ic-ov-seat-request-001.yaml),
[fa:ov-seat-request:001](../foundational/fa-ov-seat-request-001.yaml),
[dh:ov-seat-request:001](../hypotheses/dh-ov-seat-request-001.yaml).

**Attack 1: `discriminator-true-of-request-dto`** (null_discriminator; review outcome: `survived`).
Audit verdict: **invalid — carrier-only attack on already-supported content** (already survived; no strike).

Typed request assertions plus the quoted pending reconstruction and projected-versus-recorded
admission comparison support a request candidate beyond an arbitrary work-specification name. The
impl report expressly withholds WorkUnitSpecification identity. This supports represented request
meaning while leaving the operational bearer and its continuity deferred; no live existence of
synthetic subjects is inferred. Evidence:
[po:sha256:0c5a0ac360560118bda477d323d7b7ae9977d379ec5a282b0184baf5195d43da](../prose-observations/po-0c5a0ac36056.yaml);
[po:sha256:3015f93b003a84d5a9e8ee82ac198ebe5bd86db390fd763e0aef039e2ed6c203](../prose-observations/po-3015f93b003a.yaml);
[po:sha256:83ac7ce996c2aacaf072f7c6977c423f511a3ec1d1d3b7f21a6fa64fb31ec86f](../prose-observations/po-83ac7ce996c2.yaml);
[po:sha256:2bd636283801ce0554f90ccad18d9af687c0492f9206e9428256c3232db5790d](../prose-observations/po-2bd636283801.yaml);
[po:sha256:a8408e04e6bb8f46e4ff90294a80b9ca6d03d3ad48e77577e11b887e0f56733a](../prose-observations/po-a8408e04e6bb.yaml);
[po:sha256:add8e23aa967029a87b088fab73de1335b0aa8348c184b34bcd7a821e783a8e4](../prose-observations/po-add8e23aa967.yaml).

**Attack 2: `request-continuity-underdetermined`** (identity; review outcome: `survived`).
Audit verdict: **invalid — attack on a rival the proposal already exposes as an explicit steward-choice issue** (already survived; no strike).

The card rejects projection-local IDs, matching descriptive values and copied grant fields as
sufficient identity. It explicitly defers continuity across projections, renewed submissions and the
end of pending membership. The quoted pending inequality does not answer those questions, so the
countermodel exposes an existing deferral rather than an accepted criterion. Evidence:
[po:sha256:f456cbb5c883ae06a4246878847ea9d98832618f2e923b54164a79cd2acfe000](../prose-observations/po-f456cbb5c883.yaml);
[po:sha256:420a8a239adca76ab424a92d99109409c629f18f044eecd35bad7102254f4a05](../prose-observations/po-420a8a239adc.yaml);
[po:sha256:a8408e04e6bb8f46e4ff90294a80b9ca6d03d3ad48e77577e11b887e0f56733a](../prose-observations/po-a8408e04e6bb.yaml);
[po:sha256:0c5a0ac360560118bda477d323d7b7ae9977d379ec5a282b0184baf5195d43da](../prose-observations/po-0c5a0ac36056.yaml);
[po:sha256:3015f93b003a84d5a9e8ee82ac198ebe5bd86db390fd763e0aef039e2ed6c203](../prose-observations/po-3015f93b003a.yaml);
[CQ-021](../../../../../docs/competency-questions.yaml).

**Attack 3: `listing-cq-warrant`** (warrant; review outcome: `survived`).
Audit verdict: **invalid — exact-reuse-treated-as-new-subclass** (already survived; no strike).

SeatRequest is exact reuse and is explicitly typed in CQ-020's request-target pattern and CQ-021's
queue pattern. Replacing it by WorkUnitSpecification or removing its type loses the required
subject. That necessity does not settle survival after admission. Evidence:
[CQ-020](../../../../../docs/competency-questions.yaml);
[CQ-021](../../../../../docs/competency-questions.yaml);
[po:sha256:add8e23aa967029a87b088fab73de1335b0aa8348c184b34bcd7a821e783a8e4](../prose-observations/po-add8e23aa967.yaml).

**Abstention: honest.** Typed synthetic requests, nonce serialization and the pending-membership inequality do not follow
one independently identified demand across two handling contexts, distinguish a repeated submission,
or show what survives its pending membership. The separate synthetic enqueue/withdrawal chain and
the organic journal assertions do not supply that missing continuity rule for this proposal's bound
hypothesis. Exact reuse preserves the request/grant/work-specification distinction but does not
settle the new analysis.

**Named missing observation:** An observation chain following one admission submission through two distinct queue/projection
observations and then admission or cancellation, with independently established requester/handling
participants. Include a second submission for the same work and an observation distinguishing it
from continued handling of the first, plus what remains after pending membership ends. Matching
nonce, local request IRI, or copied grant fields alone does not establish this continuity.

**No landed attacks.** INDETERMINATE remains a substantive deferral, not a disguised FAIL or a
demonstrated identity contradiction.

### otp:ov-step-position:001

Review: [otp-ov-step-position-001.review.yaml](../proposals/otp-ov-step-position-001.review.yaml); original verdict: **PASS**.
Proposal: [otp-ov-step-position-001.yaml](../proposals/otp-ov-step-position-001.yaml).
Bound records: [ic:ov-step-position:001](../foundational/ic-ov-step-position-001.yaml),
[fa:ov-step-position:001](../foundational/fa-ov-step-position-001.yaml),
[dh:ov-step-position:001](../hypotheses/dh-ov-step-position-001.yaml).

**Attack 1: `incidental-offset-as-order`** (null_discriminator; review outcome: `survived`).
Audit verdict: **invalid — carrier-only attack on already-supported content** (already survived; no strike).

The zero-based convention and emitted integers encode prescribed order independently of triple
order. Reordering Turtle leaves CQ-020's ORDER BY answer intact, while changing the indices changes
it. An incidental storage-offset interpretation therefore fails to preserve the selected
information. Evidence:
[po:sha256:25344c6969c1319b1e2f0a07a78cb2430df3673a4bfbd7ffdb464a08045d9020](../prose-observations/po-25344c6969c1.yaml);
[po:sha256:56dab857ecc5817302e6b956bc84d4d34dd0cfec80900f2fb02c28cde6b4c263](../prose-observations/po-56dab857ecc5.yaml);
[po:sha256:d712ca4caf1a7c10a0e008b0bf1d8ce078bf587c34a2d0b65e2c9f834ca2d0f7](../prose-observations/po-d712ca4caf1a.yaml);
[po:sha256:0a705ee8990d0a77dc4f0056df8e60b331a8185ea2683459ea00998a977cb864](../prose-observations/po-0a705ee8990d.yaml);
[CQ-020](../../../../../docs/competency-questions.yaml).

**Attack 2: `numeric-value-as-assignment-identity`** (identity; review outcome: `survived`).
Audit verdict: **invalid — category error in the attack itself** (already survived; no strike).

The criterion includes the contextual step, containing prescription and prescribed place. Equal zero
values in different proposals are equal integers, not one assignment. It expressly separates this
content from actual execution chronology, so the numerical-identity countermodel targets an excluded
interpretation. Evidence:
[po:sha256:25344c6969c1319b1e2f0a07a78cb2430df3673a4bfbd7ffdb464a08045d9020](../prose-observations/po-25344c6969c1.yaml);
[po:sha256:56dab857ecc5817302e6b956bc84d4d34dd0cfec80900f2fb02c28cde6b4c263](../prose-observations/po-56dab857ecc5.yaml);
[po:sha256:0a705ee8990d0a77dc4f0056df8e60b331a8185ea2683459ea00998a977cb864](../prose-observations/po-0a705ee8990d.yaml).

**Attack 3: `listing-cq-warrant`** (warrant; review outcome: `survived`).
Audit verdict: **invalid — misread CQ** (already survived; no strike).

CQ-020 both binds stepIndex and orders by it. An unordered member set cannot satisfy that answer,
and an unmaterialized precedence relation requires a different query or a derivation. The property
has an actual executable warrant. Evidence: [CQ-020](../../../../../docs/competency-questions.yaml);
[po:sha256:d712ca4caf1a7c10a0e008b0bf1d8ce078bf587c34a2d0b65e2c9f834ca2d0f7](../prose-observations/po-d712ca4caf1a.yaml).

**No landed attacks.** The existing PASS has no demonstrated adverse attack in this audit; explicit
model choices and downstream dependencies remain for the steward.

### otp:ov-step-request-assignment:001

Review: [otp-ov-step-request-assignment-001.review.yaml](../proposals/otp-ov-step-request-assignment-001.review.yaml); original verdict: **PASS**.
Proposal: [otp-ov-step-request-assignment-001.yaml](../proposals/otp-ov-step-request-assignment-001.yaml).
Bound records: [ic:ov-step-request-assignment:001](../foundational/ic-ov-step-request-assignment-001.yaml),
[fa:ov-step-request-assignment:001](../foundational/fa-ov-step-request-assignment-001.yaml),
[dh:ov-step-request-assignment:001](../hypotheses/dh-ov-step-request-assignment-001.yaml).

**Attack 1: `uninterpreted-pointer-as-request-assignment`** (null_discriminator; review outcome: `survived`).
Audit verdict: **invalid — carrier-only attack on already-supported content** (already survived; no strike).

The fixture and emitter explicitly direct the two steps to request targets, and the implementation
report says no WorkUnitSpecification identity is available. A pointer preserving those targets
retains prescriptive assignment content; an arbitrary work-specification label does not preserve the
cited meaning. Evidence:
[po:sha256:1ff63941e76bc9a539ee52972344b2f05135c4fe2121f4f7d4bc6508cdb8805a](../prose-observations/po-1ff63941e76b.yaml);
[po:sha256:7f9eb7c183ed32fda7d59f429762811cda9842630765794f877ac24984cdbc6e](../prose-observations/po-7f9eb7c183ed.yaml);
[po:sha256:cd67bb659368f2dec0b98390be1ed591ffc116f2c9233962bfb97ac28365b66f](../prose-observations/po-cd67bb659368.yaml);
[po:sha256:add8e23aa967029a87b088fab73de1335b0aa8348c184b34bcd7a821e783a8e4](../prose-observations/po-add8e23aa967.yaml);
[CQ-020](../../../../../docs/competency-questions.yaml).

**Attack 2: `assignment-bearer-or-execution-collapse`** (identity; review outcome: `survived`).
Audit verdict: **invalid — category error in the attack itself** (already survived; no strike).

The assignment criterion includes step and containing prescription, not target identity alone. It
explicitly declines cross-projection request sameness from matching strings and makes no execution
claim. Repeated targets therefore do not merge assignments or grants under the proposed card.
Evidence:
[po:sha256:1ff63941e76bc9a539ee52972344b2f05135c4fe2121f4f7d4bc6508cdb8805a](../prose-observations/po-1ff63941e76b.yaml);
[po:sha256:7f9eb7c183ed32fda7d59f429762811cda9842630765794f877ac24984cdbc6e](../prose-observations/po-7f9eb7c183ed.yaml);
[po:sha256:cd67bb659368f2dec0b98390be1ed591ffc116f2c9233962bfb97ac28365b66f](../prose-observations/po-cd67bb659368.yaml);
[po:sha256:add8e23aa967029a87b088fab73de1335b0aa8348c184b34bcd7a821e783a8e4](../prose-observations/po-add8e23aa967.yaml).

**Attack 3: `listing-cq-warrant`** (warrant; review outcome: `survived`).
Audit verdict: **invalid — misread CQ** (already survived; no strike).

CQ-020 traverses schedulesSeatRequest to return the target, and CQ-019's literal-tag arm also
requires that edge. Retaining only indices and tags loses mandatory bindings. Replacing the request
by an execution or work specification changes the required relation. Evidence:
[CQ-020](../../../../../docs/competency-questions.yaml);
[CQ-019](../../../../../docs/competency-questions.yaml);
[po:sha256:cd67bb659368f2dec0b98390be1ed591ffc116f2c9233962bfb97ac28365b66f](../prose-observations/po-cd67bb659368.yaml).

**No landed attacks.** The existing PASS has no demonstrated adverse attack in this audit; explicit
model choices and downstream dependencies remain for the steward.

### otp:ov-step-scope-tag:001

Review: [otp-ov-step-scope-tag-001.review.yaml](../proposals/otp-ov-step-scope-tag-001.review.yaml); original verdict: **PASS**.
Proposal: [otp-ov-step-scope-tag-001.yaml](../proposals/otp-ov-step-scope-tag-001.yaml).
Bound records: [ic:ov-step-scope-tag:001](../foundational/ic-ov-step-scope-tag-001.yaml),
[fa:ov-step-scope-tag:001](../foundational/fa-ov-step-scope-tag-001.yaml),
[dh:ov-step-scope-tag:001](../hypotheses/dh-ov-step-scope-tag-001.yaml).

**Attack 1: `decorative-label-as-scope-content`** (null_discriminator; review outcome: `survived`).
Audit verdict: **invalid — carrier-only attack on already-supported content** (already survived; no strike).

Both fixture instructions carry admission and the contract explains its act-scope meaning. The
emitter preserves step.scope and CQ-020 returns it. A purely decorative caption cannot retain those
semantics; an annotation literal can, without creating a Scope individual. Evidence:
[po:sha256:004887d37eb13319a467b294764093c16a3cb02165cc88ceba6b7bfa4768f77c](../prose-observations/po-004887d37eb1.yaml);
[po:sha256:2f321cd61b02333d2a2d195f7ea7b1e6b0b6af9b7f5f0057ad31897d51dadbcf](../prose-observations/po-2f321cd61b02.yaml);
[po:sha256:4f04e3e271c8c0235d57fc4d8e275238ef1cb7f0cba9dbe0a05ffc90ac2aa7b7](../prose-observations/po-4f04e3e271c8.yaml);
[po:sha256:420a8a239adca76ab424a92d99109409c629f18f044eecd35bad7102254f4a05](../prose-observations/po-420a8a239adc.yaml);
[CQ-020](../../../../../docs/competency-questions.yaml).

**Attack 2: `tag-value-as-scope-individual-identity`** (identity; review outcome: `survived`).
Audit verdict: **invalid — category error in the attack itself** (already survived; no strike).

The card identifies the annotation by contextual step and tagging convention. A repeated admission
string supplies neither one shared annotation assignment nor FullRepoScope or an affected-package
set. The countermodel applies those identities to a property that explicitly excludes them.
Evidence:
[po:sha256:004887d37eb13319a467b294764093c16a3cb02165cc88ceba6b7bfa4768f77c](../prose-observations/po-004887d37eb1.yaml);
[po:sha256:2f321cd61b02333d2a2d195f7ea7b1e6b0b6af9b7f5f0057ad31897d51dadbcf](../prose-observations/po-2f321cd61b02.yaml);
[po:sha256:420a8a239adca76ab424a92d99109409c629f18f044eecd35bad7102254f4a05](../prose-observations/po-420a8a239adc.yaml).

**Attack 3: `listing-cq-warrant`** (warrant; review outcome: `survived`).
Audit verdict: **invalid — misread CQ** (already survived; no strike).

CQ-020 requires the scope tag and CQ-019's request-step arm tests hasScopeTag with isLiteral.
Omitting it or replacing it with object-valued hasScope loses the actual query operands. This
establishes necessity without asserting a provenance result under missing closure. Evidence:
[CQ-020](../../../../../docs/competency-questions.yaml);
[CQ-019](../../../../../docs/competency-questions.yaml);
[po:sha256:4f04e3e271c8c0235d57fc4d8e275238ef1cb7f0cba9dbe0a05ffc90ac2aa7b7](../prose-observations/po-4f04e3e271c8.yaml).

**No landed attacks.** The existing PASS has no demonstrated adverse attack in this audit; explicit
model choices and downstream dependencies remain for the steward.

### otp:ov-verification-episode:001

Review: [otp-ov-verification-episode-001.review.yaml](../proposals/otp-ov-verification-episode-001.review.yaml); original verdict: **INDETERMINATE**.
Proposal: [otp-ov-verification-episode-001.yaml](../proposals/otp-ov-verification-episode-001.yaml).
Bound records: [ic:ov-verification-episode:001](../foundational/ic-ov-verification-episode-001.yaml),
[fa:ov-verification-episode:001](../foundational/fa-ov-verification-episode-001.yaml),
[dh:ov-verification-episode:001](../hypotheses/dh-ov-verification-episode-001.yaml).

**Attack 1: `typed-correlation-context-versus-occurrence`** (null_discriminator; review outcome: `survived`).
Audit verdict: **invalid — carrier-only attack on already-supported content** (already survived; no strike).

The typed fixture and required caller-specific anchor support episode-context information beyond an
empty type name. They do not establish a bounded verification occurrence. The proposal explicitly
defers occurrence-versus-correlation grain, so this attempted null objection cannot eliminate the
shared representational candidate or settle the occurrence model. Evidence:
[po:sha256:12f6a94e569b6eb3233e6561f4813f1adf0323d5d48aec26096316c5d0f3b5f4](../prose-observations/po-12f6a94e569b.yaml);
[po:sha256:25ea7f9c17a93501c966554db90ec78cde44eebd8ea9084f831f9cd2d97d96b3](../prose-observations/po-25ea7f9c17a9.yaml);
[po:sha256:420a8a239adca76ab424a92d99109409c629f18f044eecd35bad7102254f4a05](../prose-observations/po-420a8a239adc.yaml);
[po:sha256:793aeb58197f9924d61bfea309e8bdcf7c5a72b12d18f14a1c8aa42192631bd6](../prose-observations/po-793aeb58197f.yaml);
[CQ-020](../../../../../docs/competency-questions.yaml).

**Attack 2: `episode-unity-underdetermined`** (identity; review outcome: `survived`).
Audit verdict: **invalid — attack on a rival the proposal already exposes as an explicit steward-choice issue** (already survived; no strike).

The card does not identify episodes by episodeId and explicitly lacks initiating, membership and
closing boundaries. Reusing one ID for disconnected histories or renaming one continuing history
therefore does not falsify a claimed positive criterion. It states the open unity question that the
review properly leaves unresolved. Evidence:
[po:sha256:12f6a94e569b6eb3233e6561f4813f1adf0323d5d48aec26096316c5d0f3b5f4](../prose-observations/po-12f6a94e569b.yaml);
[po:sha256:25ea7f9c17a93501c966554db90ec78cde44eebd8ea9084f831f9cd2d97d96b3](../prose-observations/po-25ea7f9c17a9.yaml);
[po:sha256:420a8a239adca76ab424a92d99109409c629f18f044eecd35bad7102254f4a05](../prose-observations/po-420a8a239adc.yaml);
[po:sha256:793aeb58197f9924d61bfea309e8bdcf7c5a72b12d18f14a1c8aa42192631bd6](../prose-observations/po-793aeb58197f.yaml).

**Attack 3: `support-term-not-decision`** (warrant; review outcome: `survived`).
Audit verdict: **invalid — misread CQ** (already survived; no strike).

The proposal does not pretend CQ-020 queries a VerificationEpisode type triple. It supports the
query-required current-selection relation with a coherent subject interpretation. The actual join
needs an anchor that avoids unrelated-history merges, while the occurrence-versus-correlation model
remains a separate choice. Evidence: [CQ-020](../../../../../docs/competency-questions.yaml);
[po:sha256:420a8a239adca76ab424a92d99109409c629f18f044eecd35bad7102254f4a05](../prose-observations/po-420a8a239adc.yaml).

**Abstention: honest.** The typed fixture subject and non-empty caller-supplied episodeId establish a represented anchor.
Neither supplies initiating/closing boundaries, retry membership, proposal replacement history, or a
contrast separating renamed continuity from disconnected histories. The proposed occurrence and
correlation-information rival therefore remain distinguishable models that the cited evidence does
not decide.

**Named missing observation:** An observed verification history with a stated initiating boundary, activity or attempt membership
through retry and proposal replacement, and a closing or abandonment boundary. Include a contrasting
disconnected history or an identifier reassignment, with an observation-backed unity rule that
explains whether the histories constitute one verification occurrence independently of episodeId
equality. This must distinguish an occurrence from a caller-chosen correlation record.

**No landed attacks.** INDETERMINATE remains a substantive deferral, not a disguised FAIL or a
demonstrated identity contradiction.

### otp:ver-attempt-verdict:001

Review: [otp-ver-attempt-verdict-001.review.yaml](../proposals/otp-ver-attempt-verdict-001.review.yaml); original verdict: **PASS**.
Proposal: [otp-ver-attempt-verdict-001.yaml](../proposals/otp-ver-attempt-verdict-001.yaml).
Bound records: [ic:ver-attempt-verdict:001](../foundational/ic-ver-attempt-verdict-001.yaml),
[fa:ver-attempt-verdict:001](../foundational/fa-ver-attempt-verdict-001.yaml),
[dh:ver-attempt-verdict:001](../hypotheses/dh-ver-attempt-verdict-001.yaml).

**Attack 1: `result-content-versus-empty-envelope`** (null_discriminator; review outcome: `survived`).
Audit verdict: **invalid — carrier-only attack on already-supported content** (already survived; no strike).

The reports distinguish failed verification after a successful push from a failed push after a
successful commit. An envelope preserving those component associations contains the selected result
information. This does not depend on proving the report true or treating it as attained assurance.
Evidence:
[so:sha256:34ba8416b74877505a8a69b9947fcebfab0c62e4f3bbd30218232b857e4539bf](../observations/so-34ba8416b748.yaml);
[so:sha256:05bdfd88fe028976d02147ad0bfa51ad66828d2ceae653806a6a947e8374aeda](../observations/so-05bdfd88fe02.yaml).

**Attack 2: `content-versus-document-and-assessment`** (identity; review outcome: `survived`).
Audit verdict: **invalid — attack on a rival the proposal already exposes as an explicit steward-choice issue** (already survived; no strike).

The card selects complete report-content snapshots, distinguishing corrections and omitted versus
not-run content while allowing faithful copies. The assessment-origin model in
otp:att-attempt-verdict:001 is explicitly a joint steward choice. Sparse older reports remain within
the proposed grain; no equivalence between rival criteria is silently asserted. Evidence:
[so:sha256:34ba8416b74877505a8a69b9947fcebfab0c62e4f3bbd30218232b857e4539bf](../observations/so-34ba8416b748.yaml);
[so:sha256:05bdfd88fe028976d02147ad0bfa51ad66828d2ceae653806a6a947e8374aeda](../observations/so-05bdfd88fe02.yaml);
[so:sha256:929aa987fb5e550c58968f28fd06947d1bfd2b788815a77376329f06d9ca765a](../observations/so-929aa987fb5e.yaml).

**Attack 3: `exact-reuse-support-targets`** (warrant; review outcome: `survived`).
Audit verdict: **invalid — exact-reuse-treated-as-new-subclass** (already survived; no strike).

VerificationResultArtifact is exact reuse. Its support targets are decision proposals for attempt
and duration scope, and the cited result distinctions prevent pushed=true or a selected tier from
replacing completed verification. Generic assertions remain a choice, not an optional-new-subclass
attack. The support dependency must follow any later revision or parking of its duration target.
Evidence:
[so:sha256:34ba8416b74877505a8a69b9947fcebfab0c62e4f3bbd30218232b857e4539bf](../observations/so-34ba8416b748.yaml);
[so:sha256:9078a6ab88adf6e8ae99c1baafab237dd8c100a21fa8425143ca76a0f5bb6fcc](../observations/so-9078a6ab88ad.yaml);
[so:sha256:1008941903be9f39b5f8ee44d50647d0b02ea0a1988e1712481a22f35e6a0465](../observations/so-1008941903be.yaml);
[CQ-022](../../../../../docs/competency-questions.yaml);
[CQ-025](../../../../../docs/competency-questions.yaml).

**No landed attacks.** The existing PASS has no demonstrated adverse attack in this audit; explicit
model choices and downstream dependencies remain for the steward.

### otp:ver-wall-time-evidence:001

Review: [otp-ver-wall-time-evidence-001.review.yaml](../proposals/otp-ver-wall-time-evidence-001.review.yaml); original verdict: **FAIL**.
Proposal: [otp-ver-wall-time-evidence-001.yaml](../proposals/otp-ver-wall-time-evidence-001.yaml).
Bound records: [ic:ver-wall-time-evidence:001](../foundational/ic-ver-wall-time-evidence-001.yaml),
[fa:ver-wall-time-evidence:001](../foundational/fa-ver-wall-time-evidence-001.yaml),
[dh:ver-wall-time-evidence:001](../hypotheses/dh-ver-wall-time-evidence-001.yaml).

**Attack 1: `measurement-content-versus-execution-quality`** (null_discriminator; review outcome: `survived`).
Audit verdict: **invalid — carrier-only attack on already-supported content** (already survived; no strike).

The matching 4,456 ms and 11 ms endpoint examples establish quantitative claim content, while the
6,199 ms report with a 6,198 ms endpoint difference shows that content need not be infallible.
Copying a duration assertion without measuring again preserves the information object; the proposal
does not identify it with the execution quality. Evidence:
[so:sha256:f025dca6b8335e444986f450f43d7970deb3f4209456efce8a23a5e1c065d446](../observations/so-f025dca6b833.yaml);
[so:sha256:18fe73166f5b7932c1ef8a529b9e26f0975324ad5451673374ff5b24bbfeb91c](../observations/so-18fe73166f5b.yaml);
[so:sha256:9078a6ab88adf6e8ae99c1baafab237dd8c100a21fa8425143ca76a0f5bb6fcc](../observations/so-9078a6ab88ad.yaml).

**Attack 2: `measurement-scope-and-content`** (identity; review outcome: `survived`).
Audit verdict: **invalid — category error in the attack itself** (already survived; no strike).

The criterion includes target occurrence, scope, interval and measurement meaning rather than the
number or recurring lane label. The two differently bounded repo-sanity occurrences remain distinct,
as do whole-attempt and component claims. The endpoint discrepancy and not-run rows are expressly
preserved, so the countermodel attacks a grain collapse the card excludes. Evidence:
[so:sha256:1008941903be9f39b5f8ee44d50647d0b02ea0a1988e1712481a22f35e6a0465](../observations/so-1008941903be.yaml);
[so:sha256:9078a6ab88adf6e8ae99c1baafab237dd8c100a21fa8425143ca76a0f5bb6fcc](../observations/so-9078a6ab88ad.yaml);
[so:sha256:18fe73166f5b7932c1ef8a529b9e26f0975324ad5451673374ff5b24bbfeb91c](../observations/so-18fe73166f5b.yaml).

**Attack 3: `decision-class-not-required-by-cq`** (warrant; review outcome: `landed`).
Audit verdict: **demonstrated**.

CQ-025 directly binds a completed WorkUnitExecution's actualWallMs and usedCostEstimate, then reads
that immutable estimate's p50Ms/p95Ms. Distinct occurrence subjects and qualified values preserve
the repeated-lane and whole-attempt scope shown in the observations without an
ExecutionDurationAssertion individual. No cited consumer must address that assertion's independent
identity. This class is absent from the ratified taxonomy, and the proposal itself retains a
scoped-literal alternative. The attack concerns the new decision class's necessity, not the
already-supported measurement content or the mere existence of that rival. Evidence:
[so:sha256:1008941903be9f39b5f8ee44d50647d0b02ea0a1988e1712481a22f35e6a0465](../observations/so-1008941903be.yaml);
[so:sha256:f025dca6b8335e444986f450f43d7970deb3f4209456efce8a23a5e1c065d446](../observations/so-f025dca6b833.yaml);
[so:sha256:18fe73166f5b7932c1ef8a529b9e26f0975324ad5451673374ff5b24bbfeb91c](../observations/so-18fe73166f5b.yaml);
[CQ-025](../../../../../docs/competency-questions.yaml).

**FAIL does not collapse:** 1 landed attack remains demonstrated.

## Abstentions, collapsed FAILs and contested items

The four honest abstentions concern admission-token-charge repricing/assignment grain, reusable
projection specification versus input-bound application description, SeatRequest continuity across
handling and resubmission, and VerificationEpisode unity across retries and closure. None of the
bound observations supplies the named discriminating comparison. Existing typed fixture subjects,
numeric values, nonce strings and caller IDs do not decide these criteria. The precise missing
observations and proposal-specific grounds are recorded above and in the docket.

Collapsed FAILs: **none**. Contested attacks: **none**. Disengaged abstentions: **none**.

## Binding and output verification

A read-only recomputation matched all 26 target_sha256 values and all 26 framed chain_sha256 values.
Each chain includes the proposal, IdentityCard, FoundationalAnalysis, hypothesis, all
hypothesis-cited SO/PO files sorted by filename, and the virtual CQ digest member. The union
contains 133 bound observations; all additional observation IDs cited in the reviews resolve. The CQ
SHA-256 is e99e30cd801516d90fd344810867da60af9524273f46e735f3d3bed112283f64, matching the manifest's
e99e30cd8015 pin. These checks establish which bytes were audited; they do not turn a semantic
judgment into ratification.

Validation checks the docket's YAML, one-time coverage of every landed (proposal, review file,
attack index) tuple, exact correspondence between demonstrated attacks and revise recommendations,
full 79-row report coverage, all four abstention records, and the totals above. The audit creates
only this report and sitting-1-docket.yaml. Input records and the frozen HEAD are checked again
after writing. No proposal, review, seat record, manifest, packet lifecycle or Git state is written
by this lane.

