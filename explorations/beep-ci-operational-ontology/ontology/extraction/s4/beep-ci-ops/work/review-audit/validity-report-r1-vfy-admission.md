# Review-validity audit: auditor run 4 (beep-ci-ops), vfy admission cluster

Auditor scope: the five `otp-vfy-*` proposals whose slugs are `admission-charge`, `admission-work-kind`,
`merged-preview-work-kind`, `seat-grant` and `seat-request`, their one review each (round 1, no `-rN`
files exist), and each proposal's closure (DH, IC, FA and every SO/PO the hypothesis cites). This
report rules nothing; the sitting rules on it.

Paths below are relative to `explorations/beep-ci-operational-ontology/`: `P/` =
`ontology/extraction/s4/beep-ci-ops/work/proposals/`, `H/` = `.../work/hypotheses/`, `F/` =
`.../work/foundational/`, `SO/` = `.../work/observations/`, `PO/` = `.../work/prose-observations/`,
`CQ` = `ontology/docs/competency-questions.yaml`, `TAX` = `ontology/extraction/s5/TAXONOMY.yaml`,
`PRED` = `ontology/extraction/s6/PREDICATES.yaml`, `AB` = `research/run4-lanes/p3-seat-adversary-brief.md`,
`PR` = `.claude/skills/ontology-foundational-auditor/prompts/ontoclean-adversary.md` (repo root).

## Mechanical checks (performed by this audit)

- `target_sha256` of all five reviews equals the sha256 of the proposal bytes (5/5).
- `chain_sha256` recomputed with the framing the prompt and template state (`PR:46-50`; OTP+IC+FA+DH
  plus every cited SO/PO, sorted by file name, `name\nlen\n` + bytes, then `cq:<12hex>\n`): 5/5 match.
- CQ file sha256 12-hex is `e1ed9c0f65f5`, equal to the brief's pin (`AB:48`).
- Every `so:`/`po:` id in each review's `evidence` lies inside the target hypothesis's
  `observation_refs`. One out-of-closure stem (`so-0ddb10ca516c`) appears only in the seat-request
  review's `revision_requests`, which is the lawful channel (`AB:126-127`).
- No review lands an attack: all 23 attack rows are `survived`, all five verdicts are PASS, and every
  review lists exactly one still-viable rival (the gate flags each DISPUTED, `AB:95`).

## Summary

| Proposal | Review | Verdict | Landed attacks | Standard applied by this audit | PASS judgement | Missed attack (surface) |
| --- | --- | --- | --- | --- | --- | --- |
| `otp:vfy-admission-charge:001` | `P/otp-vfy-admission-charge-001.review.yaml` | PASS | none | Flagged reuse, "flag persists; no lift claimed" present: semantic match only (`AB:180-182`) | sound | none (a strict new-term null test would land, see calibration C3) |
| `otp:vfy-admission-work-kind:001` | `P/otp-vfy-admission-work-kind-001.review.yaml` | PASS | none | Unflagged ratified reuse: full standard on every surface | **unsound** | `listing-cq-warrant` on an untyped join node (warrant); see C1 |
| `otp:vfy-merged-preview-work-kind:001` | `P/otp-vfy-merged-preview-work-kind-001.review.yaml` | PASS | none | Unflagged ratified reuse: full standard on every surface | **unsound** | `discriminator-true-of-dto` (null_discriminator); support warrant derivative of C1 |
| `otp:vfy-seat-grant:001` | `P/otp-vfy-seat-grant-001.review.yaml` | PASS | none | Flagged reuse, no lift claimed: semantic match only | sound | none |
| `otp:vfy-seat-request:001` | `P/otp-vfy-seat-request-001.review.yaml` | PASS | none | Flagged reuse, no lift claimed: semantic match only | sound | none |

Landed attacks judged: 0 (none exist). PASSes judged: 5 (3 sound, 2 unsound).

Which standard: the task asks that exact reuses be tested on the null and identity surfaces as hard as
new terms unless the brief says otherwise. The brief says otherwise in one place only: a reuse of a
FLAGGED ratified term whose `open_issues` states "flag <name> persists; no lift claimed" is attacked on
semantic match only (`AB:180-182`). `TAX` records flags for `SeatGrant` (`TAX:124`), `SeatRequest`
(`TAX:144-145`) and `admissionChargeTokens` (`TAX:231-232`), and each of those proposals carries the
statement (`P/otp-vfy-seat-grant-001.yaml:50`, `P/otp-vfy-seat-request-001.yaml:50`,
`P/otp-vfy-admission-charge-001.yaml:46`). `AdmissionWorkKind` (`TAX:52-59`) and the literal-domain
member `merged-preview` (alias `MergedPreviewWork`, `TAX:292-300`) carry no flag, and neither proposal
states one, so the full standard applies to them. The brief's other reuse clause ("exact reuse ... is
not an optional new subclass: do not land that", `AB:180`) concerns taxonomy only.

## 1. `P/otp-vfy-admission-charge-001.review.yaml` (PASS) — sound

Standard: flagged reuse, semantic match only.

- Taxonomy (`review:19-27`, `reuse-semantic-match`): the bearers named are inside the ratified domain
  (`TAX:226`, `domain=SeatRequest | SeatGrant`): the withdrawn enqueue chain `SO/so-0d75ae7174ed.yaml`
  (weightTokens=5 on the enqueue row, record 79 of its excerpt) and the lease state record
  `SO/so-a8d270b5e19d.yaml` (weightTokens=5). Values 1, 3, 5 only across the closure (checked over all 54
  cited SOs). Correct reading.
- Identity (`review:28-36`): `SO/so-95b7d78a061f.yaml` carries one weightTokens=3 on its enqueue (record 73)
  and admit (record 74) rows under one nonce; the card leaves the criterion unresolved
  (`F/ic-vfy-admission-charge-001.yaml:9-19`) and the proposal claims no lift. Correct.
- Warrant (`review:37-44`): `CQ:249-256` binds `ciops:admissionChargeTokens` on `?grant` in the executable
  query, and `CQ:564-570` projects it on `?req`. The property is in the executable SPARQL of both CQs;
  `PRED:50-58` records it ratified with `used_by` CQ-010 and CQ-021. Correct.
- Null (`review:45-54`): the reviewer concedes the twin "a per-kind constant written at enqueue" fits the
  facts and survives the row on the flagged-reuse semantic-match test. That is the brief's standard as
  written. The ratified grain is itself `range_kind: recorded-value` (`TAX:225-227`), so the twin is not a
  grain mismatch. The proposal's own claims are grounded: equal charge 3 against `memoryPeakBytes`
  23492841472 (`SO/so-95b7d78a061f.yaml`, record 84) and 2393948160 (`SO/so-363f9b7f07dc.yaml`, record 175),
  about 9.8x.
- Rivals: the FA keeps four rivals viable (`F/fa-vfy-admission-charge-001.yaml:13-28`); the proposal names
  all four (`P/otp-vfy-admission-charge-001.yaml:53-57`); the review lists one (`review:55-59`). No unnamed
  rival is missed.

No missed attack lands under the brief's standard. Under a strict new-term null test,
`discriminator-true-of-dto` would land on the reviewer's own concession (`H/dh-vfy-admission-charge-001.yaml:82-87`
rejects only a counter "mirroring execution", while the null label is "no domain meaning"); see C3.

## 2. `P/otp-vfy-admission-work-kind-001.review.yaml` (PASS) — unsound

Standard: unflagged reuse; full standard.

- Taxonomy (`review:19-26`): the four members quoted in `PO/po-2f209664dde0.yaml` equal the ratified members
  (`TAX:283-323`). Correct, no parents.
- Identity (`review:28-35`): correct reading of `SO/so-a8d270b5e19d.yaml` (kind=merged-preview, stage=pre-push,
  proofTier=full on one lease).
- Null (`review:44-53`): the reviewer built the twin the hypothesis names, "a label the scheduler sorts on"
  (`H/dh-vfy-admission-work-kind-001.yaml:78-80`), and the facts do refute a sort-only label. It did not
  build the strongest pure-DTO twin the prompt asks for (`PR:33-38`): an enum used as a key into a constant
  per-kind weight table. That twin makes the discriminator ("the kind, not the priority, sets the capacity",
  `dh:81-83`) true. The reviewer saw this ("The code-list reading also fits") and deferred it to the named
  information-artifact rival. Whether a kind-keyed policy code counts as "implementation-only" or as the
  information-artifact rival is a calibration question (C2), not a demonstrated miss.
- **Warrant (`review:37-43`) — missed attack lands.** The row survives on "its sample answer binds an
  individual (ciops:FullProofWork). Without the domain the kind column has no member to bind." That reads
  the CQ's sample answer, not its executable query. The brief binds warrants to the executable `sparql`,
  never prose (`AB:49`), and asks whether "the QUERY, not only `required_classes`, binds the class"
  (`AB:143`; `PR:27-31`, "does it genuinely REQUIRE this term to be answerable").

  - Rule: `listing-cq-warrant` (class appears only in `required_classes`).
  - Counterexample (from `CQ:561-571` alone): seed `ex:r1 rdf:type ciops:SeatRequest ; ciops:requestedBy ex:a ;
    ciops:hasWorkKind "full-proof" ; ciops:hasPriorityClass "verify" ; ciops:admissionChargeTokens 3 ;
    ciops:enqueuedAt "..."^^xsd:dateTime`. The query returns one row with `?kind = "full-proof"` whether or not
    the ontology declares `ciops:AdmissionWorkKind` or types any node with it. The query text never mentions
    the class. It lives only in `required_classes` (`CQ:573`). The column needs `ciops:hasWorkKind`, which is
    not this term and is itself `parked-run-2` (`PRED:446-447`, `PRED:1204-1205`).
  - Proposal claim without evidence: `P/otp-vfy-admission-work-kind-001.yaml:48-50` concedes "without an
    rdf:type triple for it; the warrant rests on the bound node", then asserts "Without the term every
    queued-request row loses its work-kind column". On the executable query that is false. Under `AB:99-100`
    ("A claim the proposal makes without evidence is a FAIL") the warrant row should have landed. Admissible
    verdicts were FAIL, or at most INDETERMINATE with the sitting's C1 ruling as needed evidence. PASS was not
    admissible.
  - Rival-sensitivity: this judgement flips to sound if the sitting rules that `required_classes` alone can
    warrant a decision term (C1).

## 3. `P/otp-vfy-merged-preview-work-kind-001.review.yaml` (PASS) — unsound

Standard: unflagged reuse; full standard.

- Taxonomy (`review:19-26`, `tier-without-ratified-parent`): no tier, stage or parent edge is asserted. `TAX`
  has no `AssuranceTier` term. Correct.
- Identity (`review:27-34`): the homonym with the ProofStage literal is quoted in `PO/po-fd56d2b008d1.yaml`;
  the card individuates by domain membership, matching `TAX:300` `identity_basis: domain-membership`. Correct.
- `dormant-read-as-empty` (`review:53-59`): the proposal infers no stage activity
  (`P/otp-vfy-merged-preview-work-kind-001.yaml:56-58`). Correct.
- **Null (`review:44-52`) — missed attack lands.** The hypothesis's discriminator ends: the member "sets a
  capacity claim of its own, which would be false if the ticket value named no kind of requested work"
  (`H/dh-vfy-merged-preview-work-kind-001.yaml:84-86`). The analysis keeps "charge-and-scheduling code with
  no kind of work behind it" still viable (`F/fa-vfy-merged-preview-work-kind-001.yaml:16-17`). In that
  world the ticket value names no kind of work, yet every cited fact holds (charge 5 under verify in
  `SO/so-d99a3c53086c.yaml` record 340 and under publish in `SO/so-0d75ae7174ed.yaml` record 79, against 3
  for full-proof in `SO/so-95b7d78a061f.yaml` and `SO/so-363f9b7f07dc.yaml`). The reviewer states this
  itself ("Twin: the code-list reading ... satisfies the stated facts"). By `PR:33-38` that is the landing
  condition for `discriminator-true-of-dto`.

  The row survives only by "For an exact reuse of a ratified unflagged member the test is semantic match".
  The brief grants semantic-match-only to a FLAGGED term whose proposal states "flag persists; no lift
  claimed" (`AB:180-182`). This member is unflagged (`TAX:292-300`) and the proposal states no flag, so the
  reviewer applied an exemption the brief does not grant. The stated counterfactual is a claim without
  evidence that the closure's own FA contradicts: `AB:99-100` makes that a FAIL. The reviewer moved the
  repair into a non-blocking `revision_request` (`review:12-17`), which concedes the defect.
  - Rule: `discriminator-true-of-dto`. Counterexample: the FA's still-viable code reading reproduces all
    four cited charge facts while the value names no kind of work.
- Warrant (`review:35-42`, `support-chain`): the support license has a closure basis. `PO/po-2f209664dde0.yaml`
  quotes `MergedPreviewWork` "(supports: AdmissionWorkKind — merged-tree preview has a distinct scheduler
  weight)". But the support target `otp:vfy-admission-work-kind:001` stands as a decision term only on the
  untyped-node CQ-021 binding (section 2). If the sitting rules against that binding under C1, this member
  supports a term that is not a decision term, and `PR:29-31` ("name a real DECISION term") fails too. This
  part is derivative and is not counted as an independent miss.
- Rivals: the FA keeps three rivals viable: subkind, code and assurance tier
  (`F/fa-vfy-merged-preview-work-kind-001.yaml:13-21`). The proposal names all three (`P/...:48-50`). The
  review lists only the code rival (`review:60-64`), so the Queue H tier rival does not reach the sitting
  through this review's DISPUTED list (C4).

## 4. `P/otp-vfy-seat-grant-001.review.yaml` (PASS) — sound

Standard: flagged reuse, semantic match only.

- Taxonomy (`review:19-27`): admitted-to-released (`SO/so-95b7d78a061f.yaml`) and admitted-to-lease-evicted
  (`SO/so-860cff0d673e.yaml`, `SO/so-a9ed1352e2bc.yaml`) spans, plus the lease state record carrying
  weightTokens and an origin member. These are the two parameters `TAX:112-118` lists. Correct.
- Identity (`review:28-35`): `SO/so-860cff0d673e.yaml` carries enqueue (record 240), admit (246) and lease
  eviction (249) under one nonce; the card leaves the criterion open (`F/ic-vfy-seat-grant-001.yaml:9-14`).
  Correct.
- Warrant (`review:37-49`): `CQ:208` and `CQ:229-230` type `?grant`/`?g1`/`?g2` as `ciops:SeatGrant` in the
  executable query. The `seed-only-read-as-ratified` row is correct against `PRED:279-280` and `PRED:288-289`
  and the decoded-value note (`CQ:224`). The proposal drops CQ-010 with a correct reason
  (`P/otp-vfy-seat-grant-001.yaml:55-56`; `CQ:252` leaves `?grant` untyped).
- Null (`review:50-58`): the row-level fact holds. `lastHeartbeatAtMillis` sits on the eviction row (record
  249), not on the enqueue row (record 240), within the same record's excerpt. That is a within-record fact,
  not a population absence. The causal clause "revoked when the heartbeat stops"
  (`H/dh-vfy-seat-grant-001.yaml:48-49`) is unsupported, as the card concedes
  (`F/ic-vfy-seat-grant-001.yaml:90-92`). The proposal does not repeat it: its definition and
  `alternatives_rejected` (`P/...:11-15`, `P/...:47-48`) state only the end tag, reason and instants. Routing
  the clause to a non-blocking request (`review:12-18`) is right under the semantic-match standard.

No missed attack lands.

## 5. `P/otp-vfy-seat-request-001.review.yaml` (PASS) — sound

Standard: flagged reuse, semantic match only.

- Taxonomy (`review:20-28`): the enqueue rows carry kind, priority, weightTokens, enqueuedAtMillis and an
  origin member, matching `TAX:131-139`. The reviewer's non-blocking request (`review:12-19`) rests on the
  record-0 stanza `so-0ddb10ca516c`, an admitted row with request members and no enqueue row. That stanza is
  outside this hypothesis's closure (`H/dh-vfy-seat-request-001.yaml` cites it nowhere, although its
  description mentions "the record-0 stanza"). The reviewer named it by stem in `revision_requests` only,
  which `AB:126-127` prescribes. Inside the closure every one of the 52 cited chains opens with a v3
  `admission-enqueued` row, so no in-closure counterexample to "opened by an admission-enqueued row" exists.
  Non-blocking treatment is correct.
- Identity (`review:29-36`): `SO/so-8528aeede357.yaml` and `SO/so-40e26d2f0672.yaml` share checkout and branch
  with distinct nonces and attemptIds. The demand-continuity rival is named
  (`P/otp-vfy-seat-request-001.yaml:62-63`) and the flag persists. Correct.
- Warrant (`review:37-42`): `CQ:565` and `CQ:613` type `?req` as `ciops:SeatRequest`. Correct.
- Null (`review:43-57`): `SO/so-29a5ac8607a2.yaml` ends a queued ticket with `admission-ticket-evicted`,
  `reason=queued-submitter-death`, distinct from the lease eviction on `SO/so-860cff0d673e.yaml`. This is
  semantic match at the queued-ticket grain (`CQ:575`). The capture-provenance row is correct: the card
  treats owner references as non-joins (`F/ic-vfy-seat-request-001.yaml:80-83`).
- Rivals: four still viable in the FA (`F/fa-vfy-seat-request-001.yaml:13-25`), all named in the proposal
  (`P/...:59-63`). The review lists one.

No missed attack lands.

## Calibration (patterns a sitting should rule on)

- **C1. Untyped join node as a decision-term warrant.** `CQ:561-573` binds `?kind` only through
  `ciops:hasWorkKind` (parked-run-2) and names `AdmissionWorkKind` only in `required_classes`. The same
  pattern underlies the class's ratified status (`TAX:52-59`) and the member's support chain. Rule whether
  `required_classes` alone warrants a decision term, or whether the executable query must type or bind the
  class (`AB:49`, `AB:143`). The admission-work-kind and merged-preview judgements above depend on this.
  Seat-grant and seat-request type their referents in the query and are unaffected. Admission-charge binds
  the property directly and is unaffected.
- **C2. Strawman null vs strongest DTO twin.** The work-kind hypothesis states its null as "a label the
  scheduler sorts on". The strongest twin, an enum keyed into a constant per-kind weight table, is what the
  CQ-021 notes describe as the deployed carrier (`CQ:575`, "per admissionTokenWeight"). The reviewer let the
  named information-artifact rival absorb it. Rule whether a kind-keyed policy code counts as
  "implementation-only" (then the null is not rejected) or as the information-artifact rival (then the
  steward choice carries it).
- **C3. Reach of the flagged-reuse exemption.** `AB:180-182` restricts attacks on flagged no-lift reuses to
  semantic match. The admission-charge reviewer conceded that a DTO twin fits the discriminator and passed on
  that exemption. The merged-preview reviewer extended the same exemption to an UNFLAGGED member. Rule
  whether the exemption covers the null surface of flagged reuses (this audit read it as covering every
  surface), and confirm it does not reach unflagged reuses.
- **C4. Steward-choice rivals versus an analysed `explicitly_deferred` verdict.** All five FAs are
  `explicitly_deferred` with two to four still-viable rivals. Each proposal names them as steward choices
  (the brief's channel, `AB:182-183`). Each review PASSes and lists one rival, so the gate marks each
  DISPUTED (`AB:95`). Two points need a ruling. (a) Is PASS, rather than INDETERMINATE, the right verdict
  when the analysis itself defers the category? The brief reserves INDETERMINATE for an attack the closure
  cannot settle, and here no attack was left unsettled; the category is deferred by design. (b) Must a review
  list every still-viable FA rival? The merged-preview review omits the Queue H assurance-tier rival, so the
  sitting does not see it through the DISPUTED channel.
- **C5. Unresolved rigidity on reuses of ratified rigid sortals.** `SeatRequest`, `SeatGrant` and
  `AdmissionWorkKind` are ratified `rigidity: rigid` (`TAX:55`, `TAX:110`, `TAX:128`). Their run-4 reuse
  proposals carry `rigidity: unresolved` and keep an anti-rigid phase or code rival viable. The shared rule
  "unresolved rigidity on a core sortal in a proposal SUBMITTED FOR RATIFICATION" is BLOCK at step 8
  (`.claude/skills/_shared/ontoclean-rules.yaml:19-20`). Only the work-kind reviewer raised this, and only as
  a non-blocking note (`P/otp-vfy-admission-work-kind-001.review.yaml:12-16`). Rule whether ratifying such a
  reuse confirms the prior rigid row, reopens it (a widening the brief's lift/narrowing classes do not
  cover), or trips the step-8 block.
- **C6. Quarantined lease as evidence.** `SO/so-a8d270b5e19d.yaml` comes from a `quarantine/state.properties`
  file. The CQ file says deployed "quarantined" means corrupt-record paths (`CQ:623`). Four of the five
  reviews lean on it for taxonomy or identity rows. The rows do not depend on it alone, but the sitting may
  want a rule on the weight of quarantined records.

## Sitting questions

1. Does a CQ whose executable query reaches the referent only as an untyped object of a parked predicate,
   with the class named only in `required_classes`, warrant that class as a decision term (CQ-021 /
   `AdmissionWorkKind`)?
2. If not, does `otp:vfy-merged-preview-work-kind:001` keep a valid support warrant through the literal-domains
   "supports: AdmissionWorkKind" quote, or does it fall with its support target?
3. Does the flagged-reuse semantic-match exemption (`AB:180-182`) cover the null surface, and was its
   extension to the unflagged `merged-preview` member a misapplication that voids that PASS?
4. Is a kind-keyed constant weight table "implementation-only" for the purposes of rejecting the null on the
   work-kind and merged-preview chains?
5. When the FA verdict is `explicitly_deferred` with several viable category rivals, is PASS-plus-DISPUTED
   the intended outcome, and must the review carry every viable rival, including the Queue H tier rival?
6. Does ratifying a reuse proposal with `rigidity: unresolved` over a ratified `rigid` row trip the step-8
   BLOCK, reopen the row, or leave the prior ratification untouched?
