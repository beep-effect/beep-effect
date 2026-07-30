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

## Governing Authority

Apply the repository-wide packet order from `goals/README.md`:

1. the current user objective and recorded product decisions;
2. `AGENTS.md`, `CLAUDE.md`, and required skills;
3. architecture and package standards governing the target surface;
4. this `SPEC.md`;
5. `PLAN.md`;
6. `GOAL.md`; and
7. supporting `research/`, `ops/`, and `history/` files.

Repository law and architecture always outrank packet-local prose. If a
prerequisite or packet statement conflicts with a higher authority, stop and
record the conflict rather than choosing the convenient text.

## Behavioral Oracle Hierarchy

Within the governing constraints:

1. pinned official eyecite behavior, tests, fixtures, and BSD-2 license define
   canonical observable citation behavior;
2. published prerequisite contracts define canonical source-anchor and
   vocabulary representations;
3. pinned `eyecite-ts` and `eyecite-js` provide differential and extension
   evidence; and
4. earlier exploration is context only where not superseded.

The Python oracle does not decide TypeScript architecture, package ownership,
resource safety, or public representations. A TypeScript port may expose a
Python defect or useful extension but cannot silently redefine canonical
parity.

## Blocked By

- `goals/citation-verified-span-substrate` — source identity/version, verified
  raw UTF-16 anchors, normalization-to-raw mapping, straddle, ambiguity, and
  fail-closed drift behavior.
- `goals/court-reporter-vocabulary` — stable public court/reporter IDs,
  lookups, artifact version, and machine-readable compatibility classification.

Source acquisition, case inventory, regex review, oracle generation design, and
schema separation/removal decisions may proceed. No production engine contract
freezes and no P1 production implementation begins until both dependency
surfaces are public and compatible. Raw generated vocabulary files and locally
invented anchor substitutes do not clear these blockers.

P0 must create
`history/evidence/prerequisite-compatibility.md` before P1. It records exact
exported symbols, canonical import subpaths, anchor/vocabulary artifact
versions, compatibility results, approved adaptations, reviewer/date, and
reproducing commands. Until that gate is approved, exact prerequisite-derived
fields, brands, imports, versions, and codecs in this packet are provisional;
the separation, ownership, removal, and no-duplicate-truth decisions are
binding now.

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

Source inspection may create an `unresolved` audit row but cannot prove an
extension. Installing or executing either donor suite requires explicit user
authorization, the pinned checkout, and its frozen lockfile. P0 records the
exact command, tool versions, commit/tree, before/after clean status, and result.
It may not edit donor lockfiles, install globally, or treat a dependency-blocked
suite as green.

The audit includes, at minimum, stable citation IDs, segment maps, false-positive
filters, granular legal-form extractors, typed parse errors, court/pincite
normalization, document/scope resolution, footnotes, document analysis and
citation graphs, durable locators/context helpers, Bluebook utilities,
`IdLawCitation`, `DOLOpinionCitation`, overlap modes, HTML annotation, and
Id.-section substitution.

## Target Ownership and Architecture

Generic verified source provenance stays in its prerequisite owner. The engine
may use different algorithms, composition, or internal files from Python. It
may not require Python, `eyecite-ts`, `eyecite-js`, a hosted parser, native
Hyperscan, or privileged off-box text at runtime.

All public and inter-stage data is the decoded type of an annotated Effect
schema. Service contracts may be interfaces; citations, tokens, requests,
results, warnings, error payloads, fixtures, limits, and transforms may not be
hand-authored data interfaces.

### Publication boundary

| Surface | Canonical owner/export | Boundary rule |
| --- | --- | --- |
| `Citation`, derived full/short subsets, `CitationMention`, document-local IDs, resolution/document values, and structured Bluebook schemas | `@beep/law-practice-domain/values` through one citation concept barrel | Legal semantics and evidence composition only; no engine service, run telemetry, or callback values. |
| Raw-text request, server options, `CitationEngineLimits`, `CitationEngineReport`, action errors, cleaner/tokenizer ports, and `CitationEngine` service contract | `@beep/law-practice-use-cases/server` | Server-only. Full source text and server services never export from package root or `/public`. |
| Fixture schemas, fakes, oracle case helpers, and parity harness support | `@beep/law-practice-use-cases/test` | Test-only; production code cannot import this subpath. |
| Live engine, cleaner/tokenizer adapters, and composed Layer | `@beep/law-practice-server/layer` | Implementation and dependency composition; no contract redefinition. |
| Client-safe citation API | none in this goal | Add only after a concrete consumer and a redacted, raw-text-free contract pass separate boundary review. |

Package `README.md`, `package.json` exports, source barrels, dtslint imports,
JSDoc examples, and docgen proof must agree with this table. Intermediate
tokens/candidates remain private unless a demonstrated external consumer
requires a reviewed schema.

### Conceptual surface

- `Citation`: tagged semantic union containing legal meaning only.
- `FullCitation` and `ShortFormCitation`: schema-derived tagged-union subsets.
- `CitationMention`: one semantic citation, document-local mention ID, verified
  source anchor, exact matched text, component anchors, and typed warnings.
- `CitationResolution`: tagged `Resolved | Ambiguous | Unresolved` outcomes
  using brand-separated IDs, never array positions.
- `CitationDocument`: mentions, authority groups, references, and resolution
  relationships.
- `CitationEngineInput`: server-only source identity/text plus schema-defined
  operation options.
- `CitationEngineReport`: deterministic counts/versions/safety decisions and
  nondeterministic timing, separate from semantic citations.

`CitationMentionId` identifies one occurrence inside one source version and
is reproducible for the same source version, engine artifact version, verified
anchor, and semantic discriminant. It remains stable through pipeline stages,
consumer reordering, and an identical replay, but changes when those identity
inputs change. `CitationAuthorityId` identifies an authority group within a
`CitationDocument` and is reproducible from its versioned semantic authority
key. Neither is a persisted entity ID; the brands are not interchangeable.

The shared `LawPractice.CitationId` in
`@beep/shared-domain/identity/LawPractice` is reserved for a persisted citation
entity assigned at the persistence boundary. The engine must remove/rename the
current donor-shaped law-practice `CitationId`; it must not redefine or shadow
the shared entity ID. Internal pre-mention candidates may use a private
`CitationCandidateId`, but no public candidate ID is added without a consumer.

### Service and injectable behavior

`CitationEngine` is a `Context.Service` exported from the server use-case
subpath. It exposes cleaning, extraction, resolution, and annotation operations.
Every method returns `Effect<Output, ClosedActionError, never>`: all
dependencies are captured when constructing the live Layer.

Named cleaning/tokenizer modes and options use schema literals. Canonical
callable-cleaner/custom-tokenizer behavior is represented by explicit
server-only `CitationCleaner` and `CitationTokenizer` service ports and their
Layers, never by function-valued request or schema fields. The live
implementation and port adapters belong to law-practice server.

## Existing Law-Practice Schema Migration

Apply `research/SCHEMA_DISPOSITION.md` as the binding separation, ownership,
removal, and duplicate-truth ledger. Exact prerequisite-derived field/import/
version choices remain provisional until the compatibility gate.

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

No deprecation or compatibility shim is currently required: the package is
private, the recorded source/barrel/import scan found no production consumer of
the provisional citation surface, and the user explicitly selected a free
rebuild. Repeat the exact recorded scan immediately before deletion and at
close. A newly discovered production consumer pauses deletion and requires a
dated bridge/removal decision; `private: true` alone is not consumer evidence.

## Transformation Contract

Deterministic representation changes are schemas, not unrelated formatter
functions. Every Effect schema already defines decoded `Type`, `Encoded`, and
decode/encode operations; do not add `CitationWireFromCitation` merely to
rename the normal encoded form. A materially different, versioned transport
envelope requires a demonstrated consumer and a separate schema.

Every transform declares two orthogonal properties:

1. **information law** — `reversible`, `canonicalizing`, or `projection`; and
2. **directional totality** — `total` or `partial` independently for decode and
   encode.

| Symbol | Encoded input to decode | Decoded output | Decode | Encode | Information law |
| --- | --- | --- | --- | --- | --- |
| `Citation` | `Citation.Encoded` | `Citation.Type` | total for valid encoded data | total for valid semantic members | Reversible, except explicitly annotated constructor/default canonicalization. |
| `BluebookFromFullCitation` | `FullCitation.Type` | `BluebookCitation.Type` | partial for unsupported full-citation forms | total because the structured Bluebook union represents only supported forms | Canonicalizing; supported decode→encode preserves semantic citation equality. |
| `BluebookTextFromBluebookCitation` | `BluebookCitation.Type` | `BluebookText.Type` | total structured rendering | partial parsing of the documented grammar | Canonicalizing; parse/render converges on one supported text form. |

`BluebookFromFullCitation` must deliberately use `S.toType(FullCitation)` as
its source side, or a proven equivalent whose `Encoded` is exactly
`FullCitation.Type`, so this call type-checks:

```ts
const bluebook = S.decodeEffect(BluebookFromFullCitation)(citation)
```

Its reverse call
`S.encodeEffect(BluebookFromFullCitation)(bluebook)` returns a semantically
equivalent `FullCitation.Type`. Unsupported decoded forms fail with a typed
schema issue through `SchemaTransformation.transformOrFail`; encode may not
manufacture missing legal data. Dtslint must prove both exact calls and their
inferred Effect types.

`BluebookTextFromBluebookCitation` renders on decode and parses on encode.
Property tests cover both directions and unsupported/ambiguous text. A future
projection must declare the unsupported reverse direction and fail it
explicitly.

Delete the static best-effort `FullCaseCitation.toBlueBook` helper when its
schema replacement lands. Use `Bluebook` casing in exported names.

This goal proves the transformation architecture and supported forms. It does
not claim exhaustive compliance with the Bluebook manual, and it does not
transcribe unlicensed rule text. A full rule/edition coverage program is a
separate goal.

## Action Errors and Boundary Translation

Ambiguous, unresolved, unknown, filtered, and unsupported citation meanings are
schema-modeled domain outcomes, not Effect failures.

The server use-case subpath owns a closed union of annotated
`TaggedErrorClass` action errors:

- `CitationInputError` for request/schema boundary failures;
- `CitationPrerequisiteError` for incompatible or unavailable
  anchor/vocabulary contracts;
- `CitationSafetyLimitExceeded` for any deterministic resource or deadline
  limit;
- `CitationAnnotationError` for invalid replacement/markup operations; and
- `CitationOperationUnsupported` only for an explicitly unsupported requested
  mode, never for a missing canonical capability.

At the service boundary, translate schema issues and every prerequisite/port
error into that closed union. Methods may not leak `ParseError`, donor
exceptions, adapter errors, or open `unknown` failures. Defects are reserved for
violated internal invariants. Each translator needs focused tests, including
payload redaction. Emit a structured server log/span event when useful
technical detail is intentionally dropped, without including raw source text.

## Resource and Regex Safety

P0 freezes an annotated `CitationEngineLimits` schema and its numeric
defaults/maxima before P1. Server Layer configuration owns the caps; a request
may only choose equal or tighter limits. At minimum, bound:

- source UTF-16 code units;
- candidate, token, mention, and authority counts;
- pattern evaluations and matches;
- resolution edges/iterations;
- annotation replacements and output/diff growth;
- concurrency; and
- per-stage deadlines represented with `Duration`.

Limit exhaustion fails with `CitationSafetyLimitExceeded`; never silently
truncate a parity result. Use bounded Effect concurrency and Effect
`Clock`/`Duration` services. A timeout around synchronous JavaScript regex does
not make that regex interruptible.

Every accepted pattern family needs static compatibility review, a literal
prefilter/routing decision, deterministic work caps, and a committed
adversarial benchmark using geometric sizes, warmups/repetitions, and
environment metadata. No family may exceed a `3.5x` median-time increase for
two consecutive input doublings. A seeded catastrophic negative-control
pattern must fail. Absolute wall-clock latency is informational.

Prefer rewritten/static-safe JavaScript patterns. If a canonical family cannot
be proven within the caps, either reject the implementation strategy and stop,
or isolate it in a killable worker boundary approved and recorded during P0.

## Observability and Determinism

The server operation spans are:

- `law_practice.citation.clean`;
- `law_practice.citation.extract`;
- `law_practice.citation.resolve`; and
- `law_practice.citation.annotate`.

Prerequisite/port calls receive child spans; technical adapter spans stay in the
server Layer. Allow only bounded, low-cardinality attributes such as operation
mode, outcome tag, counts, limit kind, anchor/vocabulary versions, and pattern
family ID. Never emit source text, matched text, rendered citations, regex
bodies, replacement bodies, arbitrary metadata, PII, secrets, or unbounded
identifiers.

`CitationEngineReport` complements tracing; it does not replace it. Semantic
fixtures and content hashes exclude elapsed timing. Deterministic counts,
versions, ordering, limit decisions, and outcome tags compare exactly. Timing
uses Effect `Clock`/`Duration` and is tested with `TestClock` or invariant
bounds, never exact host milliseconds.

## Parity and Evidence Rules

1. Independently enumerate the pinned source/tests/fixtures/regex families and
   export instrumented runtime cases. Commit both inventories; reconcile their
   case IDs rather than trusting one hand-written list.
2. Generate normalized fixtures from the pinned Python clone so CI does not
   depend on that external checkout.
3. Record upstream commit/tree, source file/method/case ID, source-content hash,
   fixture license, generator version, and fixture hash beside every oracle.
4. Compare stages independently: cleaning/mapping, tokens, semantic citations,
   mentions/anchors, filtering/grouping, resolution, and annotation.
5. Normalize only declared representation differences. Python code-point
   offsets must be explicitly converted to canonical half-open UTF-16 offsets;
   the resulting raw slice must reproduce the exact matched text.
6. Treat a missing field, dropped fixture, unclassified warning, or unexplained
   span difference as a parity failure.
7. Preserve upstream regressions as focused named tests rather than only one
   monolithic snapshot.
8. Preserve the full BSD-2 terms and affected-material attribution in
   `THIRD_PARTY_NOTICES.md` for copied/adapted code, regular expressions, and
   fixtures.
9. Keep regex compatibility and adversarial timing evidence per pattern family.
   A timeout wrapper alone is not proof that a JavaScript regex is interruptible
   or safe.

P0 commits the exact artifacts and checker defined in `PLAN.md`. The
`citation:parity-check` script independently rejects missing/duplicate cases,
unknown or composite states, incomplete canonical proof, unproved adopted
extensions, follow-ups without an existing successor goal, missing licenses/
hashes/tests, unexplained divergences, and unaccounted regex families.
Deliberately corrupted negative fixtures prove every rejection path.

## Delivery Constraint

Land the packet rebaseline, schemas, engine, oracle corpus, transforms, adopted
extensions, tests, documentation, reflection, and lifecycle updates in one
implementation PR. Local commits may separate phases for review. Do not open
incremental phase PRs; publish after local verification is green to avoid
unnecessary hosted CI executions.

The current full/short case, `Id.`, supra, 35 U.S.C., and 37 C.F.R. fixtures
remain the first internal vertical slice. They are an implementation order, not
the completion boundary. Official `FullLawCitation` owns canonical U.S.C.
behavior. P0 audits C.F.R. field by field against canonical law behavior and
classifies only genuinely additional, independently proved semantics as an
extension.

Both prerequisite contracts and the compatibility record must be complete
before P1. Each phase ends in a focused local green commit and archived
evidence. No public completion/stability claim is made until every phase closes.
If one-PR delivery becomes unreviewable or unverifiable, stop for direction
instead of silently splitting delivery or weakening scope.

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

- [ ] Captured live-oracle evidence confirms the pinned commit and executable
      suite; committed source/tree/license hashes make that baseline portable.
- [ ] Both prerequisite public contracts are complete and their exact artifact/
      anchor versions/imports/compatibility are recorded before production
      implementation.
- [ ] Static source inventory and runtime oracle export reconcile exactly; the
      executable accounting checker and every negative control pass.
- [ ] Every canonical public capability, unittest method, embedded fixture case,
      model behavior, and regex family has a ledger row and complete proof.
- [ ] No canonical row is unresolved, rejected, deferred, or explained only by
      an aggregate pass percentage.
- [ ] Every unique TypeScript-port capability has a final disposition; every
      adopted extension has focused regression proof.
- [ ] The schema-disposition migration is complete with no mixed semantic/
      source/diagnostic base object, ambiguous citation identity, or duplicate
      prerequisite contract.
- [ ] Current first-slice forms and all remaining canonical forms preserve exact
      verified raw UTF-16 anchors.
- [ ] Cleaning, tokenization, extraction, filtering, grouping, resolution, and
      annotation differential suites have zero unexplained differences.
- [ ] Every transform's information law and decode/encode totality pass
      production-schema property tests and exact dtslint call proofs.
- [ ] `CitationEngine` ownership, `R = never` methods, closed action errors, and
      every boundary translator pass contract tests.
- [ ] `CitationEngineLimits`, bounded concurrency, regex compatibility,
      adversarial growth/negative control, and nontruncating limit failures
      justify the selected execution strategy.
- [ ] Operation spans, attribute allowlist/redaction tests, deterministic report
      fields, and `Clock`/`Duration` timing tests pass.
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
| Canonical accounting | Independent source/runtime inventories plus executable zero-missing/duplicate/nonterminal query |
| Extension accounting | Every unique TS behavior has a final disposition, proof, and successor where required |
| Schema migration | Disposition ledger and source/barrel/consumer scans agree |
| Differential parity | Zero unexplained stage-level differences |
| Span fidelity | Exact raw substring at canonical UTF-16 half-open anchor |
| Transform laws | Direction/type dtslint plus two-axis property tests from production schemas/arbitraries |
| Service/errors | Boundary ownership, `R = never`, closed-error and translator tests |
| Regex/resources | Static inventory, exact work caps, adversarial growth gate, and catastrophic negative control |
| Observability | Named spans, low-cardinality redaction, deterministic report and Effect Clock proof |
| Package quality | Tests, type checks, lint, dtslint, and docgen green |
| Repo/PR quality | `bun run beep yeet verify`, hosted checks, and review green |

## Stop Conditions

- Either prerequisite is absent, incompatible, or consumable only through raw
  generated files.
- The canonical oracle cannot be pinned, executed, licensed, or normalized
  reproducibly.
- A canonical behavior would require weakened source fidelity, unbounded
  execution, hosted truth, or a parallel citation hierarchy.
- A declared reversible/canonicalizing encode direction would need to invent
  information.
- Verification requires unnamed credentials, cost beyond the authorized PR
  workflow, destructive effects, or additional product authority.

## Decision Log

- **2026-07-29 capability override:** “port” means 1:1 observable capability,
  not a greenfield subset and not 1:1 source architecture.
- **2026-07-29 behavioral oracle:** pinned official Python eyecite is normative
  for observable citation behavior within repo law; both TypeScript ports are
  differential and extension references.
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
