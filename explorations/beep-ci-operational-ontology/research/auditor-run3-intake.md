# Auditor run 3 intake docket

Assembled 2026-09-09 for the `ontology-run3` pin, from base `85cc86d1f3`.
Run 2 is complete and ratified. This docket applies the run-3 corpora design
rulings 1–16, Stage B rulings 17–21, residue rulings 22–23, and the final
run-3 launch entry in `DECISIONS.md`. S5/S6/S7 remain completed inputs.
Queue placement is an instruction to review evidence; it is not ratification
or a claim that every named evidence requirement has been met.

Historical artifacts were read with `git show HEAD:<path>` before the pin.
The uncommitted launch entry and `research/run3-lanes/handoff-2026-09-09.md`
are the current orchestration inputs. Older implementation reports describe
the state at their writing; their pending-publication wording does not
supersede the launch entry.

Path abbreviations are packet-relative unless explicitly repo-relative:

- `ONT` = `ontology/extraction/s4/beep-ci-ops`.
- `ARCH` = `ontology/extraction/s4/archives/beep-ci-ops`.
- `INDEX` = `ONT/runs/orun-2026-09-03T02:46:18Z.index.yaml`.
- `CORPUS` = `ONT/corpus`.
- Run-2 sittings move from `ONT/work/sittings/` to
  `ARCH/orun-2026-09-03T02:46:18Z.work/sittings/` under lane A's rotation.
- Run-2 ratifications move from `ONT/governance/ratifications/` to
  `ARCH/orun-2026-09-03T02:46:18Z.governance/ratifications/` under that rotation.
  Lane A's report establishes completion; the old paths remain readable at
  the pre-pin HEAD. No historical decision or evidence bytes change here.
  Lane A's current friction receipt reports that rat-032, rat-033, rat-037
  and rat-039 must remain in the live root because their accepted authority
  is not projected into S5/S6. Rotation is therefore not yet a clean pin;
  this lane neither moves them nor edits those status files.

## Prior-run chain (validator-enforced)

The run manifest must carry exactly:

```yaml
first_run: false
prior_index: runs/orun-2026-09-03T02:46:18Z.index.yaml
prior_index_sha256_12: a207a106de68
```

The digest was recomputed from the committed index. Its 387 rows comprise
68 `unresolved`, 44 `mapped`, 7 `proposed`, and 268 `irrelevant`.
All 68 unresolved observation IDs appear once in Queue C below. The manifest
requires each to be re-opened with new evidence or explicitly accounted for
through `carried_from_prior`; verbatim silent re-parking is rejected.
Ruling-6 and Ruling-17 parks need their ruling and still-missing evidence in
the new disposition, not a copied old status.

Run 2 adopted 21 ratifications, `rat-032` through `rat-052`: 15 clean accepts
and 6 flagged reuses. Sitting 2 retired 146 of the 149 carried run-1 rows;
C1/C2/C3 below are the three still open. Sitting 3 deferred the full ordering
cluster, including the previously passing `hasStep` and `stepIndex`, so no
relation could ratify with its `ScheduleStep` endpoint withdrawn. The
run-2 unresolved-fraction waiver was 56% of non-irrelevant live rows; it is
historical authority, not an automatic waiver for run 3.

## Queue by source

### Queue A: ordering cluster (ratifies together or re-parks together)

Queue A contains **13 provisional terms (3 classes and 10 properties), plus
1 namespace re-proposal**. This is the complete emission-v2 term set, not the
older shorthand of three classes plus six properties. Ratified
`ciops:ScheduleProposal` and `ciops:SeatRequest` are reused endpoints.

Sources are `research/run3-lanes/emission-v2-report.md` §1, the actual
repo-relative fixture `apps/labs/ciops/test/fixtures/emission-v2.ttl`, the
emission sites in `apps/labs/ciops/src/projection/Turtle.ts`, and
`ontology/docs/s7-projection-contract.md` §§2–3.5. Lane A transcribes the
fixture, emission sites, contract and replay evidence, and re-transcribes
the three run-2 ordering captures. Prose observations must remain verbatim;
a missing historical quote is reported rather than replaced by a paraphrase.
Lane A's current friction receipt reports that the first two contract
quotes no longer occur verbatim after emission v2. Their archived records
remain historical evidence through the prior-run chain; this docket does
not claim they have been re-emitted at the new pin. The third capture is the
unchanged S7 implementation-report correction. Lane A owns the transcriber
verdict and reports any missing quote as a pin limitation.

In this table every unqualified term is in `ciops-prov:`. Fixture line
numbers and emitter line numbers refer to the pre-pin committed files.

| Term | Evidence and meaning | Fixture lines | Turtle.ts lines |
| --- | --- | --- | --- |
| `ScheduleStep` | Typed proposal-relative admitted member; contract §§3.1, 3.3, 3.5. The content/token boundary remains a sitting question. | 30, 34 | 85 |
| `hasStep` | Proposal membership for the two admitted steps; no deferred-tail step. Contract §§2, 3.5 and both original contract captures. | 22–23 | 81 |
| `stepIndex` | Integer ordinals 0 and 1. Ruling 14 fixes the base; `ORDER BY` remains unchanged. Contract §3.3. | 29, 33 | 84 |
| `schedulesSeatRequest` | Step targets a typed SeatRequest. The run-2 correction capture grounds the distinction from WorkUnitSpecification; contract §3.5. | 28, 32 | 83 |
| `hasScopeTag` | Step literal `"admission"` with `xsd:string`, replacing the punned literal `hasScope`. Contract §§3.3, 3.5. | 27, 31 | 82 |
| `VerificationEpisode` | Typed bounded verification occurrence, with caller-owned key and corpus-scoped replay identity. Ruling 4 and contract §3.5 ground the fresh proposal. | 19 | 98 |
| `hasCurrentProposal` | Typed episode points to its current proposal snapshot. Replacement, rather than RDF append, maintains currency; contract §3.5. | 18 | 99 |
| `AdmissionProjectionSpecification` | Typed governing specification with authority/version/applicability in contract §3.5; consolidates the pa/pb/pc run-2 contract chains. | 37 | 101 |
| `hasProjectionSpecification` | Proposal-to-specification edge at the subject CQ-020 joins; contract §3.5. | 21 | 100 |
| `policyDigest` | Specification serializes the supplied policy digest as a string; emission does not certify or recompute it. Contract §3.5. | 36 | 102 |
| `journalPrefixDigest` | Supplied string; replay uses a full-journal digest plus event-index boundary locator, not a separate prefix-byte hash. Contract §3.5. | 35 | 103 |
| `scheduledUnitRef` | All three requests carry nonce evidence, including the deferred member; positional IRIs do not establish nonce-based identity. Ruling 15 and contract §3.5. | 24–26 | 91 |
| `defersSeatRequest` | Proposal-to-tail membership; the deferred request has no step or ordinal. Requires its own support warrant within the cluster. Contract §3.5. | 20 | 96 |
| Namespace re-proposal | `https://oip.law/ontology/ci-ops-prov#`, prefix `ciops-prov:`. Ruling 15 and the provisional-closure record travel with the cluster; S8 IRI syntax stays deferred. | 2, 17 | Provisional emission block |

The three historical captures are under
`ARCH/orun-2026-09-03T02:46:18Z.observations/prose-observations/`:

- `po-736ad92a1de7.yaml`: original S7 contract lines 43–48, provisional
  ordering vocabulary. Its old `schedulesWorkUnit` and literal `hasScope`
  wording records history; the v2 sites supply the corrected current forms.
- `po-35a69c5bcbf7.yaml`: original contract lines 74–77, `ScheduleStep` and
  `ScheduleProposal` fields, including ordering and input digests.
- `po-d1f555913267.yaml`: S7 implementation report lines 113–120, the
  SeatRequest/WorkUnitSpecification split and `schedulesSeatRequest` rename.

Sitting-3 Ruling 1 is represented in `INDEX` by the `hasStep` rows at
lines 2112–2123 and `stepIndex` rows beginning at lines 1081 and 1639.
The amendment-gated pa/pb/pc contract concessions begin at lines 1010,
1443/1545, and 1924/2023; the SeatRequest-target concession begins at 2124.
Their **10 full row IDs occur only in Queue C(ii)**, which is their accounting
location. PR #963 landed the CQ-020 amendment; it requires the governing
specification and emitted SeatRequest ordering. This removes the recorded
wording obstacle, while the identity and warrant judgments still belong to
the sitting. The recorded `stepIndex` `none` versus `quality` dispute must be
answered in proposal text; a zero-based fixture is not a category ruling.

### Queue B: flagged provenance items rat-047 through rat-052

Six accepted reuse mappings retain their flags. Each entry quotes the
ratification's complete `verbatim_decision` and the evidence requirement
recorded in the run-2 YAML ratification docket, with YAML folding normalized.
The latter preserves the specific duty behind the short ratification flag.
Corpus routing below names where seats can test a claim, not an assertion
that a capture supplies an authoritative identity contract.

#### rat-047: `otp:jv-merge-readiness-assessment:001`

> Accept the merge-readiness VerificationEvidence reuse, provenance identity deferred to run 3 as flagged.

Flagged evidence requirement from `ratification-docket.yaml`:

> Authoritative generation, issuance, custody, copy, correction, and claim-realization provenance across heterogeneous VerificationEvidence instances is required to decide content versus carrier identity.

Run-3 source: `CORPUS/run3-fleet/attempts/` embedded verdicts and
`verdicts/` projections supply merge-readiness records; checkout context can
join `run3-checkout-identity/bindings/`. These support record-level review.
The issuance/custody/content-versus-carrier duty is **RE-PARKED TO RUN 4**
under Ruling 17. Zero captured proof ledgers cannot establish claim issuance.

#### rat-048: `otp:pa-projection-limitation-report:001`

> Accept the limitation-report VerificationResultArtifact reuse, result-provenance identity deferred as flagged.

Flagged evidence requirement from `ratification-docket.yaml`:

> Authoritative result formation, issuance, producer, custody, copy, correction, and revocation provenance across heterogeneous VerificationResultArtifact records is required to choose content, record-token, or carrier-lineage identity. A separate limitation-report term additionally requires independent issuance and a Must/Should CQ that consumes it apart from the containing result.

Run-3 source: `run3-fleet` attempt/embedded-verdict and verdict projections
are candidate result-record evidence; the S7 contract and replay report
provide limitation context. No independent limitation-report issuance is
claimed from these records. The issuance/custody/result-identity duty is
**RE-PARKED TO RUN 4** under Ruling 17. A separate limitation term still needs
its named decision CQ and independent issuance.

#### rat-049: `otp:pa-yeet-verification-workflow:001`

> Accept the yeet-workflow VerificationPlanSpecification reuse, plan-identity contract deferred as flagged.

Flagged evidence requirement from `ratification-docket.yaml`:

> An authoritative identity contract across heterogeneous verification plans must define content, contextual-copy, replacement, and revision identity. A separate Yeet specialization additionally requires governed authority and version lineage deciding whether cheap-gates, review-fix, and monitor are one plan or coordinated subplans, plus a Must/Should CQ requiring it.

Run-3 source: `run3-fleet` attempts, embedded verdicts and verdict
projections, with timestamped `run3-checkout-identity` bindings for checkout
and revision context. This is the Stage A plan-record review route, not an
issuance-ledger item. Captured plan/lane content alone does not decide
contextual copies, replacement or version continuity; the authoritative
plan-identity contract remains a visible obligation for the sitting.

#### rat-050: `otp:pb-admission-priority-class:001`

> Accept AdmissionPriorityClass, registry lineage deferred to run 3 as flagged.

Flagged evidence requirement from `ratification-docket.yaml`:

> Run-3 evidence must identify the authoritative priority-class registry, version and revision lineage, membership-change rules, and whether planner versions share one governed domain or issue semantically distinct copies.

Run-3 source: `run3-fleet` v3 admission rows and `run3b-fleet` journal/
queue/lease projections; `run3b-synthetic` supplies explicitly synthetic
priority-bearing contender records. Source-pinned schema citations and S6
POLICY's priority enumeration are registry evidence, not a runtime registry.
Membership-change rules and shared-domain versus copied-domain lineage remain
to be judged; the nonce and owner surrogate do not decide them. This is not
re-parked by the proof-ledger issuance ruling.

#### rat-051: `otp:pb-planned-lane-status:001`

> Accept the planned-lane-status VerificationResultArtifact reuse, result-provenance identity deferred as flagged.

Flagged evidence requirement from `ratification-docket.yaml`:

> Authoritative result formation, issuance, producer, custody, copy, correction, and revocation provenance across heterogeneous VerificationResultArtifact records is required to choose content, record-token, or carrier-lineage identity. A separate planned-lane-status term additionally requires retained issuance, parent-attempt and execution joins, and a Must/Should CQ that consumes it separately.

Run-3 source: `run3-fleet` attempts with embedded verdicts and verdict
projections supply the planned-lane record and available parent-attempt
joins. Stage B attempts, including `run3b-synthetic` termination joins, can
add termination context but do not issue verification results. The
issuance/custody/result-identity duty is **RE-PARKED TO RUN 4** under Ruling 17.
The separate planned-lane-status term still needs retained issuance and its
own CQ warrant.

#### rat-052: `otp:pb-verification-evidence-receipt:001`

> Accept the evidence-receipt VerificationEvidence reuse, claim-formation provenance deferred as flagged.

Flagged evidence requirement from `ratification-docket.yaml`:

> Run-3 must provide authoritative claim-formation and realization rules plus issuance, producer, custody, copy, retention, correction, and revocation provenance across heterogeneous VerificationEvidence records.

Run-3 source: `run3-fleet` attempt and embedded-verdict projections can
supply bounded receipt context; checkout bindings constrain its bearer.
Neither `run3b-fleet` v3 eviction rows nor `run3b-synthetic` termination
records provide proof claim-formation rules. The claim-formation and
issuance/custody duty is **RE-PARKED TO RUN 4** under Ruling 17.

Queue B totals: **6 flags**, all retaining explicit review obligations;
**4 issuance/custody duties re-parked to run 4** (047, 048, 051, 052), and
**2 plan/registry duties on the run-3 review route** (049, 050). Attempts and
embedded verdicts may discharge narrower record joins without discharging
the broader identity flags. Ruling 17's named evidence is
`goals/time-to-certainty/PLAN.md` C2 (repo-relative, line 84 at the pin):
"not yet wired into any lane", plus `run3b-fleet/MANIFEST.yaml.proof_ledger`
with zero ledgers observed. Issuance waits for that packet's C4 writer.

### Queue C: all 68 unresolved index rows

The four accounting buckets are disjoint. A row with several
`needed_evidence` clauses appears once, and all its clauses remain visible.
Counts are observation rows, not proposals, terms, captured events or
ratifications. The full ID census is copied mechanically from `INDEX`;
headings supply the run-3 routing decision.

| Bucket | Rows | Meaning |
| --- | ---: | --- |
| C(i) | 12 | Corpus-addressable duties: C1 1, C2/C3 2, admission lifecycle 2, lease lifecycle 3, failure-signature rider 3, cache-plan rider 1. Evidence can be partial or absent as specified below. |
| C(ii) | 10 | Ordering/CQ-020 amendment-gated rows, routed to Queue A. |
| C(iii) | 46 | Ruling-6 parks: 22 rows in 11 remaining scope-surprise families, plus 24 rows in 8 other contract/identity/CQ-dependent groups. |
| C(iv) | 0 | No unclassified remainder. |
| Total | 68 | Every unresolved observation ID exactly once. |

#### C(i): corpus-addressable duties (12 rows)

`run3-checkout-identity` has 107 timestamped checkout bindings. The
fleet-name token is capture-local; origin is repo-grain, git-common-dir is
linkage, and Turbo cache topology is the CQ-015 mount evidence. Transfer
still requires the matching epoch and task hash. No rename rigidity follows
from one binding capture.

`run3-fleet` v3 rows and `run3b-fleet` loss-population chains supply contention
facts. The latter manifest reports 21 wins, 23 withdrawals, 5 lease
evictions, 2 ticket evictions, 3 in-flight and 112 pre-v3 chains. These are
retained root/nonce chains, not a closed fleet census. `run3b-synthetic`
adds one win, one withdrawal, one dead-lease eviction and one dead-ticket
eviction, produced by the actual test writer and labeled synthetic.
Its `termination_join` receipt joins both dead-owner cases to attempt
journals. `lastHeartbeatAtMillis` bounds an observation; eviction time is
reap/claim time, never inferred death time. Distinct roots and captures must
not be silently merged.

**C1, fleet-checkout-identity (1 row).** Route to `run3-checkout-identity/bindings/` and its properties projections under Ruling 5; the binding meets the requested capture form without declaring stable identity across rename.

Needed evidence retained from `INDEX`:

> sitting-2 ruling (fleet-checkout-identity): Run-2 path partitioning and checkoutRoot fields do not establish a stable checkout identity or its cache-mount relations, and no current proposal slug or label names Checkout.

- `so:sha256:0d096342f5ba116307ca177adcbc3fc775b860ae0e5fd62dfd4d090d86c660a3`

**C2/C3, grant-resource-contention-and-paths (2 rows).** Route to the two fleet admission pins and `run3b-synthetic`. Require root/nonce, resource/path, acquisition/release and outcome joins from the same provenance chain. Worktree overlap alone still does not establish resource contention; a proof-lock-specific gap cannot be filled by assuming admission and lock ownership are identical.

Needed evidence retained from `INDEX`:

> sitting-2 ruling (grant-resource-contention-and-paths): Run-2 overlappingPaths fields describe worktree overlap, not a grant-to-resource contention relation, and no current proposal slug or label names that relation.

- `so:sha256:b42503da37767cc741db6196fbf13e019bdc59f71166ad4d95318966ca7ae123`
- `po:sha256:5fa0d40013f2f1bace37c166a14058909069e91de0f63b823bd0921c40f68278`

**jv-admission-lifecycle with memory-peak rider (1 row).** Route the lifecycle clause to v3 events and synthetic termination joins. The independent memory-measurement clause remains parked under Ruling 6. This mixed row is counted here once, not again in the memory-only group below. A distinct lifecycle still needs its named decision CQ.

Needed evidence retained from `INDEX`:

> otp:jv-admission-lifecycle:001 concession requires one authoritative lifecycle join linking enqueue, grant, release/cancellation, and causal-continuity identifiers for the same request, plus a Must/Should decision CQ that needs that lifecycle. dh:jv-memory-peak-measurement:001 requires an authoritative measurement join identifying each value's resource-using occurrence and process boundary, sampling method and interval, metric and unit, provenance, and whether peakRssKb and memoryPeakBytes belong to one measurement family.

- `so:sha256:c627961a8fcde9dca01027cbf052494763b5e6895805c1c0c50d8bf51ba3a7bb`

**jv-admission-lifecycle (1 row).** Route to fleet v3 events plus the synthetic scenario. Retained enqueue/grant/terminal boundaries are evidence for review, not an automatic process-continuity or separate-CQ ruling.

Needed evidence retained from `INDEX`:

> otp:jv-admission-lifecycle:001 concession requires one authoritative lifecycle join linking enqueue, grant, release/cancellation, and causal-continuity identifiers for the same request, plus a Must/Should decision CQ that needs that lifecycle.

- `so:sha256:d94bf0420d3457158959e6188c50d5949dc4fae4a48d07e7077f8c81df36fcb6`

**pa-admission-lease-lifecycle (3 rows).** Route to v3 fleet events, live-state/claim projections where present and synthetic termination joins. Require the actual grant identifier and carrier continuity; a terminal heartbeat value does not provide a complete heartbeat-rewrite history or the separate lifecycle CQ.

Needed evidence retained from `INDEX`:

> otp:pa-admission-lease-lifecycle:001 concession requires a joined grant identifier across lease creation, heartbeat rewrite, release/eviction, ledger decrement, and carrier lineage, plus a CQ requiring a lifecycle distinct from SeatGrant.

- `po:sha256:3aadb9c8ae061d71b2e8386d9b8af518d49df5a66abaa0bb0391783833a6eef4`
- `po:sha256:51fa8a9b8fcef0856134c3599ef68eabe588532203230c5b0ac8c892da47c95a`
- `po:sha256:56d67898f9daaa0ff3c1fb34ff05745d9a1f94cf2703726f7721d1f586f89e5f`

**pa-failure-signature, promoted rider (3 rows).** Route to `run3-fleet` verdict and embedded-verdict properties, selected with their failed-step reference. Its manifest records 1,902 structured occurrences; the optional attempt join and governed semantics must be checked per record. Rat-032 already ratified the signature classification, not every occurrence join.

Needed evidence retained from `INDEX`:

> dh:pa-failure-signature:001 requires an observed classified failure occurrence joining failureKind to the failed verification step under governed, versioned component semantics.

- `po:sha256:2d69bdb38dd2c7618a64b60834a6993abe999b6776d721aef8b6eb947c9b2e91`
- `po:sha256:4ce41ce65957b0594e01c672972fb68722ee30c3df62444b2d323fe6d70e07cf`
- `po:sha256:4ec767a335e920a2a80204127a6c3146cded1e5eb3d748b11a87dfc4579fc735`

**pa-cache-plan-resolution, promoted rider (1 row).** Route to `run3-fleet` verdict projections for the governed resolver/execution join. The committed `rider_evidence` receipt is `absent`, with zero structured occurrences. Keep the rider visible but unresolved unless the sitting obtains the named evidence through an authorized route. `cacheStatus` or a cache flag is insufficient; no new capture or runtime change is authorized by this docket.

Needed evidence retained from `INDEX`:

> dh:pa-cache-plan-resolution:001 requires the governed resolver result domain and one Turbo execution joined to the resolved cache posture that was actually applied.

- `po:sha256:30be9d42308395a759ea42b1706c47b14bf2d995ff5d90eb85161cef24e27b61`

#### C(ii): CQ-020 amendment-gated ordering rows (10 rows)

PR #963's amended CQ now asks for SeatRequest order, a governing projection
specification and step scope tags. The deployed emission-v2 fixture and
contract are the new evidence for all rows below, routed to Queue A.
The quoted index requests preserve the old obligation wording; references
to a future wording amendment describe the run-2 state.

**sitting-3 hasStep (2 rows).** Re-open against the amended executable query and the complete ordering cluster; no member ratifies separately.

Needed evidence retained from `INDEX`:

> sitting-3 ruling: hasStep defers to run 3 — its range binds ScheduleStep, which is withdrawn and unratified; the full ordering cluster ratifies together after the CQ-020 wording amendment (WorkUnit -> SeatRequest ordering).

- `po:sha256:736ad92a1de7991caa17d905c310e2dac02d5a4d9b7cd3b709adfcabd690e4cc`
- `po:sha256:35a69c5bcbf7493cc0aa7f248d138d65f2d5c8beff49e80308ef85b43a0f559d`

**sitting-3 stepIndex (2 rows).** Re-open against the amended executable query and the complete ordering cluster; no member ratifies separately.

Needed evidence retained from `INDEX`:

> sitting-3 ruling: stepIndex defers to run 3 — its subject binds ScheduleStep, which is withdrawn and unratified; the full ordering cluster ratifies together after the CQ-020 wording amendment (WorkUnit -> SeatRequest ordering).

- `po:sha256:14e01baa9a4fa23873722680039d098e43c3e0f315d5f6805159154577794e06`
- `po:sha256:959a603a7bc88415101c1c6e9073034271081d03a55dd625f763898feb579ea2`

**pa-projection-contract (1 row).** Re-open against the amended executable query and the complete ordering cluster; no member ratifies separately.

Needed evidence retained from `INDEX`:

> otp:pa-projection-contract:001 concession requires the CQ-020 wording amendment (WorkUnit -> SeatRequest ordering) queued for the post-run CQ revision, with an executable query that requires the governing projection specification and the emitted SeatRequest-ordering facts it constrains.

- `po:sha256:0121af7b661484de9197ede12df6eaa5c69240214339b7ea6844a4f09901fea8`

**pb-schedule-projection-specification (2 rows).** Re-open against the amended executable query and the complete ordering cluster; no member ratifies separately.

Needed evidence retained from `INDEX`:

> otp:pb-schedule-projection-specification:001 concession requires the CQ-020 wording amendment (WorkUnit -> SeatRequest ordering) queued for the post-run CQ revision, with an executable query that requires the governing projection specification and the emitted SeatRequest-ordering facts it constrains.

- `po:sha256:6fa9ae087c8d411c0218a0491a20989f722773cb08d8b57d733514a58cc86742`
- `po:sha256:88f09e0224cf8cc48710903fe1e017b9369bc5dada8def6024d42f2841f9a654`

**pc-projection-contract (2 rows).** Re-open against the amended executable query and the complete ordering cluster; no member ratifies separately.

Needed evidence retained from `INDEX`:

> otp:pc-projection-contract:001 concession requires the CQ-020 wording amendment (WorkUnit -> SeatRequest ordering) queued for the post-run CQ revision, with an executable query that requires the governing projection specification and the emitted SeatRequest-ordering facts it constrains.

- `po:sha256:d9e1c6941fe61eb8e8a4f7e40853d6090190ec18523931c3af4551bb2b880c76`
- `po:sha256:ed86c2d18b12ff797604eac97a917b36527e390ce417fce35ac583fd829b2709`

**ov-schedules-seat-request (1 row).** Re-open against the amended executable query and the complete ordering cluster; no member ratifies separately.

Needed evidence retained from `INDEX`:

> otp:ov-schedules-seat-request:001 concession requires a revised or new Must/Should CQ whose executable query requires ScheduleStep-to-SeatRequest targeting, together with emitted projection facts carrying that relation.

- `po:sha256:d1f555913267743bc009bfd030c3bafd841e6f7baa081d7a1ecc0704fc2b2d2d`

#### C(iii): Ruling-6 parked families (46 rows)

The design brief's approximate "13 families, about 25 rows" includes the two
promoted riders. Against the exact index, those 13 families cover **26
unique rows** before promotion: **4 rider rows** now in C(i) and **22 rows
in 11 remaining families** below. A further memory-measurement duty shares
one of C(i)'s lifecycle rows; counting every family membership would produce
27 memberships, not 27 unique rows. This reconciles the approximation
without losing the mixed row's parked memory obligation.

| Remaining scope-surprise family | Rows counted here | Named evidence still required |
| --- | ---: | --- |
| `jv-base-freshness` | 3 | Versioned branch/base assessment contract and recomputation provenance. |
| `jv-greptile-score` | 2 | Governed scale/version, assessed subject, score provenance and decision consequence. |
| `jv-verification-step-execution` | 1 | Passed-step parent-attempt join, execution identity and actual start/end boundaries, distinct from not-run. |
| `jv-memory-peak-measurement` | 1 | Resource/process boundary, sampling method/interval, metric/unit and measurement-family join; the additional mixed duty stays counted in C(i). |
| `pa-elapsed-ms-field` | 1 | Observed measured extent with start/end boundaries and provenance. |
| `pa-qa-evidence-workflow` | 1 | Record/extract/judge evidence joined to an in-scope lane, frozen tree, epoch and assurance obligation. |
| `pb-topological-package-report` | 6 | Report/algorithm/edge contract, producing graph and consuming verification decision. |
| `pb-docgen-affected-scope` | 1 | Base/head/dirty/member pin, extension-versus-rule authority and specialization CQ. |
| `pb-affected-task-input-mode` | 2 | Normative selection/failure behavior, observed selected set and trusting decision. |
| `pb-failure-attribution-category` | 1 | Necessary conditions, precedence and assessment/revision provenance. |
| `pb-yeet-proof-tier` | 3 | Planner governance/version lineage plus a selector-consuming decision CQ. |
| Subtotal | 22 | Eleven families after the two promotions. |

Full index requirements and row IDs follow. Each remains parked under
Ruling 6; no new TS observation, passed-step instrumentation, authority
contract or CQ amendment is added by this lane.

**jv-base-freshness (3 rows).** Re-park with the following named requirement under Ruling 6; the planned captures do not supply the required contract and observed case.

Needed evidence retained from `INDEX`:

> dh:jv-base-freshness:001 requires an authoritative, versioned branch-freshness contract identifying the assessed branch and base, defining merge-base, behind-count, and overlap semantics, and recording the assessment provenance and decision use across recomputation.

- `so:sha256:0a7f99ebe45f22164f484b539becf4d1d57384861db25b0c065fc67cca2574a7`
- `so:sha256:a4fa5b4f6b8142d813d5867e01c92a245a9a7ee7d64b8841a3e27a068c88e764`
- `so:sha256:c1e2fd7731b1efe855f70c75df8e7dd0bd99853668c551eca8fb80593a621d06`

**jv-greptile-score (2 rows).** Re-park with the following named requirement under Ruling 6; the planned captures do not supply the required contract and observed case.

Needed evidence retained from `INDEX`:

> dh:jv-greptile-score:001 requires authoritative scale semantics and version, the assessed review subject, score provenance, and an observed decision or assurance consequence for the recorded 5/5 value.

- `so:sha256:12f0a017acb17063246f77ebb5c128271f9df67ea7bc1666268052f2d58873d1`
- `so:sha256:258d88bf5d120ca46af4e7964a5c3a5674c5c4984b67c0f84fe8f706e979c3f6`

**jv-verification-step-execution (1 row).** Re-park with the following named requirement under Ruling 6; the planned captures do not supply the required contract and observed case.

Needed evidence retained from `INDEX`:

> otp:jv-verification-step-execution:001 concession requires a passed-step journal record with an authoritative parent-attempt identifier, actual start and end boundaries, execution identity, and an explicit distinction from not-run status rows.

- `so:sha256:3a8b51a1acc8602b1a583147d6d5e7e253481237fbf5806c9b13833698bc9090`

**jv-memory-peak-measurement (1 row).** Re-park with the following named requirement under Ruling 6; the planned captures do not supply the required contract and observed case.

Needed evidence retained from `INDEX`:

> dh:jv-memory-peak-measurement:001 requires an authoritative measurement join identifying each value's resource-using occurrence and process boundary, sampling method and interval, metric and unit, provenance, and whether peakRssKb and memoryPeakBytes belong to one measurement family.

- `so:sha256:78cf821b0771a1c60ef1f80746484a8da1df72bcf2b1eaa9ebed337144e5a245`

**pa-elapsed-ms-field (1 row).** Re-park with the following named requirement under Ruling 6; the planned captures do not supply the required contract and observed case.

Needed evidence retained from `INDEX`:

> dh:pa-elapsed-ms-field:001 requires an observed verdict record that identifies whether elapsedMs measures a WorkUnit execution, verification attempt, or broader command, with start and end boundaries and provenance.

- `po:sha256:2092736911a0c68e96ae8d9638b00ec4b6992b4da0677f325e4fd420fb41b2a7`

**pa-qa-evidence-workflow (1 row).** Re-park with the following named requirement under Ruling 6; the planned captures do not supply the required contract and observed case.

Needed evidence retained from `INDEX`:

> dh:pa-qa-evidence-workflow:001 requires a provenance-bearing evidence record joining record, extract, and judge stages to an in-scope Yeet or CI verification lane, frozen tree and epoch, and assurance obligation.

- `po:sha256:3bf3cf7f37f4e3e046efb12751c4b9650dd3a2a16a0c99a1ec17563fa551048a`

**pb-topological-package-report (6 rows).** Re-park with the following named requirement under Ruling 6; the planned captures do not supply the required contract and observed case.

Needed evidence retained from `INDEX`:

> dh:pb-topological-package-report:001 requires a report contract defining the numeric positions, ordering algorithm, and dependency edges, plus producing-graph provenance and evidence that an operational verification decision consumes the report.

- `po:sha256:5a59d414027abf00522737e1d86c7976c6837e7dcf88eb47112cc39709b2be1d`
- `po:sha256:62ae30cfc28b391c7bf4a87534abeba849a8ca2ebd5f8ebe72cb5af81dcc50eb`
- `po:sha256:64463ef1e1f2b77cb50713f8194bb055d35d02288f465e6902e337f9fc5f5edf`
- `po:sha256:6e598d379ffd2f0565176b337833e4eedf0293941fa87936078ee572e63748a9`
- `po:sha256:89165acdfec28c3a8692c411aead416ca1fd5f13333c0ea5c748e92aeab0cb98`
- `po:sha256:90fa083c4887641658c0239762b509fd6c9bacc6f14cf29ee392ce08714572ff`

**pb-docgen-affected-scope (1 row).** Re-park with the following named requirement under Ruling 6; the planned captures do not supply the required contract and observed case.

Needed evidence retained from `INDEX`:

> otp:pb-docgen-affected-scope:001 concession requires a run artifact pinning base, head, dirty snapshot and selected members, a scope contract choosing extension versus selection rule, and a Must/Should CQ requiring the specialization. otp:pb-docgen-affected-scope:002 concession requires independently versioned selection-rule authority, a pinned extension demonstrating its application, a contract distinguishing rule from result, and a CQ requiring the specification.

- `po:sha256:795d76d79fdc3ad235d204aee98c96f70dcdb10704c927558f31012749553995`

**pb-affected-task-input-mode (2 rows).** Re-park with the following named requirement under Ruling 6; the planned captures do not supply the required contract and observed case.

Needed evidence retained from `INDEX`:

> dh:pb-affected-task-input-mode:001 requires a normative affected-selection contract defining how task inputs alter selection, fail-open or fail-closed behavior, an observed selected set, and the operational decision that trusts it.

- `po:sha256:9cbd50f3655b7ae7102a1be9bfcfe939528b3eaebd0dc33257408365f9402062`
- `po:sha256:a1f8202d5ff295e75dd7ad3f50f9454dad4bc2d53677e5936a6a0812250c5e43`

**pb-failure-attribution-category (1 row).** Re-park with the following named requirement under Ruling 6; the planned captures do not supply the required contract and observed case.

Needed evidence retained from `INDEX`:

> dh:pb-failure-attribution-category:001 requires normative definitions stating each member's necessary conditions, overlap or precedence rules, and whether an attribution record captures the assessed change, baseline, environment, provenance, and revision history.

- `po:sha256:a0460c0e2b60f310cb30b9c03ea0aa2e487e02aadaa0450c56bb04cff6b5c8c9`

**pb-yeet-proof-tier (3 rows).** Re-park with the following named requirement under Ruling 6; the planned captures do not supply the required contract and observed case.

Needed evidence retained from `INDEX`:

> otp:pb-yeet-proof-tier:001 concession requires planner governance and version lineage deciding one shared scheme versus copied domains or plan-borne classifications, plus a Must/Should CQ requiring the selector.

- `po:sha256:8b0e7ebacbadd3d0a21df787d0070763c9151c438e5ad68ef69454c6bea0aca1`
- `po:sha256:8d123d2b803018949aa079849fafabb4d38fbde7e7f77a5515d448cdc0a9f195`
- `po:sha256:922212cafdb03daef5fb111352d661cfda30e1e9f3d3e8c3e6f45a19c6a82a50`

The other **24 parked rows** form eight accounting groups. Some groups
contain several proposal duties on the same row. These are the additional
identity, governance and new-CQ riders Ruling 6 also excludes; capturing a
related value does not license a new helper class.

| Additional parked group | Rows | Missing evidence |
| --- | ---: | --- |
| `jv-actual-wall-duration` with `jv-lane-diagnostic-comparison` | 2 | Reified-measurement/comparison decision CQs, joined executions and issuance/custody. |
| `pa-projection-conformance-evidence` | 3 | Independently governed/versioned package and suite, replay/environment/result/custody chain, separate CQs. |
| `pa-workspace-package` | 7 | Package continuity policy across rename/move/version/fork/delete-recreate. |
| `pa-admission-capacity-expression` | 2 | Capacity contract and computed-value-to-admission join; Ruling 9 did not add capacity stamps. |
| `pb-admission-capacity-state` | 5 | AdmissionSnapshot-consuming CQ, capture act/scope and immediate pre-grant correlation. |
| `pb-origin-block-grace-window` | 1 | Deployed threshold/consequence rule and governed blocked case. |
| `pc-heartbeat-suspicion-policy` | 2 | Stale-heartbeat case and policy separating suspicion from termination authority. |
| `pc-origin-blocked-timestamp` | 2 | Persisted ticket/time/unit joined to originBusy and starvation-policy use, with revision provenance. |
| Subtotal | 24 | Separate from the 22 rows above. |

**jv-actual-wall-duration (1 row).** Re-park under Ruling 6 with the full named requirement below. Nearby journal, inventory or verdict values do not settle the missing authority or CQ. Issuance duties also cannot use the absent proof ledger as evidence.

Needed evidence retained from `INDEX`:

> otp:jv-actual-wall-duration:001 concession requires a revised or new Must/Should CQ whose executable query must traverse a RecordedWallDurationMeasurement individual rather than reading duration values directly from a VerificationEpisode or WorkUnitExecution. otp:jv-actual-wall-duration:002 concession requires an authoritative issuance record joining each duration carrier to a custody lineage, copy/correction events, and a Must/Should decision CQ that distinguishes carrier tokens from equal duration content.

- `so:sha256:2a207d4986630e8590f790457dabe07ffeecdb9b2bfa79cf254c6bce508a2998`

**jv-actual-wall-duration plus diagnostic comparison (1 row).** Re-park under Ruling 6 with the full named requirement below. Nearby journal, inventory or verdict values do not settle the missing authority or CQ. Issuance duties also cannot use the absent proof ledger as evidence.

Needed evidence retained from `INDEX`:

> otp:jv-actual-wall-duration:001 concession requires a revised or new Must/Should CQ whose executable query must traverse a RecordedWallDurationMeasurement individual rather than reading duration values directly from a VerificationEpisode or WorkUnitExecution. otp:jv-actual-wall-duration:002 concession requires an authoritative issuance record joining each duration carrier to a custody lineage, copy/correction events, and a Must/Should decision CQ that distinguishes carrier tokens from equal duration content. otp:jv-lane-diagnostic-comparison:001 concession requires joined identities for both compared executions, their measurement assertions and comparison issuance, plus a Must/Should decision CQ that consumes a distinct comparison record.

- `so:sha256:91988c625516a3fa1516b592a7dc4c6b197b56249390fde1fc1e116867ae1af3`

**pa-projection-conformance-evidence (3 rows).** Re-park under Ruling 6 with the full named requirement below. Nearby journal, inventory or verdict values do not settle the missing authority or CQ. Issuance duties also cannot use the absent proof ledger as evidence.

Needed evidence retained from `INDEX`:

> otp:pa-projection-conformance-evidence:001 concession requires one package manifest with independent authority and version joining suite, implementation build, frozen inputs, replay execution, complete results, limitations, issuance, and custody. otp:pa-projection-conformance-evidence:002 concession requires an independently governed and versioned property-suite specification whose authority is separate from its test-file carrier, plus a Must/Should CQ that requires that specification. otp:pa-projection-conformance-evidence:003 concession requires producing replay-execution and environment identifiers, result issuance, custody, retention and correction lineage, plus a Must/Should CQ requiring a distinct replay-result artifact.

- `po:sha256:059c20e6b0972ff269acf52884fea9e75f4fc5144fac7728dbac333221866181`
- `po:sha256:06dd8aab73f74fd680b9cf55a760da82d4a3420f91fc8ea9d8bdb27c4c000d57`
- `po:sha256:2338c92205c5fc08e5e18d149e7aabca98b83589cf5984e6b83fa81b2401a98c`

**pa-workspace-package (7 rows).** Re-park under Ruling 6 with the full named requirement below. Nearby journal, inventory or verdict values do not settle the missing authority or CQ. Issuance duties also cannot use the absent proof ledger as evidence.

Needed evidence retained from `INDEX`:

> otp:pa-workspace-package:001 concession requires an authoritative package-identity policy and provenance deciding rename, move, version, fork, and delete-recreate continuity, including role versus immutable-content treatment.

- `po:sha256:08a398bab03363136254e3e9c3ed49ebb16ffd18fb94b434111d4446cdf50d69`
- `po:sha256:1189ec1eca4fb79695201186157334124e71372bbe906bb6119996f42b9fe842`
- `po:sha256:13b29fc0bebcac4b0914db214f136add0fa739ac50af65649c800b7013ccb67a`
- `po:sha256:1c941c2e1e41a932dfd00e48631a9dd6217c6e51fe9c681369139a8c0402ea84`
- `po:sha256:28e700021c9b4ba707087650a4e39ceed6540863e4d99b02af241b2b0fdbcaf8`
- `po:sha256:2f816bb5f468d1cc4a06de84c4a9bb8e4c9393a070c41e364f53d951cbf172e1`
- `po:sha256:51a827390306ccb0cf37e23d646c653fd4291f3ed346ae04e097e678a5097781`

**pa-admission-capacity-expression (2 rows).** Re-park under Ruling 6 with the full named requirement below. Nearby journal, inventory or verdict values do not settle the missing authority or CQ. Issuance duties also cannot use the absent proof ledger as evidence.

Needed evidence retained from `INDEX`:

> dh:pa-admission-capacity-expression:001 requires an authoritative capacity contract defining unit conversion, reserve subtraction, hard-floor treatment, and the join from the computed value to capacityAtAdmissionTokens in an observed admission decision.

- `po:sha256:3c757a7975b27b8597ccf8c6d886eb72ad2b8b51aaba8eb59cf21cc9a1a7a3c6`
- `po:sha256:518aee86882c8b9092469203add3bc23c72acfed1d7139f136a96e8763f0c8c7`

**pb-admission-capacity-state (5 rows).** Re-park under Ruling 6 with the full named requirement below. Nearby journal, inventory or verdict values do not settle the missing authority or CQ. Issuance duties also cannot use the absent proof ledger as evidence.

Needed evidence retained from `INDEX`:

> otp:pb-admission-capacity-state:001 concession requires a revised or new Must/Should CQ whose executable query traverses AdmissionSnapshot, plus capture act and instant, machine and policy scope, and an authoritative correlation from that snapshot to the immediately pre-grant admission record used to materialize capacityAtAdmissionTokens.

- `po:sha256:6b31f817391e66aab8fc9796fed0c0bbdbd8285c9e86438e9172d1ce6bbaef61`
- `po:sha256:8a555d65d66a8d7f44336fdb4ce8816f5a033a6ce448e311dc29615bfd8f41f2`
- `po:sha256:8af3333c97798f24aeecfa40f40faefcf152f96fffb6717f647eabf0f5250a92`
- `po:sha256:95037a7104c1dbd21fc02aeeeb45733f744c10ba07ea4c5db2a94db62d88e95a`
- `po:sha256:95b57e4f4029739dacb78d5caa9b43939b1820fc17d3785a9ff32181d7d0e0b6`

**pb-origin-block-grace-window (1 row).** Re-park under Ruling 6 with the full named requirement below. Nearby journal, inventory or verdict values do not settle the missing authority or CQ. Issuance duties also cannot use the absent proof ledger as evidence.

Needed evidence retained from `INDEX`:

> dh:pb-origin-block-grace-window:001 requires a deployed rule defining the threshold unit and true/false consequences, whether it is a grace, staleness, or retry condition, and one observed origin-blocked case governed by it.

- `po:sha256:79df3741e52f870a9c5d7ac0f3c76fc333a1341bf8f15c7a7720f2b6982e88b3`

**pc-heartbeat-suspicion-policy (2 rows).** Re-park under Ruling 6 with the full named requirement below. Nearby journal, inventory or verdict values do not settle the missing authority or CQ. Issuance duties also cannot use the absent proof ledger as evidence.

Needed evidence retained from `INDEX`:

> dh:pc-heartbeat-suspicion-policy:001 requires a deployed policy and observed stale-heartbeat case identifying the suspected holder, threshold, operational consequence, and the rule that suspicion alone does not authorize termination.

- `po:sha256:cb78d031658bfe80535beb490352c2086b2b8f629e3819df4fba336fbeb37598`
- `po:sha256:cb9064130b643be08d25e627bcfc5264739ac1397a236d353835b473c2df5734`

**pc-origin-blocked-timestamp (2 rows).** Re-park under Ruling 6 with the full named requirement below. Nearby journal, inventory or verdict values do not settle the missing authority or CQ. Issuance duties also cannot use the absent proof ledger as evidence.

Needed evidence retained from `INDEX`:

> dh:pc-origin-blocked-timestamp:001 requires a persisted ticket record joining the timestamp and its unit to an observed originBusy wait and starvation-policy use, with issuance and revision provenance.

- `po:sha256:e362227f9f3d78e8fcb933ddf9f5523b1ef97776a2546ad12c7f702c33fc1cdd`
- `po:sha256:edf38d10efe0552b7de770a0cc24a9596cc4b5141b693889e987465f4174b4bb`

#### C(iv): other rows (0)

No unresolved row falls outside C(i)–C(iii). Full-ID set equality and
uniqueness are checked against the committed index before handoff.

### Queue D: legacy-term dispositions (Ruling 16)

There are **2 disposition items covering 3 spellings**:

1. `schedulesWorkUnit` stays CQ-019 arm 3's historical carrier, unratified
   and unrewritten. The query and `cq019-derived-scope-gap.ttl` still use
   that edge. Only the fixture's ordinal literal changes under Ruling 14.
2. Object-property `hasScope` and `Scope` remain **PARKED with the
   no-punning record**. The run-3 emission-v2 fixture emits only the
   step's `hasScopeTag` literal; it emits no object-valued `hasScope`
   or `Scope` individual and therefore does not exercise CQ-019 arm 2.
   The journal/inventory captures add no RDF arm-2 assertion. The older
   seed and CQ-019 scope-gap fixtures do exercise arm 2 as query regression
   tests, but they are pre-existing test inputs, not newly deployed run-3
   emission evidence. Their continued success does not satisfy Ruling 16's
   ratify-if-exercised condition for the run-3 fixtures.

The no-punning split remains literal `hasScopeTag` versus object `hasScope`.
Ruling 16 aligns CQ-019's declared property list and matrix to its unchanged
query predicates: seven `ciops:` properties, plus implicit `rdf:type` in
the executable query (eight predicates in the coverage registry). It does
not ratify the legacy spellings or rewrite a Must-CQ arm.

### Non-triggers and carry-forwards

- **TS adapter v1.1.0 is a non-trigger (Ruling 7).** This run uses
  journal/inventory properties and verbatim emission/prose observations.
  It needs no new compiler-derived TS SourceObservations. Lane A's
  `adapter-journal-run3.py` v1.1.0 is a separate adapter from the deferred
  TS adapter; prose transcription of an emission site does not trigger TS
  extraction.
- **Proof-ledger issuance waits for run 4 (Ruling 17).** Time-to-certainty
  C2 has no lane writer; C4 is the named materialization milestone. Preserve
  partial attempt/verdict evidence without manufacturing `ProofProvenance`.
- **S8 IRI scheme stays deferred (Ruling 15).** Nonce literals provide
  identity evidence; positional emitted request IRIs are not silently
  replaced. The namespace re-proposal stays in Queue A.
- **S6 POLICY carry-forward.** Its source-pinned `corpus_commit` convention
  should adopt the run-3 `corpus_tree`/`corpus_base` and current-tree citation
  convention at an authorized later change. The existing generated
  `ontology/extraction/s6/POLICY.yaml` is not edited here. The receipt
  "capture provenance must survive squash merges" is already in
  `research/OPPORTUNITIES.md`.
- **Seats follow the launch entry.** Denotation, foundational and synthesis
  use Codex; the Codex adversary runs in an independent context. The blinded
  alternative uses a headless `claudeg` proxy session with `grok-4.6`, native
  x-search and `-alt`-namespaced IDs. The launch paragraph records Astra at
  `max` for Codex seats under the packet's 2026-08-27 delegated-lane effort
  directive, which governs seats; the root routing note (`medium` since #1052)
  governs ordinary token-heavy work, not auditor seats. This docket launches
  no seats or reviews.
- **Run-2 ratification projection debt (closeout item).** The run-2 closeout
  never projected rat-032 (FailureSignature), rat-033 (VerificationAttempt),
  rat-037 (dependsOnTransitive) and rat-039 (VerificationLane reuse) into the
  S5/S6 status surface: `extraction/s5/DISPOSITIONS.yaml` seq 12 and 22 and
  `extraction/s6/PREDICATES.yaml` `ciops:dependsOnTransitive` still read
  `parked-run-2`, and `docs/s6-abox-contract.md` §5 still defers VerificationLane
  placement. All 21 run-2 ratifications now sit byte-identically in the sibling
  shelter; their archived records remain the authority. The run-3 closeout
  sitting projects every run-2 and run-3 ratification into S5/S6 status in one
  verified pass (S5/S6 scripts green), never piecemeal mid-run.
- **One end-of-run PR.** The orchestrator owns the pin commit and evidence
  tag, frozen-HEAD run, final artifact/ratification commit and publication.
  The run-2 retro-tag and run-3 pin tag belong to that launch choreography.
  This lane creates neither commits nor tags.

## Engine deltas since run 2 (change run mechanics)

The authoritative skill is repo-vendored at
`.claude/skills/ontology-foundational-auditor/`; no user-scope copy is used.
The following changes and retained constraints come from its
`REVIEW-HISTORY.md` "Field amendments" and the v14 validator docstring:

1. **Validator v14 adds a runs-shelter poison guard.** Record-prefixed or
   review-suffixed files under `runs/` are loud violations and are excluded
   from joins, not silently treated as archived live evidence. Shadow
   manifests and indexes remain subject to authoritative-location checks.
   The per-run records belong in sibling `../archives/<root-name>/` outside
   the live root. Lane A formalizes the run-2 relocation there and reports
   byte preservation and the residual pre-observe scan. `runs/` retains the
   rotation ledger, manifests and indexes. Run 2 had to relocate records
   after 1,896 dangling references exposed the scanner problem.
2. **Strict-first symlink-loop resolution.** `safe_join` resolves strictly
   first; only missing path tails reach the lenient fallback. This fixes
   Python 3.13's non-strict loop handling without an in-root archive
   exemption. Review history records 157 self-test families, green on
   CPython 3.12/3.13/3.14, and byte-identical v13/v14 output over the run-2
   post-rotation tree. V13's 156-family vendoring entry is retained history.
3. **Python runtime pin.** Run-3 preparation uses Python 3.12 with PyYAML
   for validator tooling. Fresh 3.12/3.13 self-test verdicts and the final
   runtime recommendation are **per lane A report**
   (`research/run3-lanes/run3-pin-engine-report.md`); that report was not
   yet available while this docket was assembled. Historical green counts
   above are not a substitute for lane A's current proof.
4. **Content, history and authority remain bound.** The v14 docstring retains
   identity-card/hypothesis joins, foundational-status and category coherence,
   index-to-hypothesis evidence joins, internal alternative-seat joins,
   contiguous review history and revision explanations for failed digests,
   digest-fresh ratification authority under `governance/ratifications/`,
   recomputed observation IDs, token-bounded comment-stripped facts, closed
   nested key sets, root-confined manifest paths, and manifest/observation/
   repository commit agreement. These are retained laws, not newly granted
   vocabulary authority.
5. **Sandbox and adapter constraints remain.** Only trusted authored adapter
   bytes execute through `run_adapter_sandbox.sh`, with no network, a read-only
   repository and a scrubbed environment. The resource limit stays inside
   the namespace after the run-2 correction. Adapters remain stdlib-only;
   v14 still excludes `.ndjson` from configuration extensions, so the
   `config_key_value` evidence channel uses the pinned `.properties`
   projections with exactly the validator's pairing grammar. Raw records
   remain fidelity/custody evidence. Lane A supplies the journal v1.1.0
   selection rules, golden proof and census; no census is guessed here.
6. **Pin new judging bytes.** Validator, shared contracts, five prompts,
   skill and runner digests come from lane A at the pin. Recompute the CQ
   suite digest after this lane's Ruling-14/16 edits; do not reuse run 2's
   CQ digest. Reviews request repairs through `revision_requests` without
   mutating target bytes, and the blinded seat keeps its separate ID space.

### Capture provenance conventions seats must preserve

These fields describe capture and replay; they are **not domain vocabulary
proposals** merely because an adapter can observe them.

| Convention | Required reading |
| --- | --- |
| `corpus_commit` | Historical capture HEAD. It may become unreachable after squash merge; it is not the new auditor run's frozen repository pin. |
| `corpus_tree` / `corpus_base` | Captured tree and base provenance on the refreshed fleet/synthetic manifests. Repository citations retain file/line/anchor and captured file hash; replay checks current-tree path/line/anchor without requiring the old branch commit. Older run-2 and checkout-identity manifests are not retrofitted here. |
| `ownerRef` / `ownerRefVariant` | Capture-local surrogate made before recursive process-member removal. Variants include `pid_pair`, `ownerpid`, `attachedpid`, `weak`; missing starts give weaker keys. Per-capture salts are unrecorded, so these references cannot establish cross-capture continuity or replace nonce/attempt joins. Each nested object owns its own surrogate. |
| `security_resanitization` | Repair history and prior-manifest lineage, not a new capture or new ratification. Ruling 23 repairs ratified run-2 bytes in place; Ruling 22 permits residue-driven refresh of unratified pins. Read generator lineage and each manifest's actual repair/capture records rather than treating all pins as refreshed. |
| `complete_within`, source receipts and `provenance: synthetic` | Scope statements for retained windows and fixture production. Absent files, dropped/unknown rows and unobserved history remain distinct. Synthetic terminal joins demonstrate writer behavior without asserting organic incidence. |

## Not in scope

- S8 IRI design, a lane-DAG planner, scheduler replacement, runtime journal
  instrumentation, new corpus capture, or proof-ledger writer integration.
- Re-running run 1, run 2, S5, S6 or S7; changing prior indexes, historical
  observations, ratification decisions, frozen S6 evidence or corpus pins.
  Lane A's authorized byte-preserving rotation is preparation only.
- A wave of new or amended CQs, helper-class warrants, package-identity
  policy or registry-governance contracts to discharge Ruling-6 parks.
- Query-arm rewrites, namespace substitutions in committed CQs, semantic
  changes to seed facts, or any CQ/seed/contract edit beyond Rulings 14 and 16.
- Ratification by this docket, lifting any provenance flag, or granting a
  new unresolved-fraction waiver. The sitting owns those judgments.
- Commits, staging, tags, PR publication, and edits under `.claude/` or
  `ontology/extraction/` by the docket lane.
