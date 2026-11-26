# The Knowledge Stack

Prose comes in; proof goes out. Retrieval proposes, fallibly. Logic proves,
soundly. Between them is one boundary, and the boundary is admission with two
witnesses: a grounding witness a machine can verify, and a governance token a
person grants. Every object the stack names (source text, anchor, annotation,
term, claim, activity) has one denotation, one owner, and lawful arrows to its
neighbours.

This chapter states the doctrine the code holds. Phases P1 to P7 of the goal
packet `goals/text-knowledge-stack-rebuild`, which records each phase, its exit
criteria and its law tests, have landed: P1 made the L0 rules true, with the
one exception section 4 names, P2 the L1 rules, P3 the L2 rules, P4 the L4
rules, P5 the L3 and L6 rules, P6 the L5 and L7 rules, and P7 retired the
former nlp and schema-org packages. A phase named beside a rule records when it
landed. The decisions behind the chapter are the 2026-11-19 entries
in [`DECISIONS.md`](DECISIONS.md); the vocabulary is in
[`GLOSSARY.md`](GLOSSARY.md).

Nothing here reopens the 2026-10-21 ruling "Epistemic Vocabulary Is
Foundation; Party Is A Product Slice; Propositions Are Slice-Owned", the
`ClaimLifecycle` promotion to `shared/domain`, or the verdict law
([`GLOSSARY.md`](GLOSSARY.md), "Verdict family"). The stack gives those
rulings content.

## 1. Purpose

The stack exists so that an attorney-facing artifact can say, for every
sentence it emits, where the sentence came from and who approved it for what
use. Three statements carry that purpose:

- **Nothing is asserted without a source.** An occurrence in a pinned text
  capture is the provenance link, and an absent, ambiguous, stale or
  unverifiable anchor fails closed.
- **Machine output has no authority of its own.** Extractors, models and
  agents produce proposed records. Only an admission makes a record usable for
  a stated purpose, and only with a verified grounding witness.
- **The file is canonical; the graph indexes it.** Graphs, RDF datasets and
  search indexes are projections. They are generated, disposable and never a
  second writer.

## 2. The eight layers

The layer numbers name roles, not a linear order; the real constraint is the
dependency DAG in section 3. Six layers are `foundation/modeling` packages,
one is an existing `foundation/capability` package, and L7 is a contract
across all of them. Laws are cited by their ledger id in
`goals/text-knowledge-stack-rebuild/research/law-test-plan.md`; each id's test
lands in the phase of its layer.

| Layer | Role | Owner | Lands |
| --- | --- | --- | --- |
| L0 | Identity | `@beep/identity`, `@beep/schema` (digest), `@beep/jsonc` (canonical JSON) | P1 |
| L1 | Text identity and anchoring | `@beep/text` | P2 |
| L2 | Annotation | `@beep/annotation` (`foundation/modeling`) | P3 |
| L3 | Taxonomy and alignments | `@beep/ontology` | P5 |
| L4 | Claims | `@beep/epistemics` | P4 |
| L5 | Operations | `@beep/nlp-processing` (capability) | P6 |
| L6 | Interchange | `@beep/rdf`, plus an adapter subpath in each owner | P5 |
| L7 | Agent surface | a contract, not a package | P6 |

### L0 · Identity

**Owners.** `@beep/identity` imports `effect` only and owns what expansion and
binding need: the RFC 3987 `IRI` schemas, which moved there from `@beep/rdf`,
`Namespace`, `Term`, `TermBinding`, the `Deprecation` record and the
term-stability snapshot. One generated registry holds them: the source shards
under `packages/foundation/modeling/identity/registry/namespaces/` are written
by `bun run beep identity registry --write` into `Registry.data.ts` and the
committed `term-snapshot.json`. The `since` of a binding or a deprecation is a
vocabulary release of that snapshot, not a package version: the snapshot
carries `release`, starting at `1.0.0`, its writer bumps the minor on
additions and the major on deprecations, and existing rows keep their `since`.
The release is a property of the whole change against a base ref: the writers
compute it from the base's snapshot and the lint refuses any other, so two term
sets never ship under one release and one change never skips one. Every binding
or deprecation the change adds records that release.
An addition needs no deprecation record: `L0-3` asks for one only when a
published term is removed or its IRI changed. That field is a string with a local
pattern check and the literal domains use `S.Literals`, the standing exception
for the bottom package that `@beep/schema` itself depends on; `@beep/schema`'s
tests cross-check both, because an identity test dependency on `@beep/schema`
would close a workspace cycle. Records that need `@beep/schema` primitives sit
above it: an external namespace's pin is `NamespacePin` in `@beep/rdf` (L6)
and the gUFO class typing is a record in `@beep/ontology` (L3). `@beep/schema`
owns the digest primitive (`Sha256PrefixedDigest`, `sha256:` plus 64 hex) and
`ContentHash` over it. `@beep/jsonc` owns canonical JSON (RFC 8785,
`JsoncFingerprint`) and the one minting function that hashes a versioned,
domain-tagged preimage (`@beep/jsonc/Mint`). L0 is a layer, not one package,
because `@beep/identity` depends only on `effect` and every other L0 owner
depends on it.

**Denotes.** Two identity regimes joined by minting (section 4), one
closed-world vocabulary registry, one digest format, and the activity id other
layers reference.

**Objects.** `ContentHash`, a brand over the prefixed digest; one domain brand
per minted identifier (`OccurrenceId`, `AnnotationId`, `RunEntityId`,
`ActivityId`, `ClaimId`), all over the `@beep/schema` digest; `TermIri`;
`Namespace` (prefix and a `NamespaceIri`, which ends with `/` or `#`); `Term`
(IRI, namespace, local name); `TermBinding` (code id, term, since);
`Deprecation` (term, since, replacement). `ActivityId` is minted from what is known when a run starts: `activity/v1`, the operation
term, the agent or engine pin, the prompt digest when there is one, the sorted
ids the run used, and its start time (`@beep/jsonc/ActivityStart`). What the
run generated and when it ended are fields of the activity record, outside the
id, because an output id that contains the activity id cannot also be inside
it. `OccurrenceId` landed with L1 in P2; each other domain brand lands with
its layer. Capture, annotation and run-entity brands are implemented in P3; `ClaimId` in P4.

**Arrows.** CURIE expansion and contraction over every namespace the repo
speaks (`prov:`, `oa:`, `nif:`, `xsd:`, `gufo:` and `as:` included); code id to term
IRI through the binding table, never through a module path; record to digest
through canonical JSON and the minting function. Graph canonicalization lives
in `@beep/rdf`, which owns the RDF data model; `@beep/identity` never imports
`@beep/rdf`.

**Laws.** `L0-1` and `L0-3` are tested in `@beep/identity`, `L0-2` in
`@beep/jsonc`. `L0-1` (expand after contract is the identity on registered terms),
`L0-2` (equivalent records hash alike, with set-valued fields sorted on the
preimage), `L0-3` (acceptance: a published IRI leaves the term set only with
a deprecation record, module-derived IRIs included; an addition needs none). Their tests are
`identity/test/Curie.laws.test.ts`, `jsonc/test/ContentHash.laws.test.ts` and
`identity/test/TermStability.test.ts` under `packages/foundation/modeling/`.

**Gates.** `bun run beep identity registry --write` refuses a break of the term
set its base ref publishes (`--base`, by default the merge base with
`origin/main`; the committed snapshot where the base publishes none), and
`--check` refuses generated drift without reading git. `bun run beep lint
identity-registry` also regenerates the snapshot from the head's shards and
compares it with the snapshot of the same base ref, so a change that edits the
shards and the committed snapshot together is still caught. A removed term is retired only through
`bun run beep identity deprecate <curie>`, which writes the deprecation row,
after its binding, if it has one, is removed from the shard. That command takes
a live term only: a namespace IRI is retired by hand, with a deprecation row in a
remaining shard and a regeneration. A renamed module or
package moves its bindings through `bun run beep identity rebind <from> <to>`,
whose ends are never one under the other.
A package move rewrites binding codes only, so renaming a package that a shard
projects into first changes its name in the `RegistryProjection` literal and in
the shard's `projection`.
A release other than the one the change calls for is repaired by running
`identity registry --write` against the base, after correcting any new row's
`since` the lint names: the writer reads the base's snapshot, so regenerating
gives the release of the whole change. A stacked layer is released against the
same default base as its parent, and again once the parent has merged. A checkout that deletes the whole
registry publishes nothing, so the lint reports every term its base published,
and the base's snapshot is read from wherever the base tree has its
`@beep/identity` package, so moving the package hides no removal.
A projection module no shard targets any more is drift, which `--write`
removes. The registry and its generated data never reach a CI runner handler
bundle: the handlers load only the registry-free identity sources, and
`packages/tooling/infra/ci-runners/test/HandlerBundles.test.ts` holds that list.

### L1 · Text identity and anchoring

**Owner.** `@beep/text` (`packages/foundation/modeling/text`), a
`foundation/modeling` package that holds the source identity and anchor
modules and the occurrence, selector and re-anchoring modules beside them. The
former provenance package, which held the first three before, is retired and
has no alias. The package is text identity and anchoring, not PROV; PROV-O
stays in `@beep/rdf`. It has no `Context` service: every function is pure or
needs only core's `Digest.Digest`, and reading the text of a capture stays the
`SourceTextResolver` port of `@beep/file-processing`.

**Denotes.** What a source text is and how to point into it with proof. It
carries no semantics, no confidence and no PROV, and it stays rdf-free so a
slice's `domain` can import anchors without the semantic-web stack.

**Objects.** `SourceTextIdentity` (artifact digest, extracted-text digest,
extractor, normalization version, scope and locator), whose strings are
well-formed text on decode as well as construction, because RFC 8785 cannot
canonicalize a lone surrogate; `TextAnchor` and `VerifiedTextAnchor`, which
keep their shapes; the powerless `TextAnchorVerificationReceipt`; `OffsetUnit`
(`utf16-code-unit`, `unicode-code-point`, `utf8-byte`; no grapheme clusters in
identity-bearing positions); `OccurrenceId`; `QuoteKey`, a grouping key over a
quote that the key itself normalizes under its own `QuoteNormalization`
version (`nfkc-dehyphenate/v1`), separate from the capture's
`normalizationVersion`, and explicitly not injective; `Selector` with the cases
`Position`, `Quote`, `Fragment`, `Refined` and `Range`; `Resolution` with
`Unique`, `Ambiguous` (a count) and `NotFound`; `LocatorMap`, ordered disjoint
`Kept` and `Rewritten` segments between two captures, with a gap unmapped;
`Reanchoring` with `Exact` and `Widened`, which carry the target capture's
receipt as `Anchored`, and `Unmapped` with its reason; `Anchored`, an
`S.Opaque` that holds a receipt and reads range and quote from the receipt's
anchor. The canonical stored unit is `utf16-code-unit`, which `TextAnchor`'s
width check already assumes; the occurrence preimage spells it as a literal, so
one range in two units is never two ids.

**Arrows.** `resolve` from a text capture and a selector to a `Resolution`,
following the W3C model (`Range` ends before its end selector, `Refined` is
relative to its base, no fragment specification is interpreted over plain
text); `reanchor` from an occurrence, a locator map and a verified target
capture to a `Reanchoring`, which is lax because normalization is
many-to-one; `normalizeText` for NFKC and de-hyphenation, each returning the
text and the locator segments that map it; unit conversion between the three
units, which refuses a split boundary, a boundary past the text and ill-formed
text; verification from a receipt and the source text to a
`VerifiedTextAnchor`; `TextAnchor` to and from `oa:TextPositionSelector` plus
`oa:TextQuoteSelector`, implemented in `@beep/rdf`
(`packages/foundation/modeling/rdf/src/Adapters/WebAnnotation.ts`), whose
offsets are Unicode code points on the wire, so that codec converts from and
to the stored `utf16-code-unit` through this unit conversion and fails closed
on a split surrogate and on selectors that disagree (the NIF codec does the
same in the P3 annotation adapter); a source map from `@beep/md` nodes to verified anchors
(`@beep/md/Md.anchors`). `@beep/pandoc-ast`, `@beep/lexical-schema` and
`@beep/html` record no text positions today; each gains its source map over
`@beep/text` when a phase needs one.

**Laws.** `L1-1` (slicing the text at the position yields the quote), `L1-2`
(unit conversion is a bijection on valid boundaries; a split surrogate fails
closed), `L1-3` (reanchoring is lax-functorial, exact and natural on `Exact`,
tested with NFKC and de-hyphenation), `L1-4` (`OccurrenceId` is distinct across
repeated boilerplate and stable under serialization), `L1-5` (`resolve` returns
`Ambiguous` for a repeated passage), `L1-6` (acceptance: a receipt never
becomes a `VerifiedTextAnchor` without re-verification). Lax means: when the two
steps and the composite map are all mapped, the stepwise range lies inside the
composite range, and `Exact` then `Exact` composes to the same `Exact`; it is
not claimed against `Unmapped`. All six are tested in `@beep/text`, under
`packages/foundation/modeling/text/test/`: `TextAnchor.laws.test.ts`,
`OffsetUnit.laws.test.ts`, `Reanchoring.laws.test.ts`,
`OccurrenceId.laws.test.ts`, `Resolution.laws.test.ts` and
`VerifiedTextAnchor.receipt.test.ts`.

### L2 · Annotation

**Owner.** `@beep/annotation`, a `foundation/modeling` package created in P3
with `bun run beep create-package`. Its named consumers at creation are the
langextract handoff (`@beep/langextract`), the semantica projection
(`apps/labs/semantica`) and the law-practice office-action flow
(`packages/law-practice/use-cases`). Its OA and NIF codec lives in an adapter
subpath so the base entry stays rdf-free, enforced by its import-boundary test.

**Denotes.** One standoff annotation model over one text capture for every
annotation layer: document structure, segmentation, mentions, chunks and
extractor candidates. Content is kept apart from attribution.

**Objects.** `makeAnnotationDocument`, a builder over a caller-supplied kind
registry (the pattern `makeClaimCore` also follows), whose document holds the text
capture, an `anchors` table from `OccurrenceId` to `Anchored`, an
`annotations` map from `AnnotationId` to content, and an `attribution` map from
`AnnotationId` to a set of `Generation` records. An annotation's content is its
deduplicated sorted targets, its kind and its body. Kinds come in groups:
structure (`Section`, `Paragraph`, `Title`, `Figure`; aligned to DoCO by the SSSOM set in `@beep/ontology`),
segmentation (`Sentence`, `Word`, bound to NIF terms for export), and
extraction (`Mention`, `Chunk`, `RelationCandidate`, `CorefCandidate`). Each
kind declares the kinds its body may reference and a function from a body to
the annotation ids it references; the document check requires every referenced
id to resolve to an annotation of an allowed kind in the same document.
Annotation and anchor records carry no id field: the map key is the hash of
the value. Typed
refusals are values: `RestrictionNotClosed`, `GenerationTimeConflict`,
`CaptureMismatch`. Patent structure (claim numbers, dependencies, rejection
coverage, pinpoints) is not a generic kind; it is a law-practice profile.

**Arrows.** `merge`, the pointwise join over compatible documents (same
capture, no time conflict); `restrict` to a kind set, which refuses unless the
set is closed under the references each kind declares, and `closure`, which
computes the closed set; containment uses range inclusion with non-decreasing levels,
strict levels on equal spans; one
checked decode entrypoint per boundary, which decodes through the schema
(resolution, attribution, capture equality, body references) and then runs the
effectful key verification (each anchors and annotation key equals the hash of
its value) before it returns. The package exports that entrypoint for wire and
storage input; the bare schema is exported for composition and generators
only. The OA and NIF codec (section 10) mints every key through assembly and
merges generation groups; it reads RDF rather than the document JSON entrypoint.
The JSON codec refuses repeated table keys and encodes tables and generations canonically.

**Laws.** `L2-1` (merge over one capture is idempotent, commutative and
associative on content, and attribution unions), `L2-2` (the annotation hash is
invariant under target permutation and duplication), `L2-3` (every annotation
has non-empty attribution, and each annotation and activity pair is one
generation), `L2-4` (referential integrity of targets and body references
survives merge and restriction, and the checked entrypoint refuses a document
whose annotation key was replaced), `L2-5` (containment is a strict order with
a level tie-break on equal spans), `L2-6` (the codec round-trips a document and
its imported activities exactly, maps third-party input to its normalized
form, and preserves `resolve`).

### L3 · Taxonomy and alignments

**Owner.** `@beep/ontology`. OWL authoring with a reasoner remains the
ontology slice (`packages/ontology`).

**Denotes.** Knowledge organization systems and their alignments: SKOS concept
schemes, classification registries with pinned editions, SSSOM mapping sets,
and the assembly fold that emits RDFS and OWL declarations.

**Objects.** `ConceptScheme` and `Concept` (SKOS); classification editions
(the existing IPC, CPC and Nice pins, with no `latest`); `MappingSet` (SSSOM:
subject, predicate, object, justification, and confidence as a typed field);
the optional gUFO class typing, a record keyed by term IRI with three fields:
the type of type (`Kind`, `SubKind`, `Role`, `Phase`, `Category`, `Mixin`,
`RoleMixin`, `PhaseMixin`), the category of its instances (`Object`,
`Relator`, `Quality`, `Event`; gUFO 1.0.0 declares no `Mode`), and, for a
`Relator`, the role terms it mediates, each with the minimum number of
individuals it connects. The audit rules of `L3-3` read it, and an untyped term
is skipped. `MappingSet` (`Mapping.ts`) and the gUFO typing (`Gufo.ts`)
landed in P5; the pilot types `LegalPositionRelator` in the law-practice
domain, under the `law-practice` registry namespace.

**Arrows.** The fold to an RDF `Dataset` as the only serialization path;
`checkMappingCoherence` over a mapping set's SKOS closure against a gUFO
typing; `audit` over the typed subset of terms, a function since P5, which
the ontology session runs since P6 on every term an agent batch adds quads
about, before the batch is saved. The legal seeds and their seed
data files moved to the law-practice asset pack and load through
`packages/foundation/modeling/ontology/src/TaxonomyLoader.ts`; the FOLIO HTTP
DTOs and their data are deleted.

**Laws.** `L3-1` (profile: `skos:broader` is acyclic in repo-owned schemes, and
an imported cycle is recorded), `L3-2` (profile: mapping sets are coherent and
consistent), `L3-3` (the audit is sound on the typed subset and silent on
untyped terms), `L3-4` (acceptance: a pinned edition is immutable).

### L4 · Claims

**Owner.** `@beep/epistemics`, with a nanopublication codec in the adapter
subpath `@beep/epistemics/rdf/NanopubCodec`. The epistemic slice keeps its product records, tables and
`ClaimLifecycle.advance`; `ClaimLifecycle` stays in `shared/domain`.

**Denotes.** Tenant-free vocabulary for what someone asserts, on what evidence,
with what stance and when: an immutable hashed core plus records that point at
it.

**Objects.** `makeClaimCore`, a builder that takes one options object with a slice-supplied proposition and id schemas,
whose core holds the proposition, the logical key, the set of `OccurrenceId`
supporting it at creation, the set of `ClaimId` it was derived from, an
optional `supersedes` naming the `ClaimId` it supersedes, the generating
`ActivityId`, the asserting agent (`AgentRef`: a software agent with its model
pin, a person or an organization), the valid time (the existing `ValidTime`,
unknown or an interval), the knowledge start and the slice-supplied scope. A
record's knowledge interval ends at the knowledge start of the record that
supersedes it and is open otherwise, so several unsuperseded records of one
partition may be current at once, with disjoint valid intervals.
Set-valued fields that enter a preimage use one shared codec: a `HashSet` when
decoded, a deduplicated array sorted by the encoded string when encoded.
Records that point at a core: `Stance`, `Challenge` (cycles allowed),
`Admission`, and a retraction record (claim, actor, reason, time). The actor
of an admission, of a challenge by a person and of a retraction is the
slice-supplied principal id, not an `AgentRef`. `makeClaimEnvelope` and its `ClaimVersion` were deleted in P4: the party,
knowledge-base and holds ledgers store a `makeClaimCore` core plus the separate
records, and rows that store a `ClaimVersion` keep their bytes behind private,
format-named read-time readers that return a `LegacyClaimImported` record
(`@beep/epistemics/ClaimImport.schema`). `makeClaimReview` builds the review
vocabulary: `ReviewState`, `ReviewerDisposition`, `DependenceAssessment` and
`EvidenceSignals`, the five typed signals, each present or `Absent{reason}`.
The present-or-absent carrier and its reasons (`makeSignal`, `AbsenceReason`,
`Measurement`) ship from `@beep/schema/Signal` since P4, so `@beep/ontology`
can type a mapping confidence without depending on the claims layer.
`makeAssessments` builds the owner-declared coordinate carrier (section 9).

**Arrows.** `promote` from candidate annotations, verified anchors, a
proposition and an activity to a core with stance `proposed`; `admit` from a
core, a grounding witness and a human token to an `Admission`; the nanopub codec (`makeNanopubCodec`: encode, decode and normalize over a
restricted four-graph profile); a pure checker over a log for the partition clauses below. The Postgres
exclusion constraint in the epistemic server remains the enforcement of
valid-time overlap.

**Laws.** `L4-1` (the log is append-ordered in knowledge time: an append whose
knowledge start is earlier than that of the log's last record is refused, and
the checker reports it as a knowledge-start regression; that rule is what
makes the log prefix-monotone and the as-of view at a time stable once the log
has passed it; per `(scope, logicalKey)` partition, supersession is acyclic by
hash construction, a record is superseded at most once and a second superseder
is a reported fork, a superseder never starts earlier than the record it
supersedes or than its own generation time, and the records not yet superseded
have pairwise disjoint valid intervals), `L4-2` (an admission requires
non-empty grounding that verifies against the current text digest), `L4-3`
(derivation is acyclic by construction: the `ClaimId` changes when
`derivedFrom` changes, and every log built through the minting function has an
acyclic derivation graph; every `derivedFrom` parent is already in the log, so
it starts no later than its child, and the checker reports a missing or later
parent; challenges may cycle; the support half of the original row is deleted,
because neither `supportAtCreation` nor an admission's grounding forms a graph
over claims), `L4-4` (a claim whose `derivedFrom` is non-empty and wholly
retracted is flagged, transitively), `L4-5` (equivalent propositions have equal
keys, with an instance in every owning slice), `L4-6` (refusal is a no-op,
independent coordinates commute, gates are monotone and never pass on
unassessed), `L4-7` (acceptance: `Absent{reason}` never coerces to a number).

### L5 · Operations

**Owner.** `@beep/nlp-processing`, an existing `foundation/capability`
package. It took the linguistic engine contract `Core` and the graph node
schemas from the former nlp package in P6. The graph node schemas are its
carriers for backend output; an entity or relation participant carries an
optional `@beep/text` `Position`, set only when `resolve` returns `Unique`
(`L1-5`). The former `Operations` and `Algebra` modules had no consumer and
the `effect/Combiner` and `effect/Reducer` census left no needed instance
uncovered, so both were deleted rather than moved, with `GraphOps`;
`Operation.ts` is the one operation arrow, `Graph/TypeClass.ts` is deleted and
the graph operations are `Operation`s named by their declared terms.

**Denotes.** Effectful transformations as arrows, with provenance recorded by
construction.

**Objects.** `Operation`, a named run from an input to an effect with fixed
error and requirement channels per pipeline; an activity log of
`prov:Activity` records.

**Arrows.** `compose`, sequential `product` (claiming interchange needs a
commutation witness), `traverse`, aggregation over `effect/Combiner` and
`effect/Reducer` where the census shows coverage, and `withActivity`, which
records used and generated ids and the engine or model pin for operations
whose inputs and outputs carry ids. It computes the used ids before the
operation runs. The activity id is minted at start, from
what is known then (section 2, L0).

**Laws.** `L5-1` (Kleisli identity and associativity for fixed channels under a
declared observation), `L5-2` (only `Pure` operations commute with every
operation; the throwing `sync` counterexample is the acceptance case), `L5-3`
(`generated` is never earlier than `used`, and every output is attributed),
`L5-4` (acceptance: an unsupported backend operation fails with the typed
`BackendNotSupported`, never a defect and never a partial result).

### L6 · Interchange

**Owner.** `@beep/rdf` for the RDF data model, serializations and vendored
vocabularies. Each codec lives with the owner of its source shape: `TextAnchor`
to `oa:` in `@beep/rdf`, which imports `@beep/text`; the annotation codec in
`@beep/annotation`'s adapter subpath; the nanopub codec in `@beep/epistemics`'s
adapter subpath; the fold in `@beep/ontology`.

**Denotes.** The RDF data model at the interchange boundary and the codecs
into it.

**Objects.** `Dataset`, a set of quads with equality up to blank-node
isomorphism and a digest on the canonical form; `Literal` with the cases
`Simple`, `Typed` and `LangTagged`; the `prov:Entity` projection of
`SourceTextIdentity` through `packages/foundation/modeling/rdf/src/Prov.ts`;
`NamespacePin` (source, license, version, digest), keyed by prefix, beside the
vendored vocabularies it describes. The `@beep/rdf` to `@beep/md` edge is
removed. These landed in P5, except `NamespacePin`, which P1 landed. The
semantica gold projection's dataset digest (`g-projection/v2`) waits on an
operational C1 measure run checked against the `rdf-canonize` oracle.

**Laws.** `L6-1` (dataset equality up to blank-node isomorphism; digest on the
canonical form), `L6-2` (a projection is deterministic and its kept fields
satisfy GetPut and PutGet). The license-and-digest assertion on every external
namespace's pin is tested in `@beep/rdf`.

### L7 · Agent surface

L7 is a contract across every layer, stated in section 12. It has no
catalogue row; its acceptance test is the write-tool test named there.

## 3. The dependency DAG

Edges are compile-time imports. Every edge below is legal under the
`foundation` kind table and, for the wink driver, the `drivers` family rule in
[`../ARCHITECTURE.md`](../ARCHITECTURE.md) (Family And Kind Dependency Rules):
`modeling` depends only on `primitive` and `modeling`, and `capability` on
`primitive`, `modeling` and `capability`.

Legal edges:

- `@beep/schema` and `@beep/jsonc` to `@beep/identity`.
- `@beep/text` to the L0 packages.
- `@beep/annotation` (base entry) to `@beep/text` and the L0 packages.
- `@beep/epistemics` (base entry) to `@beep/annotation`, `@beep/text` and the
  L0 packages.
- `@beep/rdf` to `@beep/text` and the L0 packages.
- `@beep/ontology` to `@beep/rdf` and the L0 packages.
- The adapter subpaths of `@beep/annotation` and `@beep/epistemics` to
  `@beep/rdf`. A slice that needs no RDF never imports them.
- `@beep/md`, `@beep/pandoc-ast`, `@beep/lexical-schema` and `@beep/html` to
  `@beep/text`, for source maps (`@beep/md` has the edge since P2).
- `@beep/nlp-processing` to `@beep/annotation`, `@beep/epistemics`,
  `@beep/ontology`, `@beep/text` and the L0 packages.
- `@beep/langextract` to `@beep/text`, `@beep/annotation`, `@beep/epistemics`
  and `@beep/nlp-processing`.
- The wink driver (`@beep/wink`) to `@beep/nlp-processing`.

Forbidden edges: `@beep/identity` to anything but `effect`, including
`@beep/schema` (which depends on it), so no identity-owned object is typed
with a `@beep/schema` primitive; any base entry of
`@beep/text`, `@beep/annotation` or `@beep/epistemics` to `@beep/rdf`;
`@beep/rdf` to `@beep/md`; any `foundation/modeling` package to a
capability; a slice's `domain` or model package to a capability. These hold for `@beep/text` since P2, the annotation base since P3 and the
epistemics base since P4 (its import-boundary test), `@beep/rdf` since P5 and
`@beep/nlp-processing` since P6, whose only new edge is `@beep/jsonc`.

## 4. Identity regimes

Identity has two regimes joined by minting.

- **Kinds** have compile-checked identity. A published term IRI is declared in
  the registry under the [identity authority](GLOSSARY.md#identity-authority)
  `https://beep-effect.com/ns/` and pinned to code through `TermBinding`. It is
  never derived from a package or file path, so a module rename changes no
  published IRI. A code id is the composer identity
  `@beep/<pkg>/<module>/<Name>` and stays a code path; its declared IRI is the
  term its binding names, and an unbound code id has no published IRI. A new
  internal term is `https://beep-effect.com/ns/<namespace>/<local>` with a
  one-segment local, in a namespace named for its vocabulary, not for a
  package or file, so a rename edits only `TermBinding.code`.
- **Kept or re-minted.** P1 sorted every IRI that existed before it into one
  of two cases. A kept value keeps its bytes: it is declared as a term with
  exactly today's IRI (the internal namespaces such as `qa:`, `skill-contract:`
  and `practice-kg:`). Each kept read site reads its IRI from
  `@beep/identity/Registry` (`iri`, `namespace` or `mint`), so its bytes are
  the declared term's by construction, and `identity/test/KeptValues.test.ts`
  proves each declaration equals the bytes the site minted before P1. A
  re-minted value is a path-derived IRI that was re-published from the
  registry, not frozen beside it (the `research-library:` and `vitest:`
  namespaces): when the old IRI left the process, written to a committed or
  exported artifact, its deprecation row names the replacement; when it never
  left the process it gets no row. The exception: the `$I` composers still
  derive an IRI from their path for code identities, which are not published
  terms. Removing the composer IRI surface changes `Id.ts`, which every CI
  runner handler bundle loads, so it waits for a
  decision that accepts one handler redeploy (decision
  `2026-11-20-p1-composer-stays-registry-free` in the goal packet). Until then
  `L0-3` proves that no bound code's module-derived IRI is published in place
  of its term.
- **Instances** have content-addressed identity. A layer-minted identifier is
  the digest of a preimage that names its domain and version (`occurrence/v1`,
  `annotation/v1`, `generation/v1`, `citation-mention/v2`). Canonical JSON sorts
  object keys only, so every set-valued field is sorted on the preimage before
  hashing. An instance that is not content-addressed is minted under a
  declared term or namespace (`Registry.mint`), never under a code path. P1
  landed the minting function and the first preimage, `activity/v1`. P2 landed
  `occurrence/v1` and `quote-key/v1` in `@beep/text` and `citation-mention/v2`
  in the law-practice server, each declared with `definePreimage` and a golden
  vector. P3 adds capture/v1, annotation/v1, generation/v1 and the two OA import
  preimages with goldens; P4 adds the claim core preimage, `nanopub/v1` and
`nanopub-agent/v1`, each with a golden.
- **One digest format** binds identifiers minted by the eight layers:
  `sha256:` plus 64 lowercase hex, one brand per domain. The bare hex primitive
  used elsewhere in the repository is out of scope for this rule.
- **A changed preimage re-mints.** When a preimage changes, its domain tag
  changes version. For an encoding with no stored rows, the old version is
  refused at decode where the module already works that way, and fixtures and
  golden vectors are regenerated; inside this program, the 2026-11-19 scoped
  amendment in [`DECISIONS.md`](DECISIONS.md) allows that against chapter 11
  rule 5 for the packages it names. Where rows are stored, the stored-format
  law governs: bytes are not rewritten, and an incompatible change is a
  declared read-time transform proved by a frozen old-format fixture. Citation
  document receipts take that route: since P2 a v3 receipt converts to v4 on
  read, after its stored `cm1:` id is recomputed and checked, and v3 is never
  written. So do the stored anchor columns and the stored node events:
  `epistemic_evidence.span` stored an `EvidenceSpan` (anchor fields plus
  confidence) and keeps those bytes: since P4 the epistemic domain `EvidenceRow`
  reads the current and legacy shapes and returns an `EvidencePosition`, a text
  position plus an extractor-confidence signal, and new rows are written only in
  the `evidence-position/v2` shape; the
  `@beep/agent-memory-store` node events store an `OccurrenceAnchor` and keep
  their bytes, and since P2 `occurrenceIdOf` derives `OccurrenceId` from it at
  read time, mapping its `utf16` unit literal to `utf16-code-unit`. Three
  stored columns hold an anchor shape (`epistemic_evidence.span`, and a
  verification receipt in `epistemic_evidence_verification.verified_anchor` and
  `law_practice_patent_citation_event.grounding`); a `VerifiedTextAnchor` is
  runtime-only and is never stored. A parallel encoding kept beside the new one
  is not allowed. Canonical JSON for every preimage stays in `@beep/jsonc`.

## 5. Occurrence identity

An occurrence is one place in one text capture. `OccurrenceId` is the digest of
the versioned tuple: scope, source reference, locator, source digest, text
digest, extractor name and version, normalization version, offset unit, start,
end and quote. It is the only text-occurrence identity in the repository. The
five non-canonical anchor encodings are deleted in the phase that owns each:
the `@beep/rdf` selector schemas and the `TextSpan` case of the party-domain
`EvidenceAnchor` were deleted in P2, and the former nlp package's Handoff and Graph spans
were deleted in P3, and the epistemics `EvidenceSpan` in P4. The party union keeps its three non-text
cases and points at text through a `TextOccurrence` case that holds an
`Anchored`, and its record identifier is `ArtifactOccurrenceId`, so the name
`OccurrenceId` belongs to `@beep/text` alone. The cli knowledge-base `Selector`
keeps its text-quote case: no stack package consumes it, its stored rows carry
the case, it mints no identity, and it validates through `@beep/text`;
re-checked in P7.

The stack is occurrence-first, not quote-first, because legal text repeats
itself. Claim language, examiner boilerplate and headers share quote and
context. A quote answers "does this string exist here"; an identity must answer
"which occurrence". So:

- Quotes locate and verify; ranges identify.
- `resolve` returns `Ambiguous` when a quote matches more than once; it never
  returns the first hit (`L1-5`).
- Re-anchoring across two captures is a recorded `Exact`, `Widened` or
  `Unmapped` outcome over a `LocatorMap`, never an invariant of a hash
  (`L1-3`). `Exact` and `Widened` carry the target capture's receipt, verified
  against the target text; the target's id is minted from that receipt, never
  stored beside it.
- A detection that adds meaning to an occurrence derives its identity over the
  `OccurrenceId`. The citation mention id is the digest of
  `citation-mention/v2`, the engine artifact, the semantic kind and the
  `OccurrenceId`: two engines or two citation kinds at one occurrence stay two
  mentions that share one occurrence. The preimage is legal semantics, so it is
  declared in the law-practice server, not in `@beep/text`.

## 6. Content and attribution

What a record says and who produced it are kept apart.

- An annotation's id is the hash of its content alone. Two runs that produce
  the same content produce one annotation and two `Generation` records.
- A `Generation` is a run-specific entity (`RunEntityId`, the hash of
  `generation/v1`, the content id and the activity id) that is a
  `prov:specializationOf` the content entity. Attribution is unique per content
  and activity pair, its time is canonical per pair, and merging two records
  for one pair with different times is a typed refusal, including absent versus stated
  time. `Generation.at` is the stated time, optional for imported input.
- Third-party input with no stated creator, generator or generating activity
  is attributed to the import activity, a `prov:Activity` whose id is
  deterministic: the hash of `import-activity/v1` and the source document
  digest. The import time is a field of its record outside the id, so the
  normalized form of an input is a function of the input and its source digest
  (`L2-6`), implemented in P3.
- A claim core records only what is true at creation. Stance, challenges,
  admissions and retractions are separate records that point at the core
  (`L4-1`). What a record supersedes is known at creation, so `supersedes`
  is in the hashed core and the knowledge interval it closes is derived, never
  stored. Implemented in P4.

## 7. Stance and admission

`Stance` is the admission workflow position of a claim record: `verbatim`
(what the source says), `proposed` (what a machine or a person put forward)
and `admitted`. It is not the epistemic `SemanticStance` stem of the verdict
law, and it does not decide whether two claims may be compared; that question
belongs to `explorations/citation-grounding-hallucination-guard`. Implemented in P4.

An admission is approval for a stated use, not truth. Its actor is the
slice-supplied principal id. It is bound to that actor, the action, the
revision and the scope, and it exists only with both witnesses:

- a non-empty grounding witness whose anchors verify against the current text
  digest at admission time (`L4-2`), and
- a human token bound to the same actor, action, revision and scope.

Admission is the governance half of the boundary with the grounding half as a
required argument. A refused admission and a failed re-verification are typed
values, not errors. Proposed and admitted worlds are produced on export as
views over the records; they are not the storage model. Implemented in P4.

## 8. Signals and triage policies

The five typed evidence signals stay as they are, each present or
`Absent{reason}`. Absence is information: it never coerces to a number, and no
signal has a default (`L4-7`; since P4 the semantica extractor and the
office-action review record `Absent` where they wrote `1` and `0.9`, and old
semantica rows import their stored number as `legacy-unknown`). There is no algebra across signals: no
blended score, no default combination, and no provenance semiring outside a
bounded derivation query with a stored provenance term.

Any ranking an interface needs is a **triage policy**: named, versioned,
tested on unknowns and ties, and unable to cross an admission gate or write
authority. `goals/belief-view-engine` remains the selection policy over
contention sets and consumes L4 under this rule.

## 9. Assessments as owner-declared coordinates

Claim status is not one state machine. `makeAssessments` takes a record from
coordinate name to a caller-supplied value schema and returns a total carrier:
every coordinate is present, as `Assessed` with a value or `Unassessed` with a
reason. A missing coordinate is a decode failure; unassessed is a value a gate
must handle. A gate is an owner-defined predicate over the carrier. The
foundation supplies the law harness (`L4-6`); each owner supplies its
coordinates, value schemas, order per coordinate and transitions. Implemented in P4.

The status census covers eight sites. `ReviewState`,
`ClaimDispositionStatus`, `ClaimEvidenceReviewStatus` and `ClaimLifecycle` are
coordinates; `ReviewTag` is a projection of `ReviewState`; `StructuralVerdict`
duplicated `ClaimGateResult` and was deleted in P4 under the verdict law;
`ReviewerDisposition` is the value schema of the reviewer signal, not a status.
The packet's status census (`research/status-census.md`) is final as of P4. `ClaimLifecycle` stays in
`shared/domain`, its transitions stay in the epistemic slice, and
`ClaimDispositionStatus` keeps its bytes.

## 10. External vocabularies

Upstream-first extends beyond Effect to pinned external vocabularies (OA,
PROV-O, NIF, DoCO, SKOS, gUFO, LKIF, ELI). Each enters as a registry
`Namespace` in `@beep/identity`, a `NamespacePin` with source, license,
version and digest in `@beep/rdf`, and an adapter at the
interchange boundary. Internal kinds stay repo-stable; nothing internal is
renamed to an external vocabulary until a decision names the kind and its
consumer. P1 registered six namespaces (`prov:`, `oa:`, `nif:`, `xsd:`,
`gufo:` and ActivityStreams `as:`) and pinned eleven: those six, `skos:`,
`doco:` and the SPAR `deo:`, `fabio:` and `cito:`. `bun run beep
sync-data-to-ts --target pinned-vocabularies` acquires each pinned artifact,
refuses byte drift, and writes the registry shards and the pin data in
`@beep/rdf`. SHACL `sh:` and VoID `void:` are registered unpinned, holding the
terms the repo uses, and every SHACL and VoID constant imports
`@beep/rdf/Vocab/Shacl` or `@beep/rdf/Vocab/Void`. LKIF and ELI are candidate
entries with no commitment, like OntoLex `lexicog`, and enter when a decision
names their first consumer. The license and digest test over every external
namespace is `NamespacePin.test.ts` in `@beep/rdf`.

The annotation codec supports one declared OA profile and nothing else.
Decoding third-party input returns the annotation document, a table of
imported activities, typed per-annotation rejections, and a residual dataset that holds every triple outside
the profile; residual triples are never stored in the document and never
dropped silently. The encoder takes the document together with its table of
imported activities, the pair the decoder returns without the residual, so an
imported activity's original IRI and stated time survive the round trip. NIF
is export-only for the `Sentence` and `Word` kinds. Every generation is one run
entity; creator and generator attribution retains its agent IRI. Rejected input
keeps every reached quad in the residual, including shared quads. OA
and NIF offsets are Unicode code points on the wire; the codec converts them
from and to the stored `utf16-code-unit` through the `@beep/text` unit
conversion and fails closed on a split surrogate, and `L2-6` includes an
astral-plane fixture. The five OA kinds are Mention, Title, Paragraph, Sentence
and Word. The codec reads a default graph and normalizes accepted input independently.

## 11. Matter walls

A matter wall is authorization, not a graph name. One authority port in the
law-practice slice answers whether a principal may act in a scope, and every
access path calls it with a caller-independent principal:

1. source retrieval,
2. anchor resolution,
3. graph query,
4. search and vector filtering,
5. cache lookup,
6. draft assembly,
7. provenance traversal.

Identical bytes in two matters never grant cross-matter access. Comparing two
caller-supplied scope values is a consistency check, not authorization. The
proof is `packages/law-practice/server/test/MatterWall.two-matter.test.ts`: it
loads identical bytes into two matters with distinct decisions and makes one
assertion per path against the layer that owns the path. Paths 1 and 2 run the
walled source resolver and citation source resolution, paths 3 and 4 serve two
Practice KG bundles built from a two-matter corpus through the host toolkit,
path 5 checks that each citation request keeps its own scope, path 6 checks
that a notice carries no matter material, and path 7 runs `LawPracticeServerLive`.
The Practice KG hosts provide the principal and `MatterAuthority` from their
environment and deny every walled path when unconfigured; the operational
bundle rebuild and the operator grants configuration run outside the repo.

## 12. The agent surface contract

- **Schemas are the tool contract.** MCP tool input and output schemas are the
  same Effect schemas the layers export; `@beep/mcp-kit` derives tool JSON
  Schema from them, and a same-schemas property over the four toolkits checks
  it on the wire. Rendering prompts from schema annotations is not done: the
  langextract prompt bytes key semantica's hosted artifact hash and every
  handoff's `promptDigest`, so the change needs a measured re-pin (decision
  `2026-11-24-p6-chapter-12-pending-notes-close-as-delivered-or-scoped`).
- **Write tools emit proposed records only.** A tool may write a `proposed`
  record; it never mints an admission. The first claim-writing tool,
  `claim_propose` in `LawClaimToolkit`, is defined in the law-practice
  use-cases package; its success schema is `LawProposedClaimRecord`, built by
  `@beep/epistemics`'s `makeClaimRecords`, and `WriteTools.proposed-only.test.ts`
  in the law-practice use-cases tests proves that every law-practice write tool
  emits proposed records only. The `TierGate` in `@beep/mcp-kit` stays the
  dispatch gate. No app hosts the toolkit until a host binds a
  caller-independent principal per dispatch.
- **Proposed terms are linted.** The ontology session runs the L3 audit on every
  term an agent batch adds quads about and refuses the save on a finding.
- **Attorney-facing output.** Every emitted quotation and citation has
  verified source evidence; every attributed factual assertion has evidence or
  a visible unresolved flag; original argument is labelled as proposed with
  its authorities and review status; approval binds to a versioned draft
  revision. P6 delivers the approval half for claims: `LawAdmission` checks the
  gate first and binds an attorney admission to the opened revision. The
  drafting invariants wait for a drafting surface.

## 13. What counts as a law

The stack keeps three kinds of statement apart.

| Kind | Meaning | Test form |
| --- | --- | --- |
| law | a property of this repository's functions that a test can falsify | property test (`it.prop` or `it.effect.prop` from `@effect/vitest`) over production schemas and minting functions |
| profile | a local constraint stricter than the upstream standard | example test over repo-owned data with planted violations |
| acceptance | an operational scenario | scenario or snapshot test over synthetic fixtures |

Rules:

- **Every structural claim links the test that falsifies it.** A README or
  chapter that states a structural property cites the ledger id, and the test's
  title starts with that id.
- **A law with no named bug is deleted.** Each ledger row names the defect its
  test would catch. A row that cannot name one is deleted with its reason in
  the ledger, not kept as decoration.
- **A property test is falsification, not proof.** Generators come from the
  production schemas (`Arbitrary.schema`), dependent values are built through
  the production minting functions, and the run floor and seed come from
  `@beep/fc-runs` ([`08-testing.md`](08-testing.md)).
- **Library behaviour is not a law of this repository.** Union laws on
  `HashSet`, transitivity of a graph library's path query and similar
  statements test the dependency, not the stack, and are not catalogued.
- **Laws are stated under a declared observation.** An effectful law names
  what it compares (`Exit` plus a recorded trace, for example) and what it
  excludes (defects, tracing, interruption).

## 14. The categorical narrative

The former nlp package's `THEORY.md` described that package as algebra over a
typed text graph and claimed "full categorical fidelity". The stack keeps
category theory only where it predicts a law a test can falsify. That file was
deleted with its package in P7; what stays true of it is below, and
the claims it made that no law backs are withdrawn after the table.

| Kept claim | Restated as | Ledger |
| --- | --- | --- |
| Operations are arrows in the Kleisli category of `Effect`; identity is the unit and composition is associative. | Only for fixed error and requirement channels, and only under a declared observation. | `L5-1` |
| `product` is the monoidal tensor of the pipeline category. | `product` is sequential; interchange needs a commutation witness, and only `Pure` operations are central. | `L5-2` |
| Merging independent annotation passes is order-independent. | `merge` is a join over one text capture: idempotent, commutative and associative on content, with attribution unioned. Merging across captures is a refusal. No colimit is claimed. | `L2-1` |
| Text strata are distinct typed objects that operations cannot confuse. | Kinds come from a caller-supplied registry; containment between annotations is a strict order derived from range inclusion with non-decreasing levels and a level tie-break, not a closure over kinds. | `L2-5` |
| Provenance is stamped by construction, from `Clock`, never from the wall clock. | Every run emits a `prov:Activity`; `generated` is never earlier than `used`, and every output is attributed. | `L5-3` |
| Graph theory comes from Effect's `Graph` module, not a local re-derivation. | The duplicate graph-operation module was deleted in P6; acyclicity of derivation is checked with `effect/Graph`. | `L4-3` |
| Operations a backend cannot perform fail with a typed error rather than throwing. | An unsupported backend operation fails with the typed `BackendNotSupported`, never a defect and never a partial result. | `L5-4` |

Withdrawn claims:

- **The handoff IR as a free object.** The handoff's `Entity`, `Relation` and
  `Provenance` types are deleted. Candidates are annotations; the consuming
  slice promotes them into its own proposition union, as the 2026-10-21 ruling
  requires. No universal property is claimed, and the downstream owner the
  file named no longer exists. Chunk-and-reassemble is withdrawn with the
  deleted handoff; attribution completeness is `L2-3`.
- **Monoid and typeclass laws as stack laws.** They test the carrier, not this
  repository's functions. The `effect/Combiner` and `effect/Reducer` census
  left one surviving reducer, `ActivityLogReducer`, whose laws are upstream
  behaviour, so it has no ledger row.
- **F-algebra folds as doctrine.** `cata` and `ana` remain helpers of the
  nlp-processing graph module with example tests; no catalogue row names a
  defect a fold law would catch.
- **Triangle identities for structure and projection and for query and
  index**, and the coherence of normalizing produced tokens against
  normalizing the source, which is engine behaviour (section 13). The index
  direction fed a downstream knowledge-graph initiative that was deleted. No
  catalogue row names a defect they would catch.
- **Backends as a category of functors.** No law follows from the framing.
- **Confidence inside provenance.** A single confidence value with a default is
  replaced by the five typed signals with `Absent{reason}`.

## See also

- `goals/text-knowledge-stack-rebuild/SPEC.md`: the program, its phases and
  acceptance rows
- `goals/text-knowledge-stack-rebuild/research/law-test-plan.md`: the ledger
  of law, profile and acceptance rows
- `07-non-slice-families.md`: the specific-home-first routing the layer homes
  follow
- `08-testing.md`: property tests over production schemas
- `11-evolution-and-deprecation.md`: retirement procedure and the scoped
  persisted-bytes amendment
- `12-observability.md`: span names for packages that gain spans
