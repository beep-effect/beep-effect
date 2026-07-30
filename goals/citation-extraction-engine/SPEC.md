# Citation Extraction Engine Spec

## Objective

Implement a local, deterministic, Effect-native legal-citation engine with
observable capability parity to Free Law Project eyecite 2.7.6 at commit
`04d82c032ad5fd0f9ab72a61c87110c46ee8f52e`.

Parity is behavioral, not structural. The implementation must cover the
canonical public operations and every upstream fixture case while using this
repository's schema-first data model, Effect error/service boundaries, stable
court/reporter identities, and verified raw-source anchors. It must also audit
the locally pinned TypeScript ports, adopting unique capabilities only when
they are licensed, test-backed, legally coherent, and compatible with the
engine's safety contract.

The existing law-practice citation values are provisional input to the redesign,
not an API compatibility constraint.

## Normative Terms

- **Canonical oracle**: the pinned official Python eyecite revision.
- **Capability parity**: equivalent observable legal behavior after documented
  representation and offset normalization.
- **Canonical case**: one independently asserted upstream fixture/subtest
  example, not merely one Python unittest method.
- **Subsumed**: behavior exists through a different Effect-native interface and
  has equivalent regression proof.
- **Divergence**: intentional behavior different from the canonical oracle,
  recorded with rationale, normalized before comparison only when the
  difference is representational.
- **Proven extension**: a unique TypeScript-port behavior meeting every
  extension gate in this spec.
- **Semantic equality**: equality of legal citation meaning after removing
  source evidence, diagnostics, and canonicalized presentation differences.

## Source Hierarchy

1. This `SPEC.md` and the 2026-07-29 user override recorded below.
2. `AGENTS.md`, `CLAUDE.md`, architecture standards, and required skills.
3. Pinned official eyecite behavior, tests, fixtures, and BSD-2 license.
4. Public contracts of both prerequisite goals.
5. `research/CAPABILITY_LEDGER.md`, `SCHEMA_DISPOSITION.md`, and
   `PARITY_METHOD.md`.
6. Pinned `eyecite-ts` and `eyecite-js` as differential/extension evidence.
7. Earlier exploration decisions where they do not conflict with this spec.

The Python oracle decides canonical behavior. Repository laws decide TypeScript
architecture. A TypeScript port may reveal a Python bug or useful extension but
cannot silently redefine canonical parity.

## Blocked By

- `goals/citation-verified-span-substrate` — source identity/version, verified
  raw UTF-16 anchors, normalization-to-raw mapping, straddle, ambiguity, and
  fail-closed drift behavior.
- `goals/court-reporter-vocabulary` — stable public court/reporter IDs,
  lookups, artifact version, and machine-readable compatibility classification.

Source acquisition, case inventory, regex review, oracle generation design, and
schema disposition may proceed. No production engine contract freezes and no
P1 production implementation begins until both dependency surfaces are public
and compatible. Raw generated vocabulary files and locally invented anchor
substitutes do not clear these blockers.

## Required Capability Surface

Canonical parity covers all behavior reachable through official eyecite's four
top-level operations:

1. `clean_text`: named/callable cleaning steps, HTML/XML removal, whitespace
   normalization, underscore handling, and invalid-step behavior.
2. `get_citations`: tokenization, full case/law/journal citations, short case,
   `Id.`, supra, reference and unknown citations, markup references, metadata,
   disambiguation, overlap/filter behavior, pincites, dates, courts, reporter
   editions, and full-span behavior.
3. `resolve_citations`: resources, full-authority grouping, short/supra/Id./
   reference resolution, ambiguity, invalid pincites, and non-case authorities.
4. `annotate_citations`: plain/HTML annotation, span updates after replacement,
   tag balancing, long-diff behavior, and optional pincite span inclusion.

Supporting model, tokenizer, regex, helper, hashing/comparison, document, and
court-parser behavior is required whenever an official test or public operation
observes it. Private Python helper names do not require public TypeScript
equivalents.

Every canonical test case must appear in the case-level ledger with source
location, normalized input, expected stage outputs, target test, and final
status. A green wrapper around only the four public functions is insufficient.

## TypeScript Extension Policy

Every unique exported or test-observed `eyecite-ts`/`eyecite-js` behavior must
end in exactly one disposition:

- `adopted`: implemented with regression and parity/property proof;
- `subsumed`: covered by a named canonical or repo-native capability;
- `rejected`: deliberately excluded with license, correctness, domain, or
  safety rationale;
- `follow-up`: not part of this engine's completion surface, with a named
  successor goal and no leaked provisional API.

An extension may be adopted only when:

1. its source and incorporated material are license-compatible and attributed;
2. tests or reproducible fixtures define its behavior;
3. it represents a coherent legal or evidence concept in the target schemas;
4. it preserves local-only deterministic execution, exact source fidelity, and
   bounded regex/runtime behavior; and
5. it does not create parallel truth for a canonical or prerequisite concept.

The audit includes, at minimum, stable citation IDs, segment maps, false-positive
filters, granular legal-form extractors, typed parse errors, court/pincite
normalization, document/scope resolution, footnotes, document analysis and
citation graphs, durable locators/context helpers, Bluebook utilities,
`IdLawCitation`, `DOLOpinionCitation`, overlap modes, HTML annotation, and
Id.-section substitution.

## Target Ownership and Architecture

Legal meaning stays in `packages/law-practice/domain`. Use-case orchestration and
engine services stay in the law-practice use-case role. Generic verified source
provenance stays in its prerequisite owner.

All public and inter-stage data must be the decoded type of an annotated Effect
schema. Service contracts may be interfaces; citation, token, request, result,
warning, error payload, fixture, and transform models may not be hand-authored
data interfaces.

The target conceptual surface is:

- `Citation`: tagged semantic union containing legal meaning only.
- `FullCitation` and `ShortFormCitation`: derived tagged-union subsets.
- `CitationMention`: stable citation ID, semantic citation, verified source
  anchor, matched text, component anchors, and typed warnings.
- `CitationResolution`: tagged `Resolved | Ambiguous | Unresolved` outcomes
  using stable IDs, not array positions.
- `CitationDocument`: mentions, authority groups, references, and resolution
  relationships.
- `CitationEngineInput`: source identity/text plus schema-defined options.
- `CitationEngineReport`: stage diagnostics, timing, pattern counts, and safety
  evidence; never embedded in semantic citations.
- `CitationEngine`: Effect service exposing the canonical operations through
  repo-native typed errors and schema-decoded boundaries.

The engine may use different algorithms, composition, or internal files from
Python. It may not require Python, `eyecite-ts`, `eyecite-js`, a hosted parser,
native Hyperscan, or privileged off-box text at runtime.

## Existing Law-Practice Schema Migration

Apply `research/SCHEMA_DISPOSITION.md` as a binding migration ledger.

Required outcomes:

1. Remove `CitationBase` as a public catch-all. Do not inherit source evidence,
   grouping, telemetry, or warnings into every semantic citation.
2. Move `text`, `matchedText`, source span, signals tied to the occurrence,
   warnings, group membership, and footnote location into `CitationMention` or
   document evidence.
3. Move `processTimeMs` and `patternsChecked` into `CitationEngineReport`.
4. Use bounded schemas for all confidence values and place them on the evidence
   or resolution assertion they qualify.
5. Replace index-shaped `ResolutionResult` with tagged stable-ID outcomes.
6. Derive citation-type literal surfaces from union discriminants rather than
   maintaining `CitationType`, `FullCitationType`, and
   `ShortFormCitationType` as parallel lists.
7. Move `ContextOptions` into the engine request boundary.
8. Replace or internalize local `Span`, component-span, transformation-map,
   segment-map, and durable-locator contracts where the verified-span
   prerequisite owns the same semantics. Retain citation-component anchors only
   as evidence-specific composition over the canonical anchor.
9. Rebuild authority groups/history/parentheticals around stable IDs and avoid
   recursive embedded citation copies.
10. Leave unrelated patent and knowledge-graph values unchanged.

No deprecation or compatibility shim is required: the package is private, no
production consumer of the provisional citation surface is known, and the user
explicitly selected a free rebuild.

## Transformation Contract

Deterministic representation changes are schemas, not unrelated formatter
functions.

Required proof surface:

- `CitationWireFromCitation`: lossless structured citation representation with
  exact decode/encode round-trip equality.
- `BluebookCitation`: structured, tagged, source-supported presentation model.
- `BluebookFromFullCitation`: `FullCitation -> BluebookCitation`, directly
  usable as `S.decodeEffect(BluebookFromFullCitation)(citation)`.
- `BluebookTextFromBluebookCitation`: structured presentation to branded text,
  with reverse parsing only for the documented supported grammar.

Every transformation declares and tests exactly one law:

- **reversible**: decode then encode and encode then decode preserve equality;
- **canonicalizing**: round trips preserve semantic equality and yield one
  canonical representation;
- **partial**: invalid/unsupported inputs fail with typed schema issues;
- **projection**: the unsupported reverse direction fails explicitly.

Never implement an encode branch that manufactures missing semantic data.
Delete the static best-effort `FullCaseCitation.toBlueBook` helper when its
schema replacement lands. Use `Bluebook` casing in exported names.

This goal proves the transformation architecture and supported forms. It does
not claim exhaustive compliance with the Bluebook manual, and it does not
transcribe unlicensed rule text. A full rule/edition coverage program is a
separate goal.

## Parity and Evidence Rules

1. Generate oracle outputs from the pinned Python clone and commit normalized
   fixtures so CI does not depend on that external checkout.
2. Record upstream commit, source test/case ID, fixture license, generator
   version, and content hash beside every generated oracle.
3. Compare stages independently: cleaning/mapping, tokens, semantic citations,
   mentions/anchors, filtering/grouping, resolution, and annotation.
4. Normalize only declared representation differences. Python code-point
   offsets must be explicitly converted to canonical half-open UTF-16 offsets;
   the resulting raw slice must reproduce the exact matched text.
5. Treat a missing field, dropped fixture, unclassified warning, or unexplained
   span difference as a parity failure.
6. Preserve upstream regressions as focused named tests rather than only one
   monolithic snapshot.
7. Preserve the full BSD-2 terms and affected-material attribution in
   `THIRD_PARTY_NOTICES.md` for copied/adapted code, regular expressions, and
   fixtures.
8. Keep regex compatibility and adversarial timing evidence per pattern family.
   A timeout wrapper alone is not proof that a JavaScript regex is interruptible
   or safe.

## Delivery Constraint

Land the packet rebaseline, schemas, engine, oracle corpus, transforms, adopted
extensions, tests, documentation, reflection, and lifecycle updates in one
implementation PR. Local commits may separate phases for review. Do not open
incremental phase PRs; publish after local verification is green to avoid
unnecessary hosted CI executions.

The current full/short case, `Id.`, supra, 35 U.S.C., and 37 C.F.R. forms remain
the first internal vertical slice. They are an implementation order, not the
completion boundary.

## Non-Goals

- Runtime dependency on any eyecite implementation or Python environment.
- API or class-layout compatibility with Python or either TypeScript port.
- Raw vocabulary imports or duplicate stable-ID/version logic.
- Reimplementation of the verified-span substrate inside law-practice.
- Hosted parsing/grounding truth, CourtListener enrichment, citator/good-law,
  claim lifecycle, matter-wall orchestration, or editor UI.
- MPEP patterns unless separately accepted through the extension ledger.
- Full Bluebook-manual compliance.
- Automatic parity with eyecite commits newer than the pinned baseline.

## Acceptance Criteria

- [ ] The official clone is at the pinned commit; source/tree/license hashes and
      executable baseline evidence are recorded.
- [ ] Both prerequisite public contracts are complete and their exact artifact/
      anchor versions are recorded before production implementation.
- [ ] Every canonical public capability, unittest method, embedded fixture case,
      model behavior, and regex family has a ledger row and terminal proof.
- [ ] No canonical row is unreviewed, rejected, deferred, or explained only by
      an aggregate pass percentage.
- [ ] Every unique TypeScript-port capability has a final disposition; every
      adopted extension has focused regression proof.
- [ ] The schema-disposition migration is complete with no mixed semantic/
      source/diagnostic base object or duplicate prerequisite contract.
- [ ] Current first-slice forms and all remaining canonical forms preserve exact
      verified raw UTF-16 anchors.
- [ ] Cleaning, tokenization, extraction, filtering, grouping, resolution, and
      annotation differential suites have zero unexplained differences.
- [ ] Reversible, canonicalizing, partial, and projection transforms pass their
      declared property laws; unsupported directions fail explicitly.
- [ ] Regex corpus compatibility and adversarial timing justify the selected
      bounded execution strategy.
- [ ] No runtime reference dependency, raw vocabulary import, hosted parser, or
      second public citation hierarchy exists.
- [ ] Focused package tests, dtslint, schema-first lint, docgen, repo quality,
      reflection lint, and local Yeet verification pass.
- [ ] The single implementation PR reaches mergeable state with the packet
      lifecycle and reflection synchronized.

## Verification Matrix

| Check | Required evidence |
| --- | --- |
| Source baseline | Pin/tree/license hashes plus official suite execution |
| Canonical accounting | Case-level ledger has no missing or nonterminal canonical row |
| Extension accounting | Every unique TS behavior has a final disposition |
| Schema migration | Disposition ledger and source/barrel/consumer scans agree |
| Differential parity | Zero unexplained stage-level differences |
| Span fidelity | Exact raw substring at canonical UTF-16 half-open anchor |
| Transform laws | Property tests from production schemas/arbitraries |
| Regex safety | Static compatibility inventory plus adversarial runtime evidence |
| Package quality | Tests, type checks, lint, dtslint, and docgen green |
| Repo/PR quality | `bun run beep yeet verify`, hosted checks, and review green |

## Stop Conditions

- Either prerequisite is absent, incompatible, or consumable only through raw
  generated files.
- The canonical oracle cannot be pinned, executed, licensed, or normalized
  reproducibly.
- A canonical behavior would require weakened source fidelity, unbounded
  execution, hosted truth, or a parallel citation hierarchy.
- A proposed reversible transformation would need to invent information.
- Verification requires unnamed credentials, cost beyond the authorized PR
  workflow, destructive effects, or additional product authority.

## Decision Log

- **2026-07-29 capability override:** “port” means 1:1 observable capability,
  not a greenfield subset and not 1:1 source architecture.
- **2026-07-29 source hierarchy:** pinned official Python eyecite is normative;
  both TypeScript ports are differential and extension references.
- **2026-07-29 schema compatibility:** existing citation value schemas may be
  split, merged, renamed, or removed without compatibility shims.
- **2026-07-29 transformations:** use lawful schema transformations; do not
  promise fake two-way conversion for lossy operations.
- **2026-07-29 Bluebook scope:** deliver a source-supported transformation
  proof, not full manual compliance.
- **2026-07-29 delivery:** one all-in implementation PR because hosted
  Blacksmith CI is expensive.
- Earlier decisions rejecting a runtime `eyecite-js` dependency, hosted parser,
  privileged off-box text, and duplicate legal hierarchy remain in force.
- Earlier decisions limiting completion to the narrow v1 forms or preserving
  existing eyecite-ts-shaped values unchanged are superseded.

## Exception Ledger

| Exception | Scope | Owner | Removal condition |
| --- | --- | --- | --- |
| Python 3.12 baseline bootstrap | The pinned `pyahocorasick==2.0.0` fails to compile under this host's Python 3.12/C23 toolchain before tests run; Python 3.11 passes all official tests. | P0 source baseline | Record as environment evidence; oracle generation uses pinned Python 3.11 unless upstream dependencies are deliberately re-pinned in a separate baseline decision. |
