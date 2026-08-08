# Mapping — Graphnosis "corrections, confidence, contradiction & forgetting" → beep-effect

Checkout: `/home/elpresidank/YeeBois/projects/beep-effect15` @ `d1dfc4b3c1` (main, clean).
Source survey: `scratchpad/graphnosis/survey-epistemics.md`. Source repo: `~/YeeBois/dev/Graphnosis`.

## Headline

beep-effect's `packages/epistemic/*` slice is **ahead of Graphnosis on the structural half of this
territory and behind on the erasure/weighting half.** Graphnosis reached indelibility by bolting a
retirement-marker state machine onto a mutable in-memory node map. beep-effect got there by
construction: rows are immutable, liveness is two half-open interval pairs, and "which revision"
is `(logicalKey, version)`. Most of Graphnosis's hardest-won guards are unrepresentable failures
here. The three places beep-effect is genuinely exposed:

1. **There is no erasure/forgetting path at all**, so the `delete` vs `supersede` re-ingest-policy
   distinction (the single sharpest Graphnosis idea) has nowhere to be wrong yet — and the open
   question that owns it ("retention classes", align Q3) is captured but unanswered.
2. **There is no "weigh this differently" primitive**, which is exactly the vacuum that made a
   Graphnosis consumer emulate reinforcement as `edit(id, sameContent)` and silently destroy data.
   A beep-effect consumer reaching for `supersede` with an unchanged fact would burn a version
   number per recall — the same failure, one layer down.
3. **Decay research is deep but omits the causal trap** that killed it in Graphnosis (nothing writes
   the field decay keys on; recording access on a read is itself a consequential decision).

## Ground truth established (searches + reads)

### The epistemic write surface is exactly four operations

`packages/epistemic/use-cases/src/EdgeAuthority/EdgeAuthority.ports.ts:61-66`

```
readAsOf / readLatest / record / supersede
```

No `edit`, no `delete`, no `setConfidence`, no `forget`. Commands file
(`EdgeAuthority.commands.ts:1-11`) states it outright: *"These are the only three shapes a caller
may hand the bitemporal edge repository: assert a fact, supersede a known version of a fact, and
ask what was believed at a point on both axes."*

### Correction = close the transaction interval + insert a new row

`packages/epistemic/server/src/EdgeAuthority/EdgeAuthority.repo.ts:331-375`
(`supersedeEdgeFactInTransaction`): `SELECT ... WHERE expiredAt IS NULL FOR UPDATE` →
compare `expectedVersion` → `UPDATE ... SET expiredAt` → `INSERT` replacement with
`supersedesId: O.some(head.id)`, `version: head.version + 1`. Returns `{ former, replacement }`,
both read back via `.returning()` (`persistedOrSeed`).

### Liveness is intervals, never a marker and never a score

`EdgeAuthority.repo.ts:154-155`:

```ts
const openHeadOf = (versions) =>
  A.findFirst(versions, (v) => O.isNone(v.validTo) && O.isNone(v.expiredAt));
```

`supersedesId` is read nowhere in the liveness decision — it is lineage only. `EdgeVersion.model.ts`
header: *"there are no magic sentinel dates and no persisted `isLatest` flag, because 'latest' is a
question you ask the axes, not a fact you store."*

`Confidence` (`packages/epistemic/domain/src/values/EvidenceSpan/EvidenceSpan.model.ts:46`) is a
`UnitInterval` on immutable Evidence/EvidenceSpan and on `ContradictionAssessment.confidence`. No
code path consults it for liveness, and no code path writes it after construction.

### (id, rev) identity already shipped

`EdgeVersion` carries `logicalKey` (SHA-256 digest of the *identity* — endpoints, relation,
matter/evidence scope, qualifiers, org — **not** the fact) + `version: PosInt` + row id
+ `supersedesId`. `BeliefVersionRef` (`values/Contradiction/Contradiction.model.ts:294-309`) is
literally `{edgeVersionId, logicalKey, version}` — "two revisions of the same thing" is a
first-class value. That is Graphnosis SPEC §8.1's proposed *v2* identity, shipped.

### Conflicts have a place to point — a row, not an edge

`ContradictionCandidate` (entity) holds `CanonicalContradictionBeliefPair {left, right}` +
`ContradictionMatchBasis {detector, detectorVersion, kind, evidenceDigest, left/rightEvidenceIds}` +
`ContradictionAssessment {confidence, proposals}`. `ContradictionDisposition.decision` is a tagged
union `rejected {reason} | superseded {formerEdgeVersionId, replacementEdgeVersionId, proposalId,
proposalDigest, reason}`. **Both** adjudication branches are durable — the exact hole Graphnosis
antipattern A3 names ("keep both"/"reject" unrepresentable, so the conflict is re-reported forever).

### Collision guard + read-back receipt, in one

`packages/epistemic/server/src/ContradictionTriage/ContradictionTriage.repo.ts:1018-1031`: after the
insert the row is **re-selected `FOR UPDATE`** and its persisted `candidateDigest` compared against
the computed one; mismatch → `ContradictionSubmissionConflict{reason: "candidate-payload-mismatch"}`.
`candidateKey` is the dedup key; `candidateDigest` is described in the model as a *"collision guard
over the complete immutable candidate payload"*. That is Graphnosis's "bucket by hash, sub-group by
exact content, refuse rather than merge" — with the verification done against persisted state.

### Audit actor classification is a typed union, not a string prefix

`packages/shared/domain/src/entity/Principal.ts`: `UserPrincipal | ServiceAccountPrincipal |
SystemPrincipal{component: "Runtime"|"Sync"|"Migration"|"Policy"|"Generator"}`, plus `SourceKind`,
on every `BaseEntity` row (`createdByPrincipal`/`updatedByPrincipal`, and `resolvedBy`/`receivedBy`
on the disposition/receipt rows). Free-text reasons are separately bounded schemas
(`ContradictionReviewReason` ≤2000 trimmed, `ClaimDispositionReason` non-empty).

### Dry-run doctrine already exists in the repo (tooling lane)

`packages/tooling/tool/cli/src/commands/Yeet/internal/Sweep.schemas.ts:10-16`: *"`SweepPlan` is the
dry-run: every step it would take, the git facts it observed, and whether the step needs a human.
Running it produces a `SweepReport`: the same plan echoed verbatim plus one outcome per step."*
Same-code-path preview, plus a `**Gotchas**` block naming the exact probe that would have made a
precondition falsely read satisfied. This is the beep-native instance of Graphnosis §7 + §14.

### Gap-proof commands (run from repo root, all returned nothing)

```
rg -in 'retiredBy|retirementReason|blocksReingest|reingest|re-ingest' --glob 'packages/**/src/**/*.ts'
rg -in 'forgetTopic|forgetBy|softDelete|soft_delete|deletedAt|forgottenAt' --glob 'packages/**/src/**/*.ts'
   → only @beep/firecrawl `deleteBrowser` (unrelated driver surface)
rg -in 'setConfidence|reinforce|decayConfidence|lastAccessedAt|accessCount' --glob 'packages/**/src/**/*.ts'
rg -in 'decay' --glob 'packages/**/src/**/*.ts'
   → 2 hits, both `AgentEffectiveness/internal/Eval*.ts` "monotone reciprocal decay 1/(1+violations)"
rg -n '"(user|system|preview):' --glob 'packages/**/src/**/*.ts'
rg -in 'shouldHide|auditFilter|reasonPrefix' --glob 'packages/**/*.ts'
rg -in 'audit report|generateAudit|auditExport' --glob 'packages/**/src/**/*.ts'
rg -in 'stryker|mutation test|neutralis|neutraliz'   → no test-craft convention, only prose hits
```

### Packet landscape checked

`ls explorations goals` (full listing read). Relevant:

- `explorations/graphnosis-prior-art` — **this campaign's own packet**, stage `capture`. CAPTURE.md
  already names `edit`-supersedes, `setConfidence`, `previewForgetTopic`, soft-delete+`retired`, and
  `reflect()` as the epistemic overlap surface, and describes the exact mining workflow producing
  this note. Findings land in its `RESEARCH.md`.
- `explorations/epistemic-belief-view-revision` — carries **align Q3 "retention classes
  (retention-bearing authority vs expirable operational events vs prunable projections vs prohibited
  secret-bearing inputs)"** as an open question in `ops/manifest.json`. This is the erasure/forgetting
  owner.
- `explorations/agent-memory-tiers-bitemporal-edges` — MAP names a not-yet-graduated
  `epistemic-memory-retention-projections` packet; `research/memory-tier-decay-and-eviction.md` is a
  deep decay/eviction study (agentmemory λ=0.01 → 69d half-life, FSRS/ACT-R critique, dryRun+batched
  audit eviction, and §F "keep retention metadata OFF the immutable claim/evidence values; put it in
  a mutable sidecar `RetentionScore` row"). Retention/decay/weighting owner.
- `goals/epistemic-contradiction-triage` — shipped; `GOAL.md` Out list explicitly excludes
  "NLP/semantic-graph detection engines" and "retention, tier, or decay policy". So detection
  calibration has **no** owning packet.
- `explorations/compound-engineering` — the capture-at-friction-time / ledger / rationale-durability
  packet; natural home for the process-craft finding.

## Per-finding calls

| id | status | landing | value | why |
|---|---|---|---|---|
| gai-01 | already-have | graphnosis-prior-art | 2 | No `edit` primitive exists to collapse; supersede is the only correction path and it is close-interval + insert. |
| gai-02 | partial | epistemic-belief-view-revision | 5 | Q3 retention classes captured as an open question; zero vocabulary, zero code, and no ingest path that could consult it. The distinction is invisible in any score — beep would hit the identical bug. |
| gai-03 | not-applicable | NONE | 2 | No mutable lifecycle marker exists to merge; retirement is an interval closed once under `FOR UPDATE` with a typed `SupersessionConflict`. Becomes binding only if gai-02 introduces a marker. |
| gai-04 | already-have | graphnosis-prior-art | 2 | valid-time vs transaction-time are separate columns; the expired-vs-retracted conflation is unrepresentable. Confidence is immutable and never read for liveness. |
| gai-05 | partial | agent-memory-tiers-bitemporal-edges | 4 | Read-back receipt already the house pattern (`.returning()`, digest re-select). The *primitive* is absent, and the absence is the hazard: reaching for `supersede` to reweight burns a version per recall. |
| gai-06 | already-have | graphnosis-prior-art | 2 | Effect typed error channel removes the ignorability axis entirely; schema-level `hasUniqueEvidenceIds`/`hasUniqueProposalIds` already refuse repeated ids at decode; one transaction gives atomicity. |
| gai-07 | partial | agent-memory-tiers-bitemporal-edges | 4 | Same-code-path preview shipped in tooling (SweepPlan/SweepReport). No product-side destructive op exists yet; when eviction lands, the blast-radius measurement + word-boundary matching rules are directly binding. |
| gai-08 | partial | NEW:epistemic-contradiction-detection | 3 | Adjudication contract is *better* than Graphnosis (both branches durable; detector+version recorded in the match basis). Calibration doctrine + a detector have no owner — triage's GOAL.md excludes detection engines. |
| gai-09 | already-have | graphnosis-prior-art | 1 | `Principal` tagged union + `SourceKind` is the typed form of `user:`/`system:`; `preview:` is moot because nothing speculative is persisted with an audit reason. |
| gai-10 | partial | agent-memory-tiers-bitemporal-edges | 4 | Decay research is deeper than Graphnosis's on the math, and silent on the causal trap: no field records access, recording access on a read is a design decision, and a compounding multiplier on a scheduler collapses to its floor. |
| gai-11 | already-have | graphnosis-prior-art | 3 | `openHeadOf` reads only interval nullness; `supersedesId` never establishes liveness. Transferable residue is the *test craft*: a separate write-path suite whose header states why the read-path suite structurally cannot catch decide-and-mutate defects. |
| gai-12 | already-have | agent-memory-tiers-bitemporal-edges | 3 | Hash-key + full-payload digest verified against re-selected persisted state. Nothing hard-deletes. The transferable half is (c): scope a guarantee in writing when an opt-in maintenance op is outside it — needed the day eviction lands. |
| gai-13 | already-have | graphnosis-prior-art | 2 | `(logicalKey, version)` + row id shipped; `logicalKey` is identity-derived, explicitly not content-derived; conflicts are rows referencing two `BeliefVersionRef`s. beep shipped Graphnosis's unimplemented v2. |
| gai-14 | partial | compound-engineering | 4 | `**Details**`/`**Gotchas**` JSDoc law + the friction-receipt ledger law cover archaeology and errata. Guard-neutralisation testing ("removing this guard turns a NAMED check red") has no analogue — and pairs with the repo's known vacuous-test failure mode. |

## Antipattern exposure

- **A1 (two detectors, incompatible gates)** — no current risk (zero detectors), but
  `ContradictionMatchBasis.detector`/`detectorVersion`/`kind` already make divergent detectors
  *distinguishable in the data*, which is the structural fix Graphnosis lacks. Fold into gai-08.
- **A2 (detection mutates; audit mutates what it audits)** — structurally blocked: candidate
  submission is append-only, duplicate-suppressed by `candidateKey` with a receipt, and never
  touches `EdgeVersion`.
- **A3 (adjudication has nowhere to live)** — solved: `ContradictionDisposition` has both branches.
- **A4 (health metrics conflate tombs with weak live memories)** — no metrics surface exists;
  `rg 'audit report|generateAudit|auditExport'` empty.
- **A5 (none of it reaches the MCP surface)** — worth noting, not a defect: `PracticeKg.tools.ts`
  exposes nine read-only tools (`kg_clients`, `kg_docket_family`, `kg_application_lookup`, `kg_find`,
  `corpus_search_text`, `corpus_get_document`, `email_search`, `kg_candidate_claims`,
  `kg_provenance`). No supersede/dispose/weight tool. In beep that is deliberate — authority mutation
  is gated behind `goals/agent-execution-authority` — whereas in Graphnosis it is an accidental hole.
  The transferable half is Graphnosis's own worse bug: the MCP ingest path bypassed the facade and
  dropped contradictions. beep's analogue would be an MCP write tool that bypasses
  `ContradictionTriageService`; worth a written constraint when write tools land.
- **A6 (correction discards provenance)** — blocked: `SupersedeEdgeFact` carries the full
  `LogicalEdgeIdentity` (endpoints, relation, matter/evidence scope, qualifiers) plus `recordedBy`,
  and the replacement inherits the same `logicalKey`.
