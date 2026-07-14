# Citation Extraction Engine Spec

## Objective

Port/reimplement the BSD-2 eyecite extraction pipeline as pure Effect-native
law-practice domain code that emits the existing citation value-object taxonomy
under `packages/law-practice/domain/src/values/`: `CitationBase`, per-form
citations, `Span`, `ResolutionResult`, `CitationWarning`, and related values.

Prove stage-attributable parity for full and short case citations, Id., supra,
and product-pull patterns for 35 U.S.C. statutes and 37 C.F.R. regulations.
Every successful citation retains span fidelity through the existing verified-
span anchor contract and uses only stable IDs/versioned public vocabulary from
`court-reporter-vocabulary`, never raw generated files.

## Blocked By

- `goals/citation-verified-span-substrate` — verified-anchor, canonical half-open
  UTF-16, source identity/version, normalization mapping, and straddle contract.
- `goals/court-reporter-vocabulary` — stable court/reporter IDs, lookups, and
  machine-readable artifact compatibility/version contract.

P0 research/provenance work may proceed, but implementation contracts do not
freeze and P1 does not begin until both dependencies are compatible and public.

## Non-Goals

- Adding or adopting an `eyecite-js` runtime dependency.
- MPEP section patterns; `citation-mpep-patterns` is a named NET-NEW fast-follow.
- Court/reporter ingestion, raw-file reinterpretation, or court-string resolver behavior.
- Ground-before-cite orchestration, claim lifecycle changes, matter-wall enforcement,
  hosted CourtListener enrichment, citator/good-law, or rich-text annotation.
- General statutory/regulatory parsing beyond ratified 35 U.S.C./37 C.F.R. fixtures.

## Source Hierarchy

1. The ratified 2026-07-14 revisit objective and
   [`BRIEF.md`](../../explorations/citation-grounding-hallucination-guard/BRIEF.md).
2. `AGENTS.md`, `CLAUDE.md`, and required skills.
3. Governing architecture/package standards and both dependency contracts.
4. This `SPEC.md`, then `PLAN.md`, then `GOAL.md`.
5. Exploration [`DECISIONS.md`](../../explorations/citation-grounding-hallucination-guard/DECISIONS.md),
   [`MAP.md`](../../explorations/citation-grounding-hallucination-guard/MAP.md), and research.

## Target Surfaces

- `packages/law-practice/domain/src/values/` and pure domain modules for the
  extraction pipeline, output adapters, and `CitationBase` confidence repair.
- Focused parity, statute/regulation, regex-safety, and span-fidelity fixtures/tests.
- Shared root `THIRD_PARTY_NOTICES.md` metadata for eyecite-derived code/fixtures.
- Packet research, provenance, and verification evidence.

## Constraints

1. This is the locked user override: port/reimplement now over existing values;
   do not adopt `eyecite-js` or create a competing citation hierarchy.
2. P0 verifies the scaffolded eyecite source/corpus pin, inventories fixture and
   code licenses/provenance, and records affected material in the shared root
   BSD-2 notice before derived code or fixtures land.
3. Parity is observable by pipeline stage—clean/tokenize/extract/group/resolve—
   so divergence is attributable, not hidden behind one percentage.
4. Regex safety is reviewed across the pinned corpus with re2js-compatibility
   awareness shared with the vocabulary/resolver lane. Unsupported constructs,
   adversarial timing, and any bounded native fallback are evidenced explicitly;
   timeouts are not treated as proof of regex interruption.
5. Consume `court-reporter-vocabulary` only through stable IDs, lookup APIs,
   machine-readable compatibility classification, and artifact version. Record
   or check the version; never import or reinterpret raw generated artifacts.
6. Consume `citation-verified-span-substrate` as the anchor contract. Canonical
   offsets are half-open UTF-16, every foreign-unit adapter is explicit, and
   every successful candidate preserves exact source span fidelity.
7. Repair `CitationBase.confidence` from loose `S.Finite` to branded
   `@beep/schema/UnitInterval` at the extraction boundary, with explicit decode
   rather than casts. This owner-routed cleanup is cross-referenced from
   `explorations/deterministic-doc-structure-extraction/DECISIONS.md` Q6.
8. Reuse `ResolutionResult` and `CitationWarning`; do not mutate
   `ClaimLifecycle`. `NO_CITATION` creates no citation entity.
9. V1 forms are exactly full/short/Id./supra cases plus 35 U.S.C. and 37 C.F.R.
   fixture patterns. MPEP remains visibly out of parity scope.
10. Runtime is local and deterministic. No privileged text leaves the box and
    no hosted result becomes parsing or grounding truth.

## Acceptance Criteria

- [ ] Both prerequisite goals expose compatible public contracts and P1 records
      the exact artifact/anchor versions it consumes.
- [ ] A pinned, license-inventoried parity corpus proves full, short, Id., and
      supra case extraction with stage-level diagnostics.
- [ ] Ratified patent-pull fixtures prove 35 U.S.C. `StatuteCitation` and
      37 C.F.R. `RegulationCitation` extraction; MPEP fixtures are absent and
      named as fast-follow.
- [ ] Outputs are existing law-practice citation values; no second hierarchy or
      `eyecite-js` runtime dependency exists.
- [ ] Every successful candidate preserves canonical UTF-16 span fidelity on
      Bun and composes the verified-anchor contract.
- [ ] `CitationBase.confidence` decodes as branded `UnitInterval` at the boundary,
      with out-of-range/non-finite rejection tests.
- [ ] Regex corpus compatibility and adversarial timing evidence justify the
      selected bounded execution strategy.
- [ ] Root attribution records full BSD-2 terms, Free Law Project, eyecite's
      final pin, and affected code/fixtures alongside the shared data entries.
- [ ] Focused packages, parity/span proof on Bun, repo gates, reflection lint,
      and Yeet PR-to-mergeable proof pass.
- [ ] No unrelated refactors or formatting churn.

## Verification Matrix

| Check | Command or evidence | Required result |
| --- | --- | --- |
| Launcher | `test "$(wc -m < goals/citation-extraction-engine/GOAL.md)" -le 4000` | Pass |
| Manifest/dependencies | `jq . goals/citation-extraction-engine/ops/manifest.json` | Both blockers recorded |
| Parity | Pinned stage-level corpus suite | All ratified case forms match expected values/spans |
| Patent forms | 35 U.S.C./37 C.F.R. fixtures | Existing statute/regulation values emitted |
| Span fidelity | Focused Bun tests | Exact canonical UTF-16 spans and verified anchors |
| Confidence | Boundary codec tests | Branded UnitInterval; invalid numbers rejected |
| Regex safety | Corpus scan + timing evidence | Unsupported/fallback set bounded and explained |
| Repo quality | `bun run beep yeet verify` | Green |

## Stop Conditions

- Either dependency contract is absent, incompatible, or accessible only through raw files.
- P0 cannot establish a pinned, attribution-safe parity corpus or bounded regex strategy.
- Parity requires a second citation taxonomy, hosted truth, fuzzy grounding, or
  weakening span/source equality.
- Verification requires unnamed credentials, cost, destructive effects, or authority.

## Decision Log

- The port-not-adopt user override, existing-value output contract, local-only
  boundary, package ownership, resolution semantics, strict grounding, and v1
  forms are locked in the exploration
  [`DECISIONS.md`](../../explorations/citation-grounding-hallucination-guard/DECISIONS.md).
- The confidence cleanup is owner-routed here by
  [`deterministic-doc-structure-extraction/DECISIONS.md`](../../explorations/deterministic-doc-structure-extraction/DECISIONS.md#2026-07-14--q6-locked-what-confidence-type-crosses-boundaries).

## Exception Ledger

| Exception | Scope | Owner | Rationale | Removal condition |
| --- | --- | --- | --- | --- |
| None | N/A | N/A | N/A | N/A |
