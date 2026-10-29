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
4. it preserves deterministic execution, exact source fidelity, and
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
| Raw-text request, server options, hard `CitationEngineLimits`, `CitationEngineReport`, closed server failures, cleaner/tokenizer ports, and `CitationEngine` service contract | `@beep/law-practice-use-cases/server` | Server-only. Full source text and server services never export from package root or `/public`. |
| Fixture schemas, fakes, oracle case helpers, and parity harness support | `@beep/law-practice-use-cases/test` | Test-only; production code cannot import this subpath. |
| Live engine plus cleaner/tokenizer adapter implementations | private modules inside `@beep/law-practice-server` | Never exported. Slice-local composition may use them; apps and other packages may not. |
| One composed law-practice slice Layer (or typed constructor for it) | `@beep/law-practice-server/layer` | The only public server composition surface; it does not re-export implementations or individual adapters. |
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
- `CitationDocument`: verified mentions, detached semantic objects, authority
  catalog, ordered resource groups, shared member-list nodes and per-mention
  resolution decisions. Lists alone own ordered group membership, including
  empty presence and repetitions; decisions do not imply final assignment.
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
Every method returns `Effect<Output, CitationEngineFailure, never>`: all
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
   warnings, and footnote location into `CitationMention` or document evidence.
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
9. Make `CitationDocument` the only encoded owner of authority/parallel/string
   group membership. Mention-level lookup is a derived projection. Rebuild
   history/parentheticals around stable IDs and avoid recursive embedded
   citation copies.
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
schema issue through `SchemaTransformation.transformEffect`; encode may not
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

## Server Failures and Boundary Translation

Ambiguous, unresolved, unknown, filtered, and unsupported citation meanings are
schema-modeled domain outcomes, not Effect failures.

This goal intentionally stops at a server-only service/port boundary: it has no
client/protocol consumer. The server use-case subpath owns a closed union named
`CitationEngineFailure`, composed of annotated `TaggedErrorClass` values:

- `CitationInputError` for request/schema boundary failures;
- `CitationPrerequisiteError` for incompatible or unavailable
  anchor/vocabulary contracts;
- `CitationSafetyLimitExceeded` for any deterministic resource or deadline
  limit;
- `CitationAnnotationError` for invalid replacement/markup operations; and
- `CitationOperationUnsupported` only for an explicitly unsupported requested
  mode, never for a missing canonical capability.

These are not public action failures and must not export from `/public`.
Adapters translate driver/internal errors to their declared port failures. The
`CitationEngine` service translates schema and prerequisite/port failures to
`CitationEngineFailure`. Methods may not leak `ParseError`, donor exceptions,
adapter errors, or open `unknown` failures. Defects are reserved for violated
internal invariants. Each retained translator needs focused tests, including
payload redaction.

A future client/protocol consumer must separately add client-safe public action
failures under `/public`, translate server failures to action failures in its
use case, and translate action failures to protocol shapes. It may not expose
or pass through this server union. Emit a structured server log/span event when
useful technical detail is intentionally dropped, without including raw source
text.

## Resource and Regex Safety

P0 freezes an annotated `CitationEngineLimits` schema and its numeric absolute
maxima before P1. These maxima are non-configurable use-case safety invariants.
It also defines a schema-decoded effective policy whose values cannot exceed
those maxima. At minimum, bound:

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

This goal does not create a slice config package. The exported
`@beep/law-practice-server/layer` constructor requires the decoded effective
policy explicitly; its private implementations receive no ambient
configuration. Provide deterministic default/test fixtures through
`@beep/law-practice-use-cases/test`, and test the slice Layer with an explicit
fixture. Domain, use-cases, and server internals may not call `process.env`,
`Config`, or an ambient `ConfigProvider`.

If operator-configurable ambient defaults are later required, stop and create
the optional canonical `@beep/law-practice-config` package with `/server`,
`/layer`, and `/test` subpaths using Effect `Config`/`ConfigProvider`; do not
smuggle environment reads into this implementation.

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

1. Independently enumerate the pinned source/tests/fixtures/regex families as
   tagged row kinds and export instrumented runtime cases. Commit both
   inventories; reconcile compatible projections rather than trusting one
   hand-written list.
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

P0 commits the exact artifacts and checker defined in `PLAN.md`. It compares
case declarations/runtime events/canonical cases, capability/model sources/
capability rows, regex-family sources/regex rows, and fixture sources/
provenance rows as separate compatible projections. The
`citation:parity-check` script independently rejects missing/duplicate cases,
unclassified source rows, unknown or composite states, incomplete canonical
proof, unproved adopted extensions, follow-ups without an existing successor
goal, missing licenses/hashes/tests, unexplained divergences, and unaccounted
regex families. Deliberately corrupted negative fixtures prove every rejection
path.

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
- [ ] `CitationEngine` ownership, `R = never` methods, closed server failures,
      explicit limits Layer input, and every retained boundary translator pass
      contract tests.
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
| Service/errors/config | Boundary ownership, `R = never`, closed server failures, explicit Layer policy, no ambient reads, and translator tests |
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
  [redacted-vendor] CI is expensive.
- Earlier decisions rejecting a runtime `eyecite-js` dependency, hosted parser,
  privileged off-box text, and duplicate legal hierarchy remain in force.
- Earlier decisions limiting completion to the narrow v1 forms or preserving
  existing eyecite-ts-shaped values unchanged are superseded.

- **2026-10-28 prerequisite admission:** public source/anchor and vocabulary
  contracts are present and pass focused consumer tests; exact symbols,
  versions and approved adaptations are recorded in
  `history/evidence/prerequisite-compatibility.md`. The dependency hold is
  cleared; P0 accounting and safety gates still block P1.
- **2026-10-28 source isolation:** preserve the shared reference checkouts and
  execute exact pins in detached cache worktrees. This is reversible by
  removing those task-owned worktrees after retaining required evidence.
- **2026-10-28 donor baseline environment:** the user authorized both donor
  installs. An npm-configuration incompatibility is isolated process-locally
  with install scripts disabled; workstation and donor configuration stay
  intact. Remove the environment override to reproduce the initial failure.

- **2026-10-28 Effect API adaptation:** the checked Effect 4.0.6 source
  exposes `SchemaTransformation.transformEffect` for fallible transforms;
  `transformOrFail` is absent. Use the current API with typed schema issues,
  preserving every information/directional law and exact Bluebook call proof.
  The byte-preserving oracle fixture codec proves this boundary with encode
  rejection tests. This is an API spelling adaptation, not a parity waiver;
  reverse it only if a future pinned Effect version changes that API.

- **2026-10-28 oracle environment:** freeze `PYTHONHASHSEED=0` and the
  oracle clock date in operation corpus metadata. Unseeded runs changed
  set-derived tokenizer configuration order without changing observed stage
  outputs. Pinning interpreter inputs preserves actual seeded execution rather
  than sorting an executable configuration after the fact. Remove the startup
  gate only with an explicit, re-proved oracle environment update.

- **2026-10-28 representation normalization:** exact/variation/all-edition
  candidate bags are unordered ambiguity data. The oracle merges them through
  sets and selects an edition only when one candidate remains. Normalize these
  bags by artifact identity while retaining every candidate, multiplicity,
  selected edition and decision. Six changed case pairs prove no other value
  differs in two seeded runs; the retained receipt is
  `history/evidence/edition-candidate-order.json`. Restore raw bag order only
  with a new declared comparison rule and deterministic oracle proof.
  **2026-10-29 qualification:** actual law/journal ResourceCitation hashing
  stably sorts editions by abbreviation. Distinct editions with tied
  abbreviations retain their relative order and can change the resource hash.
  The deterministic counterexample and revised rule are recorded in
  `history/evidence/2026-10-29-publication-resource-hashes.md`. Candidate-bag
  normalization is representation-only; retain raw order separately wherever
  observable hashing requires it. Sorted evidence bags cannot reconstruct
  discarded raw order. Exact runtime equality supersedes the older bag-based
  authority fallback for these cases; adapter/corpus integration remains open.

- **2026-10-29 independent edition state:** source all_editions mutations
  retain edition_guess, including after clearing the candidate list. The
  provisional semantic codecs therefore retain selectedEdition independently
  of candidate membership. Actual case/law/journal publication snapshots and
  mixed dictionary behavior are recorded in
  `history/evidence/2026-10-29-mixed-resource-objects.md`. Artifact-kind/content
  validation remains at the engine boundary; structural semantics do not
  attest parser output. This correction grants no semantic parity waiver.

- **2026-10-28 vocabulary vintage separation:** consume current public stable
  court/case-reporter IDs while preserving reporters-db 3.2.53/courts-db 0.10.22
  parser metadata, edition dates and court selection order. Three exact legacy
  tuple transitions and all metadata differences are retained in
  `history/evidence/2026-10-28-vocabulary-version-mapping.md`. Law/journal
  publications remain their canonical legal citation families; no synthetic
  public ReporterId is issued. A shared current reporter ID must not collapse
  frozen authority groups: the CIT probe retains two separate resources for
  the two legacy corrected reporter spellings. Reverse only through a reviewed
  parser-data
  version change and regenerated compatibility/parity proof.

- **2026-10-28 safety policy:** freeze the 29-field numeric/Duration ceilings
  and explicit fixture in `CitationEngineLimits` / `CitationEngineEffectivePolicy`.
  Select parent-owned force-stoppable processes for native regex execution;
  an Effect timeout plus the standard worker's five-second graceful finalizer
  is insufficient. Twelve Node/Bun controls confirm parent responsiveness and
  owned-child cleanup, with no pattern-family approval implied. The detailed
  counter/queue/deadline/cleanup contract is retained in
  `history/evidence/2026-10-28-limits-isolation-contract.md`. Reverse only with
  a reviewed policy-version change and equivalent bounded execution proof.

- **2026-10-28 portable gate composition:** the package command defaults to
  completion mode and sends `--complete` to ledger and donor validators.
  Explicit `--audit` checks the available evidence components without
  asserting parity. Require fixed repository verifier entrypoints for
  divergences, regex benchmarks, supplemental probes and target parity; their
  absence fails completion. Fixtures never supply executable commands. The
  future entrypoints take `--fixtures` and `--evidence` paths, must independently
  validate their full proof scope, and must reject absent or incomplete proof.
  Their implementations remain open; adding files alone is not evidence.
  Reverse by changing the fixed composition with equivalent rejection controls.

- **2026-10-28 supplemental extraction:** integrate 13 focused probes as an
  eighth portable audit component, with exact Python/UTF-16 coordinates,
  equality and authority membership. Keep the CIT identity-merger observation
  linked to its original evidence. The pinned oracle classifies the probed
  U.S.C. and C.F.R. examples as `FullLawCitation`; neither is an extension.
  The supplemental verifier now exists but rejects completion while its target
  proof or five named coverage families remain open. Divergence, benchmark
  and exhaustive target verifiers remain absent. Reverse or expand this
  projection through the authored plan, schema and equivalent controls.

- **2026-10-28 supplemental text revision:** advance the test-only bundle to
  `citation-supplemental-extraction/v2` for 26 cleaning/annotation probes and
  source-bound mapping traces. Preserve the 13 extraction probes. Zero-width
  annotation points are validated through nonempty prefix conversion and are
  never constructed as verified ranges. The oracle can choose a repeated
  source occurrence or collapse a deleted occurrence to an empty insertion.
  These results remain explicit fidelity/anchoring review obligations before
  target readiness; no divergence or weakened raw-anchor contract is approved.
  Reverse through a schema/version and corpus migration with equivalent proof.

- **2026-10-28 warning evidence:** require explicit warning arrays for every
  supplemental text observation, including empty arrays; preserve logger,
  severity, template and arguments separately. Advance the fixture to v3 and
  the text plan to v2. The skip-mode warning is checked oracle data, not an
  instruction to log raw citation text in the engine. Target diagnostic
  translation/redaction remains required. Public consumer tests retain the
  ambiguous-locator and nonempty-anchor boundaries. Reverse only through a
  schema/corpus migration with equivalent warning and anchor controls.

- **2026-10-28 divergence accounting:** retain eleven source-bound
  representation laws and four case-bound fidelity questions in the test-only
  `citation-divergences/v1` ledger. Require each planned focused test identity
  and source-bound receipt before its row can complete; the execution producer
  and target tests remain future work. No semantic waiver variant exists.
  Cataloguing a law does not authorize dropping a mismatch. The ninth audit
  component checks accounting; final target comparison still must reject every
  difference without a proved applicable rule. Reverse or extend through the
  reviewed plan, schema and equivalent corruption controls.

- **2026-10-28 regex benchmark contract:** freeze twelve adversarial recipes
  at ten exact UTF-16 sizes, two warmups, five samples and the strict
  greater-than-3.5 ratio rule for two consecutive doublings. Native control
  execution is serialized in owned child processes with a one-second lifetime
  watchdog and confirmed cleanup; this maintainer guard includes startup and
  does not replace production policy deadlines. The source-only projection
  excludes mutable workflow/proof fields, avoiding circular receipt hashes.
  Every family/instance approval remains open pending review, routing, work
  caps, positive cases and full geometric results. Reverse through a versioned
  protocol/corpus migration with equivalent positive and negative controls.

- **2026-10-28 identity foundations:** separate versioned `cm1:` occurrence
  and `ca1:` authority tokens, each with the public shared `Sha256Hex`
  constraint and a distinct brand. The schema validates format only; source,
  engine, anchor and semantic-key digest production remains unimplemented.
  Shared persisted `LawPractice.CitationId` stays distinct. A frozen migration
  surface and compiler-based consumer scan retain review findings before any
  legacy removal. Limited P1 foundations overlap unfinished P0 target proof
  after the explicit prerequisite and limits holdpoints pass; neither phase
  is complete. Reverse these additive tokens before consumers bind them, or
  use a versioned migration once producers exist; never weaken anchor or
  historical authority distinctions to preserve a token.

- **2026-10-28 occurrence digest protocol:** the private cm1 producer requires
  a genuine prerequisite `VerifiedTextAnchor`, hashes an ordered JSON tuple
  with every source identity field, the engine artifact digest, semantic
  discriminant and exact UTF-16 range/quote, and emits only a mention token.
  Structural receipts require source re-verification. Neither stage ordering
  nor grouping enters identity. Internal failures retain only a finite reason;
  the future engine boundary must map them into its closed union. The engine
  artifact producer and semantic-union integration remain unfinished. Any
  protocol/input change requires a new token version and migration; do not
  silently reinterpret cm1. Authority-key generation remains separately open.

- **2026-10-28 canonical law rebaseline:** replace the two provisional
  statute/regulation shapes with one `FullLawCitation` in the existing union.
  Preserve canonical legal component strings, missing versus explicit-null
  keys, textual metadata and edition artifact identities; C.F.R.'s numeric
  prefix remains `chapter` while U.S.C.'s remains `title`. The oracle defines
  component names as non-exhaustive, so the schema retains unknown legal
  component names instead of silently discarding them. Keep publication kind
  validation and artifact resolution at the engine boundary. Remove the
  unused statute coordinate model and independent type literal lists. No
  residual donor behavior is accepted or rejected by this schema migration.
  Reversal requires another evidenced semantic mapping and consumer migration,
  not compatibility aliases or a parallel hierarchy.

- **2026-10-28 canonical model rebaseline:** replace the recursive case/Id/
  supra/short-case cluster and provisional journal with source-backed semantic
  forms, adding canonical named reference and unknown branches to the existing
  union. Reuse component, publication and locator/date schemas across forms.
  Case editions retain historical refs alongside versioned public reporter
  identities. Courts are either versioned public identities or explicit
  unmapped data; source lookup and compatibility verification remain engine
  duties. Preserve textual metadata and name enrichment without embedded
  citations, telemetry or source coordinates. Remove the old ad-hoc formatter;
  lawful structured Bluebook codecs remain an open P1 requirement. Reversal
  requires an evidenced field/consumer migration, not aliases or recursion.

- **2026-10-28 provisional contract retirement:** remove the remaining mixed
  base, local occurrence ID, generic warning/resolution bags, duplicate
  span/locator models, embedded relationship copies and unproved extension
  stubs. Keep all donor obligations open until their final evidenced
  disposition. Preserve the existing non-citation `SourceRef` selector by
  relocating `TextQuote` with its encoded shape and annotation identity intact;
  it is unverified review data, not a citation anchor or locator replacement.
  New mentions and document relationships must use the prerequisite proof and
  role-specific IDs. Reintroduction requires the target ownership contract and
  source/regression proof, not recovery of a provisional public alias.

- **2026-10-28 verified mention composition:** compose semantic citations with
  genuine prerequisite anchor proofs and role-specific cm1 identity. Persist
  only the explicit versioned structural receipt. Restore against trusted
  expected source/engine identity and raw text, reverify all anchors and
  recompute cm1. Snapshot mutable inputs before hashing. Neither receipts nor
  mention IDs authenticate semantic metadata. Named components share a source;
  optional footnote zones contain the primary token. Detection, warning
  emission, document relationships and full runtime budgets remain unproved.
  Reversal requires equivalent proof and persistence boundaries with consumer
  migration, not decoding structural receipts as opaque runtime capabilities.

- **2026-10-28 authority digest protocol:** produce ca1 from a versioned ordered
  semantic key. Ordinary cases use volume/page and frozen corrected reporter;
  missing-page cases bind the verified occurrence ID to preserve conservative
  uniqueness. Law/journal keys retain all legal groups and the complete edition
  bag with multiplicity, under the declared bag-order normalization law.
  Metadata and current reporter aliases do not collapse historical authority
  distinctions. A trusted artifact adapter supplies the selected spelling;
  the private helper checks reference coherence but does not authenticate
  adapter content or occurrence identity. The live Layer must establish both.
  Focused resource equality and protocol vectors are proof of this helper,
  not extraction or full resolution parity. Protocol changes require a new
  ID version and migration rather than a silent ca1 reinterpretation.

- **2026-10-28 document relationship ownership:** make resolved mention-to-
  authority edges the sole encoded authority membership. Authority records
  reference a full mention representing the resource; derive ordered members
  from document mentions and resolved edges. Ambiguous candidates are not
  membership. Require one outcome per mention, unique IDs, closed references,
  coherent source/engine identity and full representatives resolved to their
  own authority. Reuse the same graph check for structural document receipts;
  those receipts cannot issue runtime anchor proofs. Whole-document server
  production/restoration and resolver correctness remain open. Reversal needs
  equivalent coherence/persistence proof and a consumer migration, not a second
  member array or mention-level group pointer.

- **2026-10-28 whole-document persistence:** snapshot all structural document
  data and trusted edition descriptors before hashing. Project only after
  recomputing every occurrence ID and every resolved full default authority
  key, including non-representative members. Restore against one verified
  canonical source capability shared by every anchor; recheck source/engine,
  occurrence IDs, full authority keys and final graph coherence. Keep failures
  private and sanitized. Descriptor spelling, expected identity and installed
  artifact authentication remain live Layer duties. These helpers do not
  attest classification or short resolution. Canonical custom resource keys
  still need explicit ports/policy and proof; no behavior is rejected here.
  Reversal requires equivalent source/identity/mutation proof, not trusting
  structural receipts as capabilities or checking only representatives.

- **2026-10-28 resolver text fidelity:** preserve the exact strip_punct
  substitution order and frozen Python 3.11.15 / Unicode 14 digit, decimal and
  whitespace facts. Do not substitute JavaScript whitespace or numeric
  conversion. Use arbitrary-precision decimal comparison for Id. with the
  canonical inclusive 150-page range and frozen 4,300-digit conversion policy.
  Preserve missing/null page distinctions and source conversion/type failures
  through sanitized private errors. Full resolver integration, boundary mapping
  and regex-family safety remain open. Reverse only through a new oracle
  baseline and equivalent Unicode/numeric/punctuation comparison evidence.

- **2026-10-28 default resolver integration:** process verified mentions in
  caller order with immutable pre-hash snapshots. Preserve first full resource
  representatives, corrected reporter/volume matching, antecedent refinement,
  exact all-metadata name matching and Id. reset/page rules. Retain ambiguous
  candidates as data without membership. Preserve lazy reporter-field access:
  missing-page identity and selected corrections do not require a raw reporter,
  while an actual unselected short comparison may fail. Check basic published
  count budgets without claiming full deadlines/isolation. The focused corpus
  is semantic-context proof, not target extraction or exhaustive parity.
  Custom resource ports/key policy and final boundary mapping remain open.
  Reverse only through equivalent source/state/identity/budget evidence.

- **2026-10-28 operation-bound resolution proof:** project every committed
  default resolution observation through its source payload and immutable
  edition hashes. Require the exact corpus digest, 30 unique observation IDs,
  two sites, 94 mentions, all five default callbacks and all eight canonical
  families. Compare source membership indices directly rather than copying
  expected groups. Overlapping offsets from separately extracted fragments
  require explicit constructed witness text for semantic-only evaluation;
  original source coordinates remain unchanged and unproved by this lane.
  Custom callback, helper/assertion, extraction and complete parity proof stay
  open. Reverse only with equivalent provenance/no-drop/source-group checks.

- **2026-10-28 custom resolver contract gap:** pinned callback probes show that
  short/supra/reference/Id. callbacks can introduce resources without any full
  mention. The current full-representative authority schema is therefore only
  sufficient for the default path; do not force custom results into it or
  claim custom-resource parity. Preserve the source observations and adapt
  authority representation, key production, persistence checks and port state
  together before enabling custom resolution. Callable mutation, falsy keys
  and resource equality require explicit source-bound treatment; no divergence
  or immutable-state substitution is approved by this observation. Reversal
  is removal of the focused probe/evidence checkpoint; existing target behavior
  and the canonical accounting rows remain unchanged.

- **2026-10-28 general authority representative:** replace the provisional
  `fullMentionId` field with `representativeMentionId`. Graph coherence requires
  an existing mention resolved to the authority, without restricting its
  citation family. This is representation of canonical custom-resource results,
  not adoption of a TypeScript extension or proof of callback execution. Keep
  resource identity verification at the engine/adapter boundary. The current
  default persistence verifier requires a checked full-member key witness for
  each group, independently of its representative kind. A group without that
  witness fails with sanitized private `authority-key-unavailable` until custom
  identity verification lands; every resolved full key remains rechecked.
  Default resolution still selects its first full member. No source consumer
  of the retired field exists outside this initiative. This unshipped schema
  replacement carries no compatibility alias; reverse by reverting the schema,
  producer, persistence guard and tests together. Resource-key policy, mutable
  state ports and target callback proof remain open.

- **2026-10-28 trusted resource bindings:** keep canonical fallback identity
  unchanged and add a private external descriptor containing adapter-scope and
  equality-key fingerprints. Its ca1 preimage uses the distinct
  `external-resource` domain. The adapter owns host equality normalization;
  fingerprints do not attest equality or truthiness. Keep expected membership
  out of the receipt, captured from the trusted adapter, and require exact
  group coverage before overriding a full member's default key. Snapshot all
  binding data before hashing. No public request field authorizes this trust
  input. Continue rejecting unknown keys and validating source, anchors,
  occurrence IDs and all unbound full keys. This implements a private identity
  boundary, not callback parity or a semantic waiver. Reverse by removing the
  descriptor/helper and binding seam together; the empty-binding default path
  remains the regression gate. Host normalization, first-value/truthiness and
  mutable callback state need their own source-bound proof.

- **2026-10-28 private callback session:** share verified input preparation
  with the default path and inject five captured callbacks through a private
  Context.Service. Preserve actual last results, falsy prior-full entries,
  first key presentation and callback-boundary list/dictionary updates. Keep
  resource identity separate from truthiness/presentation. The oracle's Id.
  first-member cast is not a runtime full-only restriction; the private pin
  helper accepts canonical non-full members too. The explicit transition
  protocol matches all 18 focused source contexts and 53 events using test
  adapters. It does not yet prove arbitrary aliases/model mutation or publish
  production defaults/public ports. Keep transient groups, including empty or
  mutable memberships, until final projection has its own lawful proof.
  Reverse the session, shared preparation refactor and pin-input widening
  together, retaining equivalent default and source-trace regression proof.

- **2026-10-28 production callback defaults:** construct all five defaults
  from one prepared operation and capture Crypto/work services in methods with
  R = never. Dispatch and matching share one operation-owned counter, whose
  ceiling is captured and must match the prepared policy. Preserve precise
  finite failure reasons while dropping extra callback payloads. Run the
  prepared session after one verification rather than verifying twice. The
  production callbacks match all 76 default contexts and replace test-only
  default logic in the 18 custom trace contexts. Keep the existing document
  resolver until unified projection retains its richer outcome diagnostics;
  retire the duplicate matcher in that integration. No full custom/host/alias
  or bounded-runtime claim follows. Reverse factory/work integration together
  while retaining equivalent source, concurrency, ceiling and default proof.

- **2026-10-28 callback mutation requirements:** the pinned resolver preserves
  empty groups, independent member order, repeated/cross-group members,
  falsy/None dictionary keys, shared lists, retained dictionary aliases and
  detached citation objects. Reopen provisional membership/projection
  assumptions rather than normalize those values away. Ordered membership
  and resolution decisions need distinct ownership within the document; a
  single chosen edge per mention cannot be their sole representation.
  Detached semantic objects must remain distinct from verified mentions and
  receive no fabricated anchors/occurrence IDs. Live alias state belongs in
  server implementation, not pure domain behavior. Ten final group-value
  scenes are target-tested; all identity observations and six alias/detached
  scenes remain open. No replacement graph or semantic waiver is approved by
  this source checkpoint. Reverse the probe/test/evidence checkpoint together;
  all sixteen scenes must enter final target proof before row promotion.

- **2026-10-29 ordered document graph:** supersede the provisional v1 rule
  deriving membership from decisions. Receipt v2 stores ordered resource
  groups and separately identified member-list nodes. Multiple groups may
  reference one list; repeated mention/detached references and empty listed
  groups remain explicit. Detached citation objects use document-local object
  tokens, never verified anchors or occurrence tokens. Authority examples are
  optional references with no implied assignment. Structural closure does not
  authenticate alias history, semantic classification or external equality.
  Private persistence verifies exact trusted decision sets separately from
  optional list identity/ordered members; unbound defaults require exact
  default membership in mention order. Default list IDs substitute the cl1
  namespace for their owning ca1 token within a document, without issuing any
  source evidence. Structural codec tests preserve all sixteen frozen mutation
  snapshots. This does not close live alias/detached execution, general host
  normalization, production list/object identity issuers or final projection.
  Reverse graph, persistence, tests and this checkpoint together if retired;
  do not retain the v1 format as a competing public representation.

- **2026-10-29 live callback dictionary:** replace Id. callback array-replacement
  output with an operation-owned captured dictionary service. Its schema data
  snapshots carry list slots; owned runtime handles preserve sharing and
  retained lists across removal/clear. Custom callback factories capture the
  service and all dependencies with R = never, including access retained by a
  later full callback. Id. input group data is a fresh snapshot, not a mutable
  host dictionary or a request function. This is the Effect service adaptation
  of the callable interface, with known-input observations compared directly
  against source. All thirteen known-input mutation scenes now match all
  thirty events and final groups, including list slots and retained service
  identity. Methods serialize asynchronous updates, verify handle ownership,
  snapshot values, enforce bounded retained state and alias multiplicity, and
  close/release state on success, failure or interruption. This does not prove
  detached objects, arbitrary host/model mutation, public port capture,
  production list-token issuance or final document diagnostics/projection.
  Reverse runtime protocol, adapters, tests and this checkpoint together if
  retired; do not keep array replacement as a competing dictionary path.

- **2026-10-29 detached callback objects:** prior-context entries and group
  members use the domain's explicit mention/detached references. The operation
  owner registers detached semantic objects, snapshots their values, reuses a
  token for the same registered object and distinguishes equal-but-distinct
  objects. Its private cd1 preimage is the versioned citation-detached/v1 tag,
  captured source identity, engine artifact and allocation ordinal. It is
  document-local object identity, not content equality, a persisted entity or
  a source capability. Semantic objects never receive fake cm1 tokens/anchors.
  Default short/supra/reference/Id. helpers resolve semantic references through
  the same captured owner; metadata lookup accepts the existing Citation union.
  All sixteen frozen mutation scenes now match all thirty-eight events and
  final groups, including detached prior-full replacement/append and detached
  returned membership. Structural receipt proof remains separate. Prior-full
  state still uses explicit list transitions; its retained-list alias identity
  and arbitrary model mutation need further source/target proof before final
  projection/public port publication. No exhaustive row is promoted here.

- **2026-10-29 retained prior-full context:** eight further pinned scenes prove
  one shared prior-full list across context callbacks, automatic full-pair
  append through retained views, later full/Id. mutation of that same state,
  and immutable pair identity independent of equal values. Move prior-full
  state into the captured operation owner. Context outputs carry only their
  resource result; mutations use owner methods, preserving a single live path.
  Private pair slots distinguish nodes, preserve repeated references and
  retain old pairs after replacement/clear. Snapshots expose data; adapters
  retain the owner rather than mutable snapshot arrays. This is the same
  Effect-service adaptation as the dictionary, not a request function or a
  public Python-object hierarchy. All eight scenes match all thirty-one events
  and final context/groups through production defaults. Fresh pinned replay
  and eight portable corruption controls pass. General host/model mutation,
  final diagnostics/document projection, public ports and full safety/parity
  proof remain open; no exhaustive accounting row is promoted.

- **2026-10-29 semantic mutation and live-key frontier:** add eleven pinned
  semantic/default-resource mutation scenes. The operation owner now snapshots
  initial semantics and accepts explicit schema-owned semantic writes. Default
  helpers reread current semantics, including current Id./supra/short inputs;
  final mention snapshots reflect the writes while preserving verified anchors
  and cm1 inputs. Writes to a physical mention currently preserve its semantic
  discriminant; unsupported class/tag mutation remains open, not waived.
  Detached updates preserve their object token and aliases. Eight scenes using
  stable string resources match complete event/semantic snapshots. Three
  default-resource key scenes remain mandatory source counterexamples. A page
  change after insertion can produce two dictionary entries for one resource
  object; another page change retains one group. Preserve both outcomes and
  live key/object/lookup history before closing custom resolution. The existing
  immutable-artifact-reference law already forbids caching mutable resources;
  no normalization, stable-key precondition or duplicate-group collapse is
  approved by this checkpoint. Full safety/parity and final projection remain
  open; no exhaustive row is promoted.

- **2026-10-29 runtime dictionary backend:** pin CPython 3.11.15 general-key
  table behavior underlying the observed mutable default-resource cases. The
  private Effect backend uses current normalized 64-bit hashes, resource-object
  handles, cached insertion hashes and separate insertion-entry identities.
  Check object identity before cached-hash/equality, preserve deleted probe
  markers, retain insertion order, and rebuild growth tables with stored hashes.
  Bounded probes, captured comparison/work services, serialized operations and
  typed errors do not add a Python runtime dependency. Eight source histories
  now match all sixty-two results, equality-call traces and ordered entries.
  CPython source/license hashes and PSF attribution are explicit. Full live hash
  production, owner integration, reentrant comparison mutation and split or
  Unicode-specialized tables remain outside this backend's proof. The three
  mutable-key engine cases remain open; no normalization waiver or exhaustive
  row promotion follows from isolated backend tests.

- **2026-10-29 insertion-entry receipts:** receipt v3 separates cg1 insertion
  identity from ca1 authority identity and cl1 member-list alias identity.
  Distinct entries may reference the same authority without collapsing their
  order or lists. Trusted resource bindings fix every expected entry's global
  position, identity and complete list node. Unbound defaults still require
  their deterministic single-entry graph. Per-entry getters preserve boundaries;
  authority getters concatenate every matching entry with repetitions. All
  three actual mutable-key callback scenes now preserve their final graphs
  through codec and verified-source restoration under controlled out-of-band
  expectations. Automatic session identity/decision/binding production remains
  open; no parity or representation-law completion follows from this contract.

## Exception Ledger

The generated oracle evidence fixtures are excluded by exact path from
spellcheck and formatting in the root tool configuration: `operation-cases`,
`assertion-cases`, `source-inventory`, `canonical-cases`, `regex-inventory`,
`typescript-extensions`, `vocabulary-mapping` and `regex-adversarial-corpus`
JSON files below the eyecite
fixture directory. They retain upstream legal spellings, source expressions
or hash-bound payloads. Their separate schema/source/hash/coverage validators
and corruption controls remain required. These exclusions do not apply to
authored code or unrelated fixtures. Remove each exact exclusion when its
artifact is retired.

| Exception | Scope | Owner | Removal condition |
| --- | --- | --- | --- |
| Python 3.12 baseline bootstrap | The pinned `pyahocorasick==2.0.0` fails to compile under this host's Python 3.12/C23 toolchain before tests run; Python 3.11 passes all official tests. | P0 source baseline | Record as environment evidence; oracle generation uses pinned Python 3.11 unless upstream dependencies are deliberately re-pinned in a separate baseline decision. |

The verbatim CPython license block in THIRD_PARTY_NOTICES.md has scoped MD013
and MD046 allowances to preserve upstream bytes and the notice's existing
block style. Its digest is checked by the runtime dictionary source verifier.
The proper Dutch institution names are allowed only for that notice path in
_typos.toml; authored prose is still checked normally.
