# Run-4 sitting-3 ratification docket (beep-ci-ops)

Run `orun-2026-10-06T15:51:01Z`, pin `71c7357adc`. This docket is advisory. The orchestrator rules
sitting 3 under the operator autonomy charter (P3 Ruling 2) and writes every ratification in its own
words. Nothing below is a steward utterance or a draft of one. The machine-readable twin is
`ratification-docket.yaml` beside this file.

## Gate and inputs

The pre-scribe gate (`work/review-audit/gate-log-final-pre-scribe.txt`, sha256 `7ca37ec36f7d`, 156
lines) ends `ARTIFACTS VALID — GATE PASSED (flags above go to the steward)`. It prints the unresolved
fraction (54/198 = 27%, carried rows excluded), 138 FLAGGED carried-row re-parks (the call (c) noise;
the steward judges each one truthful) and 16 FLAGGED proposal lines, quoted per proposal below. The
gate's mechanical OntoClean block covers only kind, subkind, role and phase. No proposal claims one
of those, so the step-8 core-sortal question below is the sitting's to rule.

Numbering: ratifications continue at `rat-071` and rejections at `rej-001` (Ruling 13). The live
`governance/ratifications/` and `work/rejections/` directories are empty. This lane did not open the
shelters, so the orchestrator re-runs the maximum before scribing. The slots below are suggestions.

Every proposal's latest review targets the file's current sha256. The five sitting mirrors are
byte-equal to their decision-log sections.

## Summary

| Slot | Proposal | Term | Kind | Status | Latest review | Index rows | Recommended arm |
| --- | --- | --- | --- | --- | --- | --- | --- |
| rat-071 | `otp:chg-change-landing:001` | OperationalChangeEvent | class, new | analyzed | r2 PASS (after r1 FAIL) | 45 proposed | accept, flags retained |
| rat-072 | `otp:vfy-verification-attempt:001` | VerificationAttempt | class, reuse rat-033 | analyzed | r2 PASS | 7 mapped | accept, flags retained (with the shared-IRI ruling) |
| rat-073 | `otp:vfy-lane-execution:001` | WorkUnitExecution | class, new | analyzed | r3 PASS (after r2 FAIL) | 2 proposed | accept, flags retained (with the step-8 ruling) |
| rat-074 | `otp:vfy-committed-failure:001` | CommittedFailure | class, new | analyzed | r1 PASS | 1 proposed | accept, flags retained |
| rat-075 | `otp:vfy-seat-request:001` | SeatRequest | class, reuse rat-061 | explicitly deferred | r1 PASS | 45 mapped | accept, flags retained (with the shared-IRI ruling) |
| rat-076 | `otp:vfy-seat-grant:001` | SeatGrant | class, reuse rat-066 | explicitly deferred | r1 PASS | 13 mapped | accept, flags retained (with the shared-IRI ruling) |
| rat-077 | `otp:vfy-admission-charge:001` | admissionChargeTokens | data property, reuse rat-053 | explicitly deferred | r1 PASS | 0 | accept, flags retained |
| rat-078 | `otp:vfy-verification-lane:001` | VerificationLane | class, reuse rat-039 | explicitly deferred | r1 PASS | 31 mapped | accept, flags retained (with three rulings) |

The table is orientation only. Each proposal is presented on its own below, and each needs its own
decision.

## Proposals

### 1. `otp:chg-change-landing:001` — OperationalChangeEvent (suggested rat-071)

- **sha256**: `8164d4c90e0a82696649f379c4c8add11b90d6afdca085e5be83feed7e994157`
- **Term**: class, new, `https://oip.law/ontology/ci-ops#OperationalChangeEvent`.
- **Warrant**: CQ-016 (should_have). The query types `?iv a ciops:OperationalChangeEvent`.
- **Foundational status**: analyzed. Category event (gufo:Event, no subtype, because instant versus
  interval is unresolved). The blinded seat also says event.
- **OntoClean**: rigidity rigid; identity unresolved; dependence relational.
- **Review history**: r1 FAIL on `c771b3345865`, which landed `record-property-as-differentia`. r2
  PASS on the current bytes; every attack survived, including the re-attack of the failed rule. One
  optional request: tie the differentia to what the change set specifies, not to an achieved effect.
- **Gate flags**: `DISPUTED — the review lists still-viable rivals`.
- **Viable rivals and discriminators**:
  - The landing is the apply or go-live occurrence for rows titled "applied" or "live". Decided by
    one such change's merge time and apply time given separately, with the zone of the titled date
    (#1141: "live 2026-09-15" against landedAt 2026-09-16T00:18:38Z).
  - Supersession grain (#1019 and #1022; #870 and #929). Decided by a record saying whether the
    earlier alteration still holds after the later row, or naming it a revision.
  - Category: the curated ledger row (an information object). Decided by a row corrected while the
    landing stays the same.
  - Category: the change artifact, PR or merge commit (an information object). Decided by merge and
    apply times given separately.
  - The blinded seat diverges without a gate flag. It keeps a process (rollout) reading viable and
    grades the ledger-row reading not viable.
- **Queue duty**: the class side of the Queue G pair. `ciops:landedAt` stays seed-only (its chain
  `dh:chg-landing-instant:001` keeps its null unrejected), so CQ-016 returns no row on run-4
  vocabulary (Ruling 23).
- **Index rows**: closes 45 rows as `proposed`, which is all of the chg batch (the 44 ledger rows and
  KPI law section 2).
- **Step-8 OntoClean**: does not fire, because rigidity is resolved. It is a leaf event class and not
  a core sortal in the rule's sense.
- **Recommended arm**: accept, flags retained. It converged after one landed FAIL. The type pattern
  satisfies Ruling 20 for the class alone, and the class gives P4 a typed subject.
- **Flags to retain**: identity unresolved; temporality unresolved; the four rivals; CQ-016 answered
  for its subject only; adoption not claimed; the evidence is observational seed data.
- **Rejected alternative**: hold until a landedAt chain survives. This would turn 45 rows unresolved
  and leave P4 on seed rows for the class too, although the class's warrant does not depend on the
  property.
- **Tracked follow-ups**: the optional r2 wording; the "later P0 Ruling 3" wording (Ruling 23).

### 2. `otp:vfy-verification-attempt:001` — VerificationAttempt (suggested rat-072)

- **sha256**: `e269f12b346de662e553e1002ce5e5d9eb884b860138f9c4381acdde1e59fdc6`
- **Term**: class, exact reuse of rat-033. The ratified row is rigid and has no flags field in
  TAXONOMY. It is a Queue A recorded-value deferral (Ruling 21).
- **Warrant**: support only, toward `otp:vfy-committed-failure:001` and `otp:vfy-lane-execution:001`.
  Ruling 20 applies because CQ-022 joins by `inAttempt` without typing the attempt.
- **Foundational status**: analyzed. Category event; the blinded seat also says event.
- **OntoClean**: rigidity unresolved; identity supplies; dependence relational.
- **Review history**: r1 PASS on `2986e1d5b2c4`. Sitting 1 struck the audit's null attack (Ruling
  19), and the Ruling 20 row moved the term to the support arm. r2 PASS on the current bytes. Two
  non-blocking requests, both repeated from r1: the hypothesis still individuates by attemptId, and
  the "flag persists" line has no TAXONOMY flags field behind it.
- **Gate flags**: `DISPUTED — the review lists still-viable rivals`.
- **Viable rivals**:
  - An alias of the seat request. Decided by an attempt-started row and an admission chain sharing
    one attemptId, or two chains under one attemptId.
  - A process counted while running. Decided by a record of an attempt before its verdict.
  - The blinded seat grades the alias not viable and rates the class rigid.
- **Queue duty**: the exact phrase "flag VerificationAttempt persists; no lift claimed" is present.
  The deferral lives in the Queue A docket, not in TAXONOMY.
- **Index rows**: closes 7 rows as `mapped`.
- **Step-8 OntoClean**: this is a core sortal for the CQ-022 cluster, because both decision terms
  individuate within an attempt. The rigidity doubt comes only from the alias rival, against a
  ratified rigid row. Ruling 23 sends exactly this case here. The rule blocks unless the sitting rules
  that a reuse ratification affirms the denotation under the ratified "rigid" and keeps the card's
  doubt as a named deferral.
- **Recommended arm**: accept, flags retained, together with that explicit shared-IRI ruling.
- **Flags to retain**: the Queue A flag phrase; run-4 rigidity unresolved under the alias rival; the
  process rival; lane parthood and the tie to a request not shown.
- **Rejected alternative**: reject as an unresolved-rigidity core sortal. This would strip the
  CQ-022 anchor and re-disposition 7 rows over a doubt the ratified row already settles.
- **Tracked follow-ups**: the hypothesis wording; where the deferral is recorded.

### 3. `otp:vfy-lane-execution:001` — WorkUnitExecution (suggested rat-073)

- **sha256**: `fc32f78288d5b68abae6f18b7b95327e058bbe34777abe922ac88964365a24fc`
- **Term**: class, new. The spec side is the ratified WorkUnitSpecification.
- **Warrant**: CQ-022 (must_have), CQ-024 and CQ-025 (should_have). All three type `?exec`.
- **Foundational status**: analyzed. Category event; the blinded seat also says event.
- **OntoClean**: rigidity unresolved; identity supplies; dependence relational.
- **Review history**:
  - r1 PASS on `dea4a5863697`. Sitting 1 then landed a missed identity attack (Ruling 19).
  - r2 FAIL on `5e095484e0cd`, which landed `definition-excludes-warrant-rows`.
  - r3 PASS on the current bytes. The revision log covers `unity-contradicted-by-closure`,
    `lost-rival` and `definition-excludes-warrant-rows`. Three non-blocking requests remain: the card
    wording "ended by a verdict"; attemptId missing from the fact/shadow agreement; the whole-attempt
    grain for CQ-025.
- **Gate flags**: `DISPUTED — the review lists still-viable rivals`.
- **Viable rivals**:
  - A process counted while running. Decided by a running-state record written before the verdict.
  - The blinded seat diverges without a gate flag: it keeps "a temporal part of the attempt without
    individuality" viable.
- **Queue duty**: none beyond its CQs. `hasExecutionState`, `RunningExecution`, `hasCancelClass`,
  `hasCachePosture`, `actualWallMs`, `usedCostEstimate` and `inAttempt` are not grounded.
- **Index rows**: closes 2 rows as `proposed`.
- **Step-8 OntoClean**: this is the hardest call. It supplies identity and leaves rigidity
  unresolved.
  - For non-core: it is a leaf, and the doubt (absorption into a wrapper, relabelling) is the open
    wrapper-parthood question, not a doubt about membership.
  - For core: it is the execution-side sortal of the ruled split, and three CQs type it.
  - The sitting must rule non-core with reasons, or the arm becomes revise.
- **Recommended arm**: accept, flags retained, together with the explicit non-core ruling.
- **Flags to retain**: rigidity; the process rival; wrapper parthood (peer counting double-counts
  CQ-025 wall time); the rerun edge; the two-referent rival rests on one joined pair; the naming
  grain (lane invocations only).
- **Rejected alternative**: revise until a wrapper entry with instants or a running-state record
  exists. The loop is closed, the open points are deferrals, and CQ-022 needs a typed execution.

### 4. `otp:vfy-committed-failure:001` — CommittedFailure (suggested rat-074)

- **sha256**: `929755435984178b52a49b35365ec02d7c6e05316ce1c0d91cda3ed23eeaff27`
- **Term**: class, new.
- **Warrant**: CQ-022 (must_have). The query types the harness-bound failure.
- **Foundational status**: analyzed. Category event. The blinded seat also says event, but its
  verdict is explicitly deferred.
- **OntoClean**: rigidity unresolved; identity supplies; dependence relational.
- **Review history**: r1 PASS. Two non-blocking wording requests: "earlier steps at status passed"
  is an example, not a condition; `committed=false` is not evidence.
- **Gate flags**: `DISPUTED — the review lists still-viable rivals`.
- **Viable rivals**:
  - The obsoletion point CQ-022 names. Decided by a record of the failing step's exit instant
    together with executions of the same attempt still running at that instant.
  - The blinded seat diverges: it also keeps a role of the failed step execution and a failed phase
    of the attempt viable, and says the attempt supplies identity.
- **Queue duty**: none. It is a member of the CQ-022 cluster; `inAttempt` is parked-run-2 and
  unproposed.
- **Index rows**: closes 1 row (so-ca8b3f90e57c) as `proposed`.
- **Step-8 OntoClean**: not a core sortal. It is a leaf event, nothing takes identity from it, and
  its criterion rests on the pair (attempt, step). The rigidity doubt (a retried step, a revised
  failedStepId) is the obsoletion-point rival's question.
- **Recommended arm**: accept, flags retained.
- **Flags to retain**: rigidity; the obsoletion-point rival; no instant claimed; the termination
  counterexample; one cited observation (a shape, never a count); `inAttempt` unproposed.
- **Rejected alternative**: defer until the obsoletion point is separated. This removes the subject
  CQ-022 hangs on, with nothing to repair.

### 5. `otp:vfy-seat-request:001` — SeatRequest (suggested rat-075)

- **sha256**: `e0d884c7f13365044be197ff9ecff94b27906dc3b6c195655bc393d4bff6ed22`
- **Term**: class, exact reuse of rat-061. The ratified row is rigid and flagged (demand-versus-
  description grain; handling and resubmission continuity).
- **Warrant**: CQ-021 and CQ-023 (both must_have). Both type `?req`.
- **Foundational status**: explicitly deferred. Category unresolved; the blinded seat says relator.
- **OntoClean**: rigidity, identity and dependence all unresolved.
- **Review history**: r1 PASS. One non-blocking request: v1-journal tickets leave no enqueue row,
  but the definition says a request is opened by one.
- **Gate flags**:
  - `DISPUTED — the review lists still-viable rivals`
  - `DISPUTED — alternative seat says 'relator', primary says 'unresolved'; steward chooses`
  - `submits FLAGGED (explicitly_deferred): An admission chain that separates the readings: …` (the
    full needed-evidence text is in the YAML)
- **Viable rivals**:
  - Two-relator split. Decided by one request admitted into two grants, or a lease nonce that
    differs from its ticket's.
  - Waiting phase of one engagement. Decided by re-queue or re-admission under one nonce, or an
    admitted row that differs from its enqueue row.
  - An alias of the attempt. Decided by an attempt end row joined by attemptId.
  - One demand across resubmission. Decided by a shared demand id or a resubmission marker.
- **Queue duty**: the exact phrase "flag SeatRequest persists; no lift claimed" is present.
- **Index rows**: closes 45 rows as `mapped`.
- **Step-8 OntoClean**: this is a core sortal of the admission cluster. Its run-4 rigidity is open
  between rigid and anti-rigid, against a ratified rigid row. The rule blocks unless the sitting rules
  that the ratified rigid value governs and the phase reading is a new named deferral.
- **Recommended arm**: accept, flags retained, ruled jointly with SeatGrant under the shared-IRI
  ruling.
- **Flags to retain**: the flag phrase and the rat-061 deferrals; the relator-versus-phase category;
  the attempt and demand rivals; dependence unresolved; the v1-journal definition scope.
- **Rejected alternative**: reject the reuse. This would re-disposition 45 rows and erase run 4's
  record of re-examining the flag, while the ratified row stands anyway.

### 6. `otp:vfy-seat-grant:001` — SeatGrant (suggested rat-076)

- **sha256**: `050395fdde0cb4423ffb205a05413358a39a0b68b5cde54807d270dff13a8cbd`
- **Term**: class, exact reuse of rat-066. The ratified row is rigid and flagged (account-copy
  identity; effective authorization continuity).
- **Warrant**: CQ-008 and CQ-009 (both must_have). Both type the grant. CQ-010 is correctly not
  cited, because it types nothing.
- **Foundational status**: explicitly deferred. Category unresolved; the blinded seat says relator.
- **OntoClean**: rigidity unresolved; identity unresolved; dependence relational.
- **Review history**: r1 PASS. One non-blocking request about the hypothesis's causal heartbeat
  wording.
- **Gate flags**:
  - `DISPUTED — the review lists still-viable rivals`
  - `DISPUTED — alternative seat says 'relator', primary says 'unresolved'; steward chooses`
  - `submits FLAGGED (explicitly_deferred): The same discriminating chain as the seat-request pair: …`
- **Viable rivals**:
  - A rigid relator founded at admission.
  - The held phase of one engagement.
  - Both are decided by the same chain as the seat-request pair, plus a renewal or transfer that
    keeps the admission instant.
- **Queue duty**: the exact phrase "flag SeatGrant persists; no lift claimed" is present.
- **Index rows**: closes 13 rows as `mapped`.
- **Step-8 OntoClean**: the same as SeatRequest (a core sortal), and it must get the same ruling,
  because one chain decides both.
- **Recommended arm**: accept, flags retained, jointly with SeatRequest.
- **Flags to retain**: the flag phrase and the rat-066 deferrals; the relator-versus-phase category;
  the CQ-009 legacy arm unshown (`hasCheckout` and `hasCoordinationProtocol` seed-only; decoded-value
  law, call (t)); no pool dependence shown.
- **Rejected alternative**: reject or hold for the discriminating chain. CQ-009's re-scope was built
  over this class.
- **Tracked follow-up**: the bound bytes still name the withdrawn `otp:vfy-checkout:001` (Ruling 23).

### 7. `otp:vfy-admission-charge:001` — admissionChargeTokens (suggested rat-077)

- **sha256**: `e79c5e12a08c3f131fe3ed1e7fb9aeea2839925539c540c5093344370e5e1696`
- **Term**: data property, exact reuse of rat-053. The ratified row's rigidity is unresolved, and the
  row is flagged (repricing, assertion replacement, request/grant continuity, pre-admission capacity).
- **Warrant**: CQ-010 and CQ-021 (both must_have). Both use the property.
- **Foundational status**: explicitly deferred. Category unresolved; the blinded seat says quality.
- **OntoClean**: all three values unresolved.
- **Review history**: r1 PASS. One non-blocking request: restate the null discriminator.
- **Gate flags**:
  - `DISPUTED — the review lists still-viable rivals`
  - `DISPUTED — alternative seat says 'quality', primary says 'unresolved'; steward chooses`
  - `submits FLAGGED (explicitly_deferred): The category stays unresolved among four viable readings. …`
- **Viable rivals**:
  - A quality individual, or a quality value only. Decided by repricing between the enqueue and
    admit rows.
  - A relational claim mode. Decided by a charge with no pool, or one restated against a second pool.
  - An attribute of the work kind. Decided by one kind carrying two weights.
- **Queue duty**: the exact phrase "flag admissionChargeTokens persists; no lift claimed" is present.
- **Index rows**: closes none. Its cited observations are mapped to the seat pair.
- **Step-8 OntoClean**: does not apply. A data property is not a sortal, and there is no rigidity
  conflict with rat-053.
- **Recommended arm**: accept, flags retained. Call (y) requires the reuse proposal while the chain
  survives.
- **Rejected alternative**: revise to drop the open-issues line naming the withdrawn
  `otp:vfy-admission-work-kind:001`. Ruling 27 and the W3 receipt already rule that line prose, not
  an edge. The sitting should say so, since the ratification binds those bytes.
- **Flags to retain**: the flag phrase and the rat-053 deferrals; the category among four readings;
  `capacityAtAdmissionTokens` not grounded.

### 8. `otp:vfy-verification-lane:001` — VerificationLane (suggested rat-078)

- **sha256**: `23c86967b5d5e0b55788227b61870bde3818cc03adfbb38d78ad95c5b19ac7ff`
- **Term**: class, exact reuse of rat-039. The ratified row is rigid, with identity card
  `ic:pa-turbo-task-specification:001`. It has no flag and is not a Queue A deferral, so it took the
  full standard (Ruling 21).
- **Warrant**: CQ-001 (must_have) types `?lane`. CQ-006 is cited, but its query binds `?lane` only
  as the object of `requiresLane`/`dischargesObligation` and names no lane individual. Under
  Ruling 20 it warrants nothing. Sitting 1 did not examine this citation, and the reviewer flagged it
  as non-blocking. The warrant stands on CQ-001.
- **Foundational status**: explicitly deferred. Category unresolved; the blinded seat says
  information object.
- **OntoClean**: all three values unresolved.
- **Review history**: r1 PASS.
- **Gate flags**:
  - `DISPUTED — the review lists still-viable rivals`
  - `DISPUTED — alternative seat says 'information_object', primary says 'unresolved'; steward chooses`
  - `submits FLAGGED (explicitly_deferred): To settle the identity criterion: …`
- **Viable rivals**:
  - Process type versus specification. Decided by a deployed lane definition with properties of its
    own.
  - Identity by name lineage versus command content. Decided by one laneId with two command digests,
    or the reverse.
- **Queue duty**: no flag phrase, correctly. Accepting adds the row's first deferrals, which Ruling
  14 allows because it forbids only removal.
- **Index rows**: closes 31 rows as `mapped`.
- **Step-8 OntoClean**: this is a core sortal on the lane side. Its run-4 rigidity is unresolved
  against an unflagged rigid row. It follows the same shared-IRI path as the seat pair, plus a grain
  ruling against the ratified turbo-task-specification card.
- **Recommended arm**: accept, flags retained, with three explicit rulings: CQ-006 does not count
  toward warrant; the ratified rigid value governs; the new deferrals become the row's first flag.
- **Rejected alternative**: revise to drop CQ-006 from the bytes. The sitting can rule the citation
  void without reopening review.
- **Flags to retain**: identity; category; lane kind (one laneClass value; `hasLaneKind`
  ungrounded); warrant on CQ-001 only.

## Cluster questions the sitting rules together

1. **CQ-022 trio** (CommittedFailure, WorkUnitExecution, VerificationAttempt). The two decision
   terms individuate within an attempt, so the attempt's acceptance closes their definitions.
   `inAttempt` is parked-run-2 and unproposed, `hasExecutionState` and `RunningExecution` are
   parked, and `hasCancelClass` is seed-only. CQ-022 therefore returns no row on run-4 vocabulary
   even with all three accepted; state that as the CQ-022 outcome.
2. **One step-8 test for the trio**. All three carry identity "supplies" with rigidity unresolved.
   Rule them by one consistent test (leaf or anchor, derived or supplied criterion, reuse or new).
3. **Seat cluster** (SeatRequest, SeatGrant, admissionChargeTokens). One chain decides the
   relator-versus-phase split, and the charge's bearer turns on it. Take one shared-IRI position for
   all three, and say whether the SeatRequest flag could ever lift singly (`schedulesSeatRequest`
   sits in the joint ordering cluster).
4. **Shared-IRI grain** (VerificationAttempt, SeatRequest, SeatGrant, VerificationLane). Rule once
   whether a reuse ratification binds the run-4 card's OntoClean values, or affirms the denotation
   under the ratified values with the card's doubt kept as a flag. The step-8 BLOCK for all four
   depends on this answer.
5. **CQ-016 with landedAt unproposed**. Ruling 23 asks whether the class ratifies alone. If it does,
   CQ-016 stays half answered. If it does not, 45 index rows re-disposition.
6. **Stale references in bound bytes**. The admission-charge proposal names the withdrawn
   admission-work-kind proposal, and the seat-grant proposal names the withdrawn checkout proposal.
   Rule both superseded by Rulings 27 and 18.
7. **Queue H prior refutation**. Call (ab)(4) reserved its answer for the sitting that rules a tier
   proposal, but none exists. Record where that answer goes.
8. **Consequence of any reject or revise**. The affected index rows (45, 45, 31, 13, 7, 2, 1 or 0)
   re-disposition before the step-9 post-scribe gate. A rejection takes `rej-001` and a rejection
   ledger entry.

## P4 hand-off facts (Ruling 17)

- **Tier outcome**: Queue H stays open; no pair rules tier against stage (call (ag)).
  `dh:vfy-assurance-tier:001` is null-standing. It needs a deployed AssuranceTierId member, a
  proofTier-to-level mapping, or a lane-obligation set that differs between levels. The
  merged-preview tier reading did not survive (call (ad)). Every cited record carries
  `proofTier=full`, and merged preview is dormant in the capture window. The fourth AssuranceTier
  member stays blocked on the parked AssuranceTierId domain (Ruling 10). 13 live index rows carry
  these needs.
- **Change-event ratification state**: at docket time, OperationalChangeEvent is proposed,
  gate-passed and r2 PASS, and is recommended for accept with flags retained. `ciops:landedAt` is
  seed-only and unproposed. The final state is sitting 3's ruling.
- **W1 freshness at the pin**: Pass 5 re-ran the W1 lever query over the window since `8b7392fe00`,
  up to the run base `50b79e470b` (ten PRs). Two rows survived (`iv-1427-push-first-publish`,
  `iv-1422-spot-pool-drop-r6a`), eight were excluded and none was contested. The ledger has 44 rows,
  sha256 `f520b302424f`, at pin `71c7357adc`. All 44 are transcribed and closed by the change-landing
  proposal.
- **Lane-plan terms' intake outcome**: the eleven provisional terms entered intake through the lpl
  batch (25 observations, 12 hypotheses). None survived denotation, so there is no analysis pair and
  no proposal. 23 observations are unresolved with the missing lane-order CQ named, and 2 are
  irrelevant. The terms stay provisional.
- **Tier derivation for change-event rows**: rows gain no structured tier member in this phase.
  Derivation for W8 is a P4 hand-off (Ruling 10). #1427 partitions the local series only, and W8
  states the hosted population shift as a confounder at that instant (call (r)). The change-landing
  proposal declines subclassing by `mechanismChanged` and proposes no tier member.

## The run-3 precedent, weighed

Run 3 did three things. It ratified converged flagged submissions as drafted, with each deferral
retained as a flag. It ruled shared-IRI grain conflicts explicitly. It withdrew with named evidence
what could not stand. Run 4 has already done the withdrawals: six proposals under Rulings 18, 26
and 27. All eight standing proposals converged, and every open point names its discriminator, so
accept with flags retained is recommended for each on its own merits.

The precedent is not copied wholesale:

- The CQ-022 trio needs an explicit step-8 core-sortal ruling, with WorkUnitExecution as the hard
  case.
- Four reuses need the shared-IRI rigidity ruling.
- VerificationLane gains its first flag and needs a Ruling 20 reading of CQ-006.
- Two proposals bind stale references to withdrawn proposals.

## Self-check

8 proposal files are on disk and 8 are in this docket, each exactly once. Each sha256 above was
recomputed from its file and matches. Each latest review's `target_sha256` equals the file digest.
The docket contains no verbatim decisions, no home paths and no user names.
