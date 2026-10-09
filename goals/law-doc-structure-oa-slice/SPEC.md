# Law Document Structure Office-Action Slice Spec

## Objective

Deliver versioned deterministic recognition of the paired office-action
`ACTION-FINALITY` declaration (`FINAL | NON-FINAL`) and `SHORTENED STATUTORY
PERIOD` block from fixture-backed office-action text. Successful recognition
produces exact verified anchors through the shared verified-span contract and
the schema-backed law-practice `DocStructureCandidate` union members
`OfficeActionFinalityCandidate` and `ShortenedStatutoryPeriodCandidate` at the
intake seam consumed by `goals/law-docketing-patent-spine`. Every unsupported
or insufficient-evidence state fails closed with typed abstention code
`absent`, `ambiguous`, `unsupported`, `low-quality-source`, or
`rule-not-covered`.

## Non-Goals

- Citation parsing, an `eyecite-js` dependency, or a second citation hierarchy.
- A new foundation/capability document-structure package.
- Streaming or a `Partial`/`Complete` transport surface.
- LLM-first extraction or LLM escalation because a regex found no match.
- Untyped `{nodes,links}` snapshots or `AnnotatedDocument` as evidence handoff.
- Court-PDF engine selection, caption/header-stamp recognition, or a layout spike.
- Additional office-action, contract, defined-term, amendment, party, or other
  legal rule families.
- Changes to epistemic admission contracts or repo-wide confidence cleanup.

## Source Hierarchy

1. The user-approved graduation objective and
   [`BRIEF.md`](../../explorations/deterministic-doc-structure-extraction/BRIEF.md).
2. `AGENTS.md`, `CLAUDE.md`, and required skills.
3. `standards/ARCHITECTURE.md` and governing package standards.
4. This `SPEC.md`.
5. `PLAN.md`.
6. `GOAL.md`.
7. The exploration [`DECISIONS.md`](../../explorations/deterministic-doc-structure-extraction/DECISIONS.md),
   [`MAP.md`](../../explorations/deterministic-doc-structure-extraction/MAP.md),
   and supporting `research/`, `ops/`, and `history/` files.

Higher sources outrank lower sources when they conflict.

## Target Surfaces

- `packages/law-practice/domain` for pure versioned OA rule families,
  schema-backed candidate variants, source/rule metadata, and typed abstention.
- `packages/law-practice/use-cases` for extraction ports and the explicit
  `ReadonlyArray<GroundedExtraction>`-to-candidate workflow.
- `packages/law-practice/server` for composition, persistence/replay, and the
  `law-docketing-patent-spine` intake adapter.
- Focused license-safe fixtures, tests, packet evidence, and documentation.

## Blocking Dependency

P0 research may begin immediately. P1 is blocked until
[`citation-verified-span-substrate`](../citation-verified-span-substrate/PLAN.md)
P0/P1 freezes, implements, and proves the shared verified-anchor contract.
This packet consumes that contract; it does not independently redefine it.

## VersionedSourceArtifactIdentity Contract

`VersionedSourceArtifactIdentity` identifies exactly one source artifact and
coordinate space with **artifact id, immutable content digest, source version,
document id, and raw-text reference**. A candidate's verified anchor must prove:

```text
rawText.slice(startUtf16, endUtf16) === quote
```

Normalization is only a locator. Emitted evidence always returns to the raw
half-open UTF-16 coordinates of that one artifact. OCR/layout-derived text also
carries typed parent/source lineage, transformation/engine version, coordinate
mapping, and quality status/warnings. Until that lineage is stable and its
quality authorizes evidence, its offsets cannot authorize a candidate.

## Constraints

1. The rule family is atomic and fail-closed: emit both required verified
   candidates for one supported pair, or emit no candidate and one typed
   abstention. Never authorize a partial pair.
2. Persist rule-family id/version and `VersionedSourceArtifactIdentity` with
   every candidate. A newer rule never silently reinterprets persisted output;
   P0 defines replay, migration, supersession, and audit-history semantics.
3. P0 constructs a non-client, attorney-reviewed corpus from real office
   actions. It includes representative positives, hostile negatives,
   duplicates, near-misses, malformed periods, Unicode, page/segment straddle,
   source drift, unsupported forms, and low-quality/OCR-lineage cases.
4. Before expanding coverage, define and pass labeled per-family precision and
   abstention floors. Hand-authored confidence values are non-calibrated priors.
5. Every adopted regex family has a provenance/license entry naming upstream
   or source, exact disposition, local family/version, and parity fixtures.
   Copyleft, unknown-license, or undiscoverable material is clean-room/reference
   only; do not vendor it.
6. OCR/layout text cannot mint authority without typed parent/source lineage,
   engine/transformation version, coordinate mapping, and authorizing quality
   status. Low quality returns `low-quality-source`.
7. Decode confidence into canonical branded `@beep/schema/UnitInterval` at
   verified-evidence and admission boundaries through explicit adapters. Do not
   silently cast or absorb owner-routed modeling/NLP and citation cleanup.
8. Consume `ReadonlyArray<GroundedExtraction>`, or an equally span-preserving
   array satisfying the same adapter contract. `AnnotatedDocument` and untyped
   graph snapshots are prohibited evidence boundaries.
9. Stale identity, malformed offsets, and raw-slice mismatch fail through the
   consumed verified-span contract; they never degrade into a candidate.
10. LLM refinement remains deferred until labeled outcomes establish
    per-family thresholds and a local privilege-approved path. Extraction
    absence is never an escalation trigger.

## Decision Log

The exploration retains full rationale and rejected options. These back-links
seed implementation without replacing that doctrine.

| Date | Decision summary | Source |
| --- | --- | --- |
| 2026-07-14 | Own non-citation legal structure only; consume verified anchors, citations, file/OCR input, ASTs, and admission contracts from their owners. | [`Q1 LOCKED`](../../explorations/deterministic-doc-structure-extraction/DECISIONS.md#2026-07-14--q1-locked-what-does-this-packet-own) |
| 2026-07-14 | First slice is the paired OA finality and shortened-period structures at the docketing seam over direct span-bearing input. | [`Q2 LOCKED`](../../explorations/deterministic-doc-structure-extraction/DECISIONS.md#2026-07-14--q2-locked-what-is-the-first-vertical-slice) |
| 2026-07-14 | Law-practice owns legal patterns/candidates/workflows; no new foundation doc-structure package. | [`Q3 LOCKED`](../../explorations/deterministic-doc-structure-extraction/DECISIONS.md#2026-07-14--q3-locked-where-does-the-capability-live) |
| 2026-07-14 | Inherited citation override: consume the queued Effect-native citation engine; do not adopt `eyecite-js` or create parallel citation models. | [`Q4 LOCKED`](../../explorations/deterministic-doc-structure-extraction/DECISIONS.md#2026-07-14--q4-locked-how-are-citations-handled) |
| 2026-07-14 | Court-PDF/layout engine selection stays with file-processing; derived offsets require qualified lineage and quality. | [`Q5 LOCKED`](../../explorations/deterministic-doc-structure-extraction/DECISIONS.md#2026-07-14--q5-locked-what-is-the-court-pdf-boundary) |
| 2026-07-14 | Branded `@beep/schema/UnitInterval` is canonical at boundaries; unrelated confidence cleanup remains owner-routed. | [`Q6 LOCKED`](../../explorations/deterministic-doc-structure-extraction/DECISIONS.md#2026-07-14--q6-locked-what-confidence-type-crosses-boundaries) |
| 2026-07-14 | Streaming is deferred; future `Partial` is presentation-only and non-authoritative, while `Complete` is schema-backed, span-preserving, and means extraction finished, not admitted. | [`Q7 LOCKED`](../../explorations/deterministic-doc-structure-extraction/DECISIONS.md#2026-07-14--q7-locked-is-streaming-in-scope), [`Streaming DEFERRED`](../../explorations/deterministic-doc-structure-extraction/DECISIONS.md#2026-07-14--deferred-streaming-follow-on) |
| 2026-07-14 | V1 uses typed abstention; calibration/cascade waits for labeled per-family outcomes and a local privilege-approved path, and no-match never escalates. | [`Q8 LOCKED`](../../explorations/deterministic-doc-structure-extraction/DECISIONS.md#2026-07-14--q8-locked-what-is-the-cascade-policy), [`Calibration DEFERRED`](../../explorations/deterministic-doc-structure-extraction/DECISIONS.md#2026-07-14--deferred-calibration-spike) |

| 2026-10-09 (a) | `SourceTextIdentity` realizes `VersionedSourceArtifactIdentity`: artifact id → `sourceRef`; immutable content digest → `sourceDigest`; source version → digest plus `extractor.version` and `normalizationVersion`; document id → law-practice `documentId`; raw-text reference → `locator` plus `textDigest`, resolved into `VerifiedSourceText`. Carry explicit `documentId` and `sourceVersion` on candidates because the substrate lacks those independent fields. Reason: reuse the proved contract without changing provenance. Reversal: adapt a future dedicated substrate identity and bump the candidate schema version. | Brief step 2a; #871; #1415 |
| 2026-10-09 (b) | Positive-eligible modalities are born-digital UTF-8 payloads and qualified embedded PDF text with pinned extractor/version/flags, real embedded fonts, no OCR producer and no full-page image with invisible text. OCR/layout defaults to `low-quality-source`; public form language is a separate modality. Reason: diagnostics do not authorize coordinates. Reversal: when file-processing supplies coordinate mapping and authorizing quality, admit that modality under a new rule version, relabel and rerun floors. | Brief steps 2b and 3; constraint 6 |
| 2026-10-09 (c) | This packet owns a use-case evidence port and server docketing adapter; the patent spine consumes it later. Reason: the spine is pending and depends on this packet. Reversal: the spine replaces the adapter while retaining the port. | Brief step 2c |
| 2026-10-09 (e) | Add the server provenance dependency if imported, regenerate the lockfile with `bun install`, and regenerate generated files only through owner commands. Reason: AGENTS Autonomy rank 2 overrides GOAL rank 6 for these additive supporting changes. Reversal: remove the dependency, rerun install, and regenerate from main. | Brief step 2e; Source Hierarchy |
| 2026-10-09 (f) | Repo-quality proof comprises three package-verifies, hosted-parity gates, and final-head hosted required checks. Reason: hosted CI is authoritative and full Yeet verification is on-demand. Reversal: run detached `yeet verify`, wait for its job and archive final-head proof in `history/p2/`. | Brief step 2f; AGENTS Quality Operator |

| 2026-10-09 (g) | ODP reference probe and driver retrieval worked; all 16 retrieved official actions were image-only (no fonts, page separators only), so zero were positive-eligible. Credential-free official MPEP §§706.07 and 710 were accessible and supply public-form-language fallback fixtures, reported separately from real-OA performance. No client source was accessed; unqualified originals remain private and confer no authority. Reason: preserve the direct-text and no-OCR-engine constraints rather than guess scanned finality. Reversal: add qualified real-OA fixtures when a source works, rerun per-modality floors, and bump the rule version if recognition changes. | Brief step 3; private diagnostics; official USPTO MPEP |

| 2026-10-09 (d) | Attempted the ruled V1 substitute: blind B ran first outside the repo read-only with command audits, but both permitted outputs failed JSON parsing and are void; B labels are unavailable. All fixtures are listed on the non-blocking attorney sheet. Reason: candidates would be evidence inputs only, and AGENTS Autonomy rank 2 permits the post-hoc spot-check default. P0 nevertheless remains pending because the valid dual-label floor proof is unavailable; this row does not assert constraint 3 or AC 1 is satisfied. Reversal: relabel affected fixtures, rerun a valid independent B procedure and recompute stored vectors; a rule change uses v2 with append-only supersession and replayable v1. | Brief steps 4–5; corpus stop condition; `history/p0/2026-10-09-label-reconciliation.md` |

| 2026-10-09 Run 2 (d) | Third blind run passes the repaired audit: 34 valid labels, allowlisted items, local scripts, A hash frozen and unchanged; zero discarded tracing lines. Atomic agreement 33/34; all differences reconciled by truth rules. Constraint 3 and AC 1 use the ruled substitute under AGENTS Autonomy rank 2: exact anchors plus independent text labels; official codes cross-check only the 16 excluded image-only originals. The attorney sheet is post-hoc and non-blocking. Reason: candidates are evidence inputs only. Reversal: if a spot-check or audit disagrees, void affected labels, repeat independent labeling, and recompute floors; rule changes ship as v2 with append-only supersession and replayable v1. | Run 2 ruling; `history/p0/2026-10-09-label-reconciliation.md` |
| 2026-10-09 Run 2 (g) | No text-qualified real-OA positives were available on 2026-10-09; floors measured on public MPEP form language (32 fixtures), with one OCR and one layout fixture closed. Reason: explicit orchestrator ruling permits retained-inventory floors without weakening exact source. Reversal: add qualified real-OA fixtures and rerun per-modality floors; version any recognition change. | Run 2 ruling; `history/p0/2026-10-09-floor-vectors.json` |

| 2026-10-09 (h) | Retain attempt chains under expected source scope plus document id, including cross-scope failures; actual source identity stays separately recorded. Typed OCR diagnostics are persisted and replayed, and opaque proof classes use the existing named typed base pattern. Reason: match the substrate’s authorized-matter history, preserve quality closure across restart and emit portable declarations. Reversal: a future explicit matter/history adapter may replace the store key under a new attempt schema version while preserving immutable v1 receipts and replay. | P1/P2 focused server proof; VerifiedSpan history contract |

| 2026-10-09 (i) | Cancel the obsolete P0 Heavy Admit run after confirming its immutable fixture-only head, because the implemented P1/P2 head needs a new run and old queued jobs consume runners. Reason: AGENTS Quality Operator directs cancellation for lanes that must rerun; no old-head green claim is made. Reversal: rerun the immutable old-head workflow if historical comparison is needed, while publication schedules the successor head. | PR #1573 P0 Heavy Admit; wave 2 exact-head proof |

| 2026-10-09 (i supplement) | Stop the automatic P0 readiness monitor after its checks settle on the superseded draft head. Reason: final readiness must be bound to the final wave, and the old observer cannot satisfy that proof. Reversal: resubmit a readiness monitor; P3 explicitly submits the required 90-minute final-head job. | P0 detached monitor terminal receipt; brief P3 Mechanics |

| 2026-10-09 (j) | Keep deterministic test builders inside each package’s compiler boundary and share raw fixture data only. Reason: importing TypeScript test helpers across rootDir fails the canonical compiler; no reusable crypto/identity fixture service exists in the test-utils surface. Reversal: consolidate through an owner-added test-utils API and migrate local builders, without widening package compiler roots. | Server TS6059 and deterministicKeys diagnostics; P2 package proof |
| 2026-10-09 (k) | Record release notes without changesets for all three private packages, under main #1566 and the orchestrator standing ruling. Additive APIs would warrant minor releases if published; no existing public API breaks require a major release. Reversal: remove these handoff notes and add owner-generated changesets if the packages become published. | Handoff release-note table; removed only four lane-authored changesets. |
| 2026-10-09 (l) | Run `docgen:local --full` after the scoped command requires full proof for owner-generated root paths and the regenerated lockfile. Reason: honor the owner command’s global-input gate without bypassing it. Reversal: rerun the original scoped command after those inputs no longer differ, retaining both results as evidence. | P2 docgen preflight log; package docgen proofs. |
| 2026-10-09 (m) | Schema-valid JSON-safe attempt encoding is an invariant; encoder failure becomes a defect. Read, decode, initialization, lock and append failures remain typed storage errors. Reason: the validated receipt contains only finite data, strings and schema-backed collections; a fabricated invalid instance is outside the typed port. Reversal: introduce a typed encoding failure with a real failing fixture if a future receipt codec adds fallible transforms. | P2 uncovered encoder callback; receipt schema and storage tests. |

## Acceptance Criteria

- [ ] P0 records an attorney-reviewed, license-safe fixture inventory covering
      the required real-OA positives, hostile negatives, duplicates, drift,
      malformed/unsupported, Unicode/straddle, and quality/OCR-lineage cases.
- [ ] P0 records rule-family/version identity, replay/migration/supersession
      semantics, regex-family provenance/license/parity entries, and labeled
      precision/abstention floors before P1 begins.
- [ ] P1 begins only after the substrate P0/P1 contract proof is available and
      uses its source identity, canonical half-open UTF-16, ambiguity, drift,
      straddle, and exact raw-slice behavior without weakening it.
- [ ] Exactly one supported paired match emits one
      `OfficeActionFinalityCandidate` (`FINAL | NON-FINAL`) and one
      `ShortenedStatutoryPeriodCandidate`, both schema-backed with verified
      anchors, rule-family id/version, source identity, and branded confidence.
- [ ] Missing, duplicate/ambiguous, unsupported, uncovered, or low-quality input
      emits no candidate and the matching typed abstention; stale, malformed,
      or raw-slice-invalid input fails closed through the verified-span contract.
- [ ] Persisted candidates retain source identity/digest/version, raw evidence,
      rule identity/version, replay/supersession history, and typed outcomes
      across restart without reinterpretation under a newer rule.
- [ ] The `law-docketing-patent-spine` intake seam consumes the two candidate
      variants without treating extraction as admission or attorney approval.
- [ ] Focused package/fixture/integration tests, repo gates, reflection lint,
      and Yeet PR-to-mergeable proof pass.
- [ ] No unrelated refactors or formatting churn.

## Verification Matrix

| Check | Command or evidence | Required result |
| --- | --- | --- |
| Launcher size | `test "$(wc -m < goals/law-doc-structure-oa-slice/GOAL.md)" -le 4000` | Passes |
| Manifest JSON | `jq . goals/law-doc-structure-oa-slice/ops/manifest.json` | Passes |
| Packet references | `rg -n "law-doc-structure-oa-slice|GOAL.md|agentLaunchers|packetAnchorDocument" goals/law-doc-structure-oa-slice` | Expected references present |
| Packet whitespace | `git diff --check -- goals/law-doc-structure-oa-slice` | Passes |
| P0 corpus and rules | Attorney-reviewed fixture/provenance ledger and version/precision note archived under `history/` | Required cases, dispositions, version semantics, and floors explicit before P1 |
| Exact paired extraction | Focused law-practice domain/use-case fixture tests selected in P1 | Supported pairs emit exactly two verified variants; every closed state emits none |
| Source and replay integrity | Focused source-identity, OCR-lineage, drift, persistence, and replay tests | Exact raw slices and lineage valid; newer rules never reinterpret stored output |
| Docketing seam | Focused law-practice server integration proof | Candidates arrive as evidence inputs, not admitted/approved truth |
| Repo quality | `bun run beep yeet verify` | Green |
| Reflection | `bun run beep lint reflection-artifacts` | Green at close |

## Stop Conditions

- P1 is requested before `citation-verified-span-substrate` P0/P1 proves the
  shared anchor contract.
- The attorney-reviewed corpus or regex-family provenance/license disposition
  cannot support the shaped precision floor.
- Required source identity/raw text or OCR lineage/quality is unavailable.
- Implementation would require citations, a new foundation package, streaming,
  LLM-first/no-match escalation, untyped evidence, court-PDF engine selection,
  or another rule family.
- Verification requires unnamed credentials, cost, destructive side effects,
  or policy approval.
- The same blocker repeats after reasonable investigation.

## Exception Ledger

| Exception | Scope | Owner | Rationale | Removal condition |
| --- | --- | --- | --- | --- |
| None | N/A | N/A | N/A | N/A |

