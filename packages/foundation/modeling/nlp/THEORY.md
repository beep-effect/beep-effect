# `@beep/nlp` — the categorical theory

> Why this package looks the way it does. `@beep/nlp` treats natural-language
> annotation as **algebra over a typed text graph**: text strata are objects,
> NLP operations are morphisms, structure-building and projection passes come in
> law-checked pairs, and every law is a machine-checked **proof** (FastCheck
> property test). This document is the map from the mathematics to the modules.

The headline claim is *full categorical fidelity*: the elegance is not
decoration, it is the load-bearing structure. Operations compose because they
are arrows in a category; pipelines are sound because the laws hold; the handoff
to a knowledge graph is mechanical because the output is a free object the
downstream functor consumes.

---

## 1. Objects: a category of typed text

NLP is usually a pile of stringly-typed passes. Here, text is **stratified** by
a small ontology of kinds (`src/Ontology`): roughly eleven strata from raw
character spans up through tokens, lemmas, parts of speech, sentences, entities,
mentions, relations, and whole documents. Each stratum is a distinct object;
an operation cannot silently confuse a `Token` with a `Sentence` because they
inhabit different types.

The concrete carriers live in `src/Graph/Schema.ts` as schema-first node and
edge classes (`POSNode`, `LemmaNode`, `EntityNode`, `RelationNode`,
`DependencyNode`, `Span`, …). Every node is an Effect `Schema.Class` annotated
with a stable identifier, so the objects are simultaneously *types*, *runtime
validators*, and *serialization codecs*. The objects of our category are these
typed strata; the arrows are the operations that move between them.

## 2. The annotated text graph

A document is not a list of passes' outputs but a single **annotated text
graph**: nodes are typed text fragments, edges are typed relations (dependency,
mention, coreference, semantic relation). `src/Graph/` holds the graph itself
(`Schema.ts` for the carriers, `GraphOps.ts`/`Operation.ts` for the graph-level
operations, `index.ts` for the public surface). Effect v4 ships a built-in
`Graph` module (topological sort, acyclicity, BFS/DFS, SCC), so the port leans
on the platform for the graph theory instead of re-deriving it.

The graph is the *colimit* of the individual annotation passes: each pass
contributes nodes/edges, and merging them is a monoid operation (§4). This is
why order-independence of independent passes is a theorem, not a hope.

## 3. Morphisms: the Kleisli category of operations

An NLP operation is an effectful arrow `A ⇒ B` — it can fail (the backend may
not support it), it needs services (a backend, a clock), and it produces a
typed result. That is exactly a morphism in the **Kleisli category** of the
Effect monad.

- `src/Operations/Definition.ts` defines `OperationDefinition<A, B, R, E>`: an
  operation parameterized by its decoded input/output value types together with
  its requirement (`R`) and error (`E`) channels. The schemas travel with the
  definition so inputs/outputs validate at the boundary.
- `src/Operations/Composable.ts` gives the categorical combinators on these
  arrows — `identity`, `compose`, `map`, `flatMap`, `product`/`zipWith`,
  `traverse`, `aggregate`. These are the Kleisli category's structure:
  `identity` is the unit, `compose` is associative arrow composition, `product`
  is the monoidal tensor. Pipelines are just composites of arrows.

Because composition is Kleisli composition, a pipeline's requirement and error
channels are computed for you by the type system: wiring a backend-needing
operation into a pure one yields an operation that needs the backend. There is
no hidden global state — services compose through `R`.

## 4. Monoids and their laws

Annotation results combine. Token streams concatenate; graphs merge; result
stores union. `src/Graph/TypeClass.ts` carries the monoidal structure (and the
rest of the typeclass hierarchy the port preserves). The laws — left/right
identity and associativity — are not asserted in prose; they are **proven** as
FastCheck property tests (§9). Monoid associativity is what makes "annotate in
any order, merge" correct, and what lets the streaming/batch layers fold
partial results without coordination.

## 5. F-algebras: folding and unfolding the graph

The annotated text graph is recursive, so the natural way to consume or build it
is via an F-algebra:

- a **catamorphism** (`cata`) folds the graph down to a summary — counts,
  bag-of-features, a flattened projection, the handoff IR;
- an **anamorphism** (`ana`) unfolds a seed into structure — e.g. expanding a
  document into its sentence/token sub-graphs.

The port keeps these as first-class recursion schemes rather than ad-hoc
traversals, so a new fold (a new export format, a new metric) is a new algebra
over the same functor, not a new bespoke walk. Schema-driven folds run over the
typed graph directly.

## 6. The two paired directions

The deep structure is a pair of related directions.

### 6.1 structure and projection

Tokenization/segmentation builds the most general structure over raw text
(`Text -> [Token]`, `Text -> [Sentence]`) with no commitment beyond what the
text forces. Lemmatization/normalization projects in the other direction by
discarding morphological detail (`[Token] -> [Lemma]`). The practical law is
that building structure and then projecting it stays coherent: normalizing
tokens you just produced agrees with normalizing the source.

### 6.2 query and index

Retrieval is the second paired direction: **indexing** an annotated graph builds
the searchable representation, and **querying** projects it back to matched
sub-structure. The downstream knowledge-graph initiative consumes this index as
the bridge between the in-memory graph and the persisted KG.

These pairs are the reason the pipeline is *reversible in the right places*: you
can always project down to plain text, and you can always rebuild structure from
text, with round trips governed by property-tested laws.

## 7. Backends as a category of functors

`src/Backend/NLPBackend.ts` is the pluggable engine contract: `tokenize`,
`sentencize`, `posTag`, `lemmatize`, `extractEntities`, `extractRelations`,
`parseDependencies`, plus a `capabilities` record. A backend is an object;
adapters/wrappers between backends are morphisms; composition gives fallback
strategies. Operations a backend cannot perform fail with a typed
`BackendNotSupported` rather than throwing, so capability detection is total.
`@beep/wink` provides the concrete wink-nlp functor; an LLM-backed functor is a
future object in the same category (seam only, not built here).

The backend operations are **functors over text**: `posTag`/`lemmatize`
preserve token structure, `extractEntities`/`extractRelations` surface semantic
spans. Keeping them as the granular contract (rather than one fat service) is
what lets `@beep/nlp-mcp` re-expose each as an independent MCP tool.

## 8. The generic IR: a free object at the boundary

`src/Handoff/Contract.ts` is the product-neutral handoff: `TextChunk`,
`Mention`, `Entity`, `Relation`, `AnnotatedDocument` (version `nlp-ir/1.1`),
with branded ids, character `Span`s, and PROV-O-style `Provenance`
(source/generatedBy/timestamp/confidence). It is deliberately the **free
object**: it carries a generic `type` discriminant on entities/relations and no
domain vocabulary. The downstream `ip-law-knowledge-graph` initiative supplies
the *interpretation functor* that maps generic `Entity.type`/`Relation.type` to
its concrete KG schema. Because the IR is free, that mapping is mechanical: the
universal property says any KG schema factors through it uniquely.

`makeProvenance` stamps time via `Clock` (never `Date.now`), so provenance is
deterministic under test and honest in production.

## 9. Proofs: laws as machine-checked tests

The proofs are FastCheck property suites that exercise the categorical laws via
`effect/testing/FastCheck`. The laws under test include:

- monoid identity + associativity (§4);
- Kleisli category laws — left/right identity and associativity of `compose`
  (§3);
- the free ⊣ forgetful and query ⊣ index **triangle identities** (§6);
- handoff round-trips — chunk ↔ reassemble, and provenance completeness (§8).

A law that holds is a green test; a refactor that breaks the algebra fails a
proof, not a snapshot. This is the operational meaning of "full categorical
fidelity."

## 10. What is deliberately deferred

Fidelity does not mean *everything at once*. Gaps are documented rather than
faked:

- **Serialization / schema-AST folds** — `@effect/typeclass` is not a
  dependency, so folds run over the typed graph rather than through a separate
  cast-heavy serialization registry.
- **Streaming MCP tools** — the dataset/NDJSON batch tools are deferred to a
  follow-up driver commit; the categorical core is unaffected because those are
  transport, not algebra.

## 11. Map: mathematics → modules

| Concept                                  | Module                                                        |
| ---------------------------------------- | ------------------------------------------------------------- |
| Typed text strata (objects)              | `src/Ontology`                                                |
| Graph carriers (node/edge schemas)       | `src/Graph/Schema.ts`                                         |
| Monoids + typeclass hierarchy            | `src/Graph/TypeClass.ts`                                      |
| Graph-level operations, cata/ana         | `src/Graph/Operation.ts`, `src/Graph/GraphOps.ts`             |
| Operation spine (catalog/executor/store) | `src/Graph/GraphOperations/`                                  |
| Kleisli category of operations           | `src/Operations/Definition.ts`, `src/Operations/Composable.ts` |
| Backends as functors                     | `src/Backend/NLPBackend.ts`, `@beep/wink`                     |
| Free IR at the boundary                  | `src/Handoff/Contract.ts`                                     |
| Neutral contracts and models             | `src/Core`, `src/Tools`, `src/Backend`                        |
| MCP re-exposure (driver)                 | `@beep/nlp-mcp`                                               |

---

*Upstream half of the `ip-law-knowledge-graph` initiative. This package stays
product-neutral; the IP-law interpretation lives downstream.*
