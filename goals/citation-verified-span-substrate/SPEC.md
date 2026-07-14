# Citation Verified Span Substrate Spec

## Objective

Deliver the first goal named by the source exploration: generic, matter-scoped
verified `TextAnchor` construction over `GroundedExtraction[]`, with explicit
conversion into canonical half-open UTF-16 boundaries, deterministic
normalization-to-raw-source offset mapping, cross-chunk/page straddle, and
fail-closed behavior. The substrate consumes `GroundedExtraction[]` directly
because the current `toAnnotatedDocument` handoff constructs entities without
corresponding `Mention` values and is therefore span-lossy.

## Non-Goals

- Fuzzy, case-folded, or lesser-match authorization passes.
- Emitting normalized locator text instead of the exact raw source slice.
- Sending privileged text off-device or treating hosted results as grounding
  truth.
- Adding an `eyecite-js` dependency or implementing the legal citation engine.
- Defining citation, reporter, court, statute, regulation, or other legal
  vocabulary; that remains in the law-practice lane.
- Court-data ingestion, taxonomy, or reinterpretation of artifacts from
  `court-vocabulary-resolver`.
- Epistemic claim-lifecycle changes, matter-wall enforcement, citator/good-law
  computation, rich-text annotation, MPEP patterns, or hosted enrichment.

## Source Hierarchy

1. The user-approved graduation objective and
   [`BRIEF.md`](../../explorations/citation-grounding-hallucination-guard/BRIEF.md).
2. `AGENTS.md`, `CLAUDE.md`, and required skills.
3. `standards/ARCHITECTURE.md` and governing package standards.
4. This `SPEC.md`.
5. `PLAN.md`.
6. `GOAL.md`.
7. The exploration [`DECISIONS.md`](../../explorations/citation-grounding-hallucination-guard/DECISIONS.md),
   [`MAP.md`](../../explorations/citation-grounding-hallucination-guard/MAP.md),
   and supporting `research/`, `ops/`, and `history/` files.

Higher sources outrank lower sources when they conflict.

## Target Surfaces

- `packages/foundation/modeling/provenance` for schema-first verified
  `TextAnchor` construction, source identity/digest/version retention, and
  half-open span conversion contracts.
- `packages/foundation/capability/langextract` for deterministic locator
  normalization, normalized-to-source offset mapping, explicit boundary-unit
  adapters, `GroundedExtraction[]` input, and cross-chunk/page straddle.
- Focused hostile-text fixtures, tests, packet evidence, and documentation.

## Constraints

1. The six-week three-goal appetite belongs to the full program. This first
   goal protects the invariant: cut breadth or ergonomics before exact-source
   equality, local-only privilege safety, or fail-closed behavior.
2. P0 must execute the deferred fixture spike over surrogate pairs, combining
   marks, ligatures, curly quotes, collapsed whitespace, duplicate occurrences,
   page boundaries, and source drift. Its executable result locks conversion
   mechanics before public contracts or implementation freeze.
3. Canonical offsets are half-open UTF-16 code units. Every foreign-unit or
   chunk/page boundary adapter declares its input unit and converts explicitly.
4. Whitespace and typographic-quote normalization is locator-only. Do not
   case-fold or fuzzy-match. Recover raw offsets, emit the raw slice, and require
   `source.slice(start, end) === quote` at construction and re-anchor boundaries.
5. Retain source identity and digest/version with every verified anchor and
   persistence attempt. A digest/version mismatch is stale evidence, not
   permission to rewrite an anchor.
6. Duplicate occurrences require deterministic context disambiguation or fail
   ambiguous. First-match wins is prohibited.
7. Cross-chunk/page matching preserves global raw offsets and exact source
   reconstruction; separator insertion, duplication, or omission must be
   observable and fail closed.
8. Consume `GroundedExtraction[]` directly. Do not use the current
   `packages/foundation/capability/langextract/src/Handoff/index.ts`
   `toAnnotatedDocument` path as a span-preserving boundary.
9. The matter-scoped evidence carrier is modeled here; enforcing a matter wall
   remains a separate gated goal.
10. Persist source identity and digest/version, raw extracted candidates,
    normalization/engine version, verified anchors, matter identity,
    verification/re-anchor attempts, and fail-closed outcomes. Derived display
    and grouping views are recomputed.
11. `NO_CITATION` is not produced by this generic substrate, but its persistence
    contract must support the ratified downstream policy: persist a negative
    extraction attempt and create no citation entity.

## Decision Log

The exploration retains the full rationale and rejected options. These
2026-07-14 summaries are back-links, not replacement doctrine.

| Date | Decision summary | Source |
| --- | --- | --- |
| 2026-07-14 | Port/reimplement the later engine in Effect over existing law-practice values; do not depend on `eyecite-js`. | [`Q1 LOCKED`](../../explorations/citation-grounding-hallucination-guard/DECISIONS.md#q1-locked-build-or-adopt-the-citation-extraction-engine) |
| 2026-07-14 | Split the program into generic substrate, legal extraction/resolution, and ground-before-cite integration; matter-wall enforcement remains separate. | [`Q2 LOCKED`](../../explorations/citation-grounding-hallucination-guard/DECISIONS.md#q2-locked-what-is-the-program-boundary) |
| 2026-07-14 | Build verified-span-first from `GroundedExtraction[]`; exact raw-slice evidence must fail closed before parser coupling. | [`Q3 LOCKED`](../../explorations/citation-grounding-hallucination-guard/DECISIONS.md#q3-locked-what-is-the-first-vertical-slice) |
| 2026-07-14 | Keep v1 local-only; privileged text never leaves the box and hosted enrichment cannot establish grounding. | [`Q4 LOCKED`](../../explorations/citation-grounding-hallucination-guard/DECISIONS.md#q4-locked-may-v1-send-text-to-courtlistener) |
| 2026-07-14 | Place verified-anchor modeling in provenance and normalization/straddle mechanics in langextract; legal vocabulary stays in law-practice. | [`Q5 LOCKED`](../../explorations/citation-grounding-hallucination-guard/DECISIONS.md#q5-locked-where-do-the-capabilities-live) |
| 2026-07-14 | Keep durable law-practice bookkeeping separate from hosted wire statuses; persist `NO_CITATION` as a negative attempt with no entity. | [`Q6 LOCKED`](../../explorations/citation-grounding-hallucination-guard/DECISIONS.md#q6-locked-how-are-durable-and-transient-resolution-states-modeled) |
| 2026-07-14 | Locate with bounded normalization, emit raw, retain source digest/version, use half-open UTF-16, and fail ambiguous occurrences closed. | [`Q7 LOCKED`](../../explorations/citation-grounding-hallucination-guard/DECISIONS.md#q7-locked-what-counts-as-verbatim-grounding) |
| 2026-07-14 | Keep citation-form scope in the later engine; MPEP patterns remain a named follow-on. | [`Q8 LOCKED`](../../explorations/citation-grounding-hallucination-guard/DECISIONS.md#q8-locked-which-citation-forms-are-v1) |
| 2026-07-14 | Defer exact Unicode/source-drift mechanics to this goal's P0 hostile-text fixtures. | [`Fixture spike DEFERRED`](../../explorations/citation-grounding-hallucination-guard/DECISIONS.md#deferred-unicodesource-drift-fixture-spike) |

## Acceptance Criteria

- [ ] The hostile-text fixture set covers surrogate pairs, combining marks,
      ligatures, curly quotes, collapsed whitespace, duplicate occurrences,
      page boundaries, and source drift, and records the conversion contract
      before implementation proceeds.
- [ ] Every successful construction across that fixture set proves canonical
      half-open UTF-16 offsets and `source.slice(start, end) === quote`; emitted
      text is the raw slice, never normalized locator text.
- [ ] A cross-chunk/page straddle fixture produces one global exact raw span
      without separator duplication/omission, while malformed reconstruction
      fails closed.
- [ ] Ambiguous duplicates, malformed/foreign offsets, absent text,
      cross-matter evidence, and digest/version mismatch produce typed
      fail-closed outcomes and no verified anchor.
- [ ] Source drift never silently rewrites an anchor: the failed attempt is
      retained, deterministic re-anchor may create a new verified anchor only
      after re-proving raw-slice equality, and history links both attempts.
- [ ] Persistence proof retains matter identity, source identity and
      digest/version, raw candidate, normalization/engine version, verified
      anchor when present, verification/re-anchor history, and fail-closed
      outcome; a fixture-shaped negative extraction attempt persists without a
      citation entity.
- [ ] Focused package tests, repo gates, reflection lint, and Yeet
      PR-to-mergeable proof pass.
- [ ] No unrelated refactors or formatting churn.

## Verification Matrix

| Check | Command or evidence | Required result |
| --- | --- | --- |
| Launcher size | `test "$(wc -m < goals/citation-verified-span-substrate/GOAL.md)" -le 4000` | Passes |
| Manifest JSON | `jq . goals/citation-verified-span-substrate/ops/manifest.json` | Passes |
| Packet references | `rg -n -e "citation-verified-span-substrate" -e "GOAL.md" -e "agentLaunchers" -e "packetAnchorDocument" goals/citation-verified-span-substrate` | Expected references present |
| Packet whitespace | `git diff --check -- goals/citation-verified-span-substrate` | Passes |
| Hostile-text contract | Focused provenance/langextract fixture tests selected in P0 | Every required fixture proves exact UTF-16 raw-slice behavior or a typed closed failure |
| Straddle and drift | Focused straddle/re-anchor tests plus archived evidence | Global span exact; stale/ambiguous cases cannot mutate authority |
| Persistence policy | Focused codec/repository round-trip tests | Required fields and negative-attempt/no-entity behavior survive restart |
| Repo quality | `bun run beep yeet verify` | Green |
| Reflection | `bun run beep lint reflection-artifacts` | Green at close |

## Stop Conditions

- P0 cannot define one explicit conversion contract that preserves the raw-
  slice invariant across the required hostile-text fixtures.
- Required source identity/digest/version or raw source text is unavailable.
- The implementation would require fuzzy/case-fold authorization, privileged
  off-box text, legal citation vocabulary in foundation, or the span-lossy
  `AnnotatedDocument` boundary.
- Verification requires unnamed credentials, cost, destructive side effects,
  or policy approval.
- The same blocker repeats after reasonable investigation.

## Exception Ledger

| Exception | Scope | Owner | Rationale | Removal condition |
| --- | --- | --- | --- | --- |
| None | N/A | N/A | N/A | N/A |
