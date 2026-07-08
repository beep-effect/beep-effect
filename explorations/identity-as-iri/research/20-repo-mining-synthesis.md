# 1. EXECUTIVE VERDICT

1. The corpus supports our design most strongly where other repos suffered from stringly identity, mutable namespace maps, or multiple IRI minting sites; D1/D4 should stay locked and stricter than the field. (ontosphere.md §10; skygest.md §10; rdflib-js.md §10)
2. Literal-preserving type machinery is rare but proven at the RDF/JS `NamedNode<Iri>` boundary, so our CURIE/IRI layer should keep precision until projection rather than widening to `string`. (rdfjs-types.md §3-§6; n3-types.md §3-§5)
3. Runtime prefix registries are useful as data, autocomplete, and projection inputs, but the corpus repeatedly shows they are too weak as the authoring authority. (ontorite.md §3-§4; ontosphere.md §3-§4; ontograph-core.md §3)
4. Triples/quads are the right interchange core, but several repos independently prefer a typed internal axiom/object model after ingestion; keep D6 tuples at the boundary and lower to explicit assembly records. (owl-fol-translator.md §4-§7; effect-ontology.md §5; ontograph-core.md §5)
5. D7 gets real evidence for a hybrid answer: entity-local facts are ergonomic, fold/graph facts are safer for cross-module wiring, and generic extra-triple buckets become dangerous when they become a peer model. (skygest.md §9-§11; ontorite.md §9-§10)
6. Turtle PN_LOCAL evidence favors a writer policy of "emit prefixed names only when proven safe, otherwise emit full IRIs" before attempting a general escaped-local generator. (n3.md §4, §7-§8; rdflib-js.md §6, §9)
7. Retrieval should be exact and indexed: the useful systems build subject/predicate/object/graph, entity, projection, or store-layer maps; fuzzy predicate normalization belongs outside the registry. (rdflib-js.md §5, §9; dxos-semantic-index.md §5, §8; skygest.md §6)
8. Registry/runtime packaging should split pure data/model/codecs from optional stores, SHACL, reasoning, SPARQL, and AI-search projections; this matches the stronger repo seams. (owl-fol-translator.md §1, §5; effect-ontology.md §7; skygest.md §6)
9. D9 is well supported: local-name collisions, generic identifier annotations, and inline undeclared predicates all show why owned identity and borrowed term channels must remain separate. (dxos-semantic-index.md §8; effect-ontology.md §10-§11; skygest.md §10-§11)
10. License discipline matters: DXOS, n3-types, and Skygest stay reference-only in this synthesis; their patterns can inform clean-room design but must not be upgraded to portable implementation sources. (dxos-semantic-index.md §2; n3-types.md §2; skygest.md §2)

# 2. DIAMONDS MATRIX

| pattern | source repo(s) + report section | which D1-D9 decision / phase it informs | adopt-as-is / adapt / clean-room | license basis |
|---|---|---|---|---|
| Literal-preserving named-node factory shape: infer a string literal once and carry it into the returned IRI node. | rdfjs-types.md §3-§6; n3-types.md §3-§5 | D3, D4, Phase 1 vocab+CURIE, Phase 2 composer | adapt | rdfjs-types.md §2 verifies MIT; n3-types.md §2 is REFERENCE-ONLY, so use n3-types only as clean-room comparison. |
| Template-literal unions for accepted string forms, without a broad `string` fallback. | n3-types.md §4-§5 | D3, Phase 1 | clean-room | n3-types.md §2 says no verifiable license grant in the vendored copy and marks REFERENCE-ONLY. |
| Prefix registry as data consumed by codecs/projections. | n3.md §3, §7; ontograph-core.md §3, §9; ontorite.md §3-§4, §9 | D1, D2, D3, Phase 1, Phase 3 | adapt | n3.md §1 verifies MIT; ontograph-core.md §2 verifies MIT port-with-attribution; ontorite.md §2 confirms MIT port-with-attribution eligible. |
| Safe local-name handling and collision detection before compaction. | effect-ontology.md §3, §9-§10; n3.md §4, §7-§8; rdflib-js.md §6, §9 | D2, D3, Phase 1 PN_LOCAL, Phase 3 Turtle | adapt | effect-ontology.md §2 verifies MIT port-with-attribution; n3.md §1 verifies MIT; rdflib-js.md §2 marks MIT port-with-attribution eligible. |
| Full-IRI fallback when a prefixed local name is unsafe. | n3.md §4, §7; rdflib-js.md §6, §9 | D2, Phase 1, Phase 3 | adapt | n3.md §1 verifies MIT; rdflib-js.md §2 verifies MIT port-with-attribution eligible. |
| One assembled graph/model value feeding multiple pure projections. | ontograph-core.md §6, §9; rdflib-js.md §6, §9; ontorite.md §6, §9 | D6, Phase 3 fold+projections | adapt | ontograph-core.md §2 MIT port-with-attribution; rdflib-js.md §2 MIT port-with-attribution eligible; ontorite.md §2 MIT port-with-attribution eligible. |
| Preserve unmapped or non-equivalent residue as diagnostics rather than silently dropping it. | ontorite.md §5, §9-§10; owl-fol-translator.md §5, §7-§8 | D6, D7, Phase 3 | adapt | ontorite.md §2 MIT; owl-fol-translator.md §2 MIT port-with-attribution. |
| Entity-local modules that co-locate schema, IRI derivation, triples, reverse mapping, and projections. | skygest.md §5-§6, §8-§9 | D6, D7, D8, Phase 3, Phase 4 | clean-room | skygest.md §2 says no repository code license was verified and applies REFERENCE-ONLY discipline. |
| Named graph partitioning for asserted data, ontology, inferred data, shapes, workflows, and provenance. | ontosphere.md §5-§7, §9; rdflib-js.md §5, §9 | D6, D7, D8, Phase 3, Phase 4 | adapt | ontosphere.md §2 verifies Apache-2.0 port-with-attribution; rdflib-js.md §2 verifies MIT. |
| Four-position or exact-handle indexing for deterministic retrieval. | rdflib-js.md §5, §9; dxos-semantic-index.md §4-§5, §7-§8 | D8, Phase 4 Fibered+retrieval | clean-room | rdflib-js.md §2 is MIT; dxos-semantic-index.md §2 is FSL-1.1-Apache-2.0 and REFERENCE-ONLY, so mixed evidence must be clean-room for DXOS-derived ideas. |
| Service/layer boundary with one API over memory/local and persistent/graph stores. | dxos-semantic-index.md §4-§7; effect-ontology.md §7, §9 | D8, Phase 4 registry service | clean-room for DXOS; adapt for effect-ontology | dxos-semantic-index.md §2 REFERENCE-ONLY; effect-ontology.md §2 MIT port-with-attribution. |
| SHACL validation as structured report data, with severity policy separate from graph construction. | effect-ontology.md §7, §9; ontograph-core.md §7, §9; skygest.md §7, §9 | D6, D8, Phase 4 SHACL | adapt for MIT sources; clean-room for Skygest | effect-ontology.md §2 MIT; ontograph-core.md §2 MIT; skygest.md §2 REFERENCE-ONLY. |
| Projection metadata drift checks and declared retrieval metadata keys. | skygest.md §6, §9 | D8, D9, Phase 4 | clean-room | skygest.md §2 REFERENCE-ONLY; patterns only, never code. |
| Deterministic round-trip/canary tests, including wrong-shape assertions. | owl-fol-translator.md §5, §7; rdflib-js.md §6, §9 | D6, Phase 3, Phase 4 | adapt | owl-fol-translator.md §2 MIT; rdflib-js.md §2 MIT. |
| Runtime autocomplete/workbench UX for borrowed vocab terms, kept subordinate to typed authoring. | ontorite.md §4, §8-§9; ontosphere.md §3-§4 | D3, Phase 1, Phase 3 tooling | adapt | ontorite.md §2 MIT; ontosphere.md §2 Apache-2.0. |

# 3. ROUGH GALLERY

| anti-pattern | which repo | why it hurt them | what our design does or must do |
|---|---|---|---|
| Runtime-computed or mutable IRIs at the public authoring boundary. | effect-ontology.md §10; ontorite.md §10; rdflib-js.md §10 | These reports identify namespace concatenation, editable URI form fields, and mutable `NamedNode.uri` as incompatible with stable identity. (effect-ontology.md §10; ontorite.md §10; rdflib-js.md §10) | Keep D1 root authority binding, make `rebase` projection-only, and prevent mutation of owned identity projections. (rdflib-js.md §11; skygest.md §11) |
| Raw string references for domains, ranges, predicates, subjects, and objects. | ontograph-core.md §10; ontology-master.md §10; rdflib-js.md §10; ontosphere.md §10 | String fields make typo resistance impossible and move validation to runtime or UI tools. (ontograph-core.md §10; ontology-master.md §10; ontosphere.md §10) | Enforce D4 handles, known CURIEs, or absolute IRI literals at schema/type boundaries. (rdfjs-types.md §6-§7; skygest.md §10) |
| Unknown prefix pass-through. | ontorite.md §10; ontosphere.md §9-§10 | Ontorite can preserve unresolved `prefix:local` data after reporting an error, while Ontosphere catches unknown prefixes at the MCP boundary but still operates with runtime strings. (ontorite.md §3, §10; ontosphere.md §9-§10) | Phase 1 codecs should reject unknown prefixes as schema errors and use runtime checks only as backstops. (n3.md §7; rdfjs-types.md §7) |
| Multiple prefix systems in one app. | ontosphere.md §10; ontograph-core.md §3; ontorite.md §3 | Scattered prefix utilities make display, expansion, storage, and namespace mutation responsibilities overlap. (ontosphere.md §10; ontograph-core.md §3; ontorite.md §3) | Keep one registry data model and derive all codec/projection behavior from it. (n3.md §7; ontograph-core.md §9) |
| Local-name collisions and local-name reassembly. | dxos-semantic-index.md §8; effect-ontology.md §3, §10 | DXOS reconstructs facts by predicate local name, and effect-ontology has collision-aware helpers because last-write-wins local maps are unsafe. (dxos-semantic-index.md §8; effect-ontology.md §3, §10) | D9 separates owned `identifier` from borrowed `term`, and Phase 1 must reject ambiguous compaction. (effect-ontology.md §9; dxos-semantic-index.md §8) |
| Generic extra-triple buckets becoming a second authoring model. | ontorite.md §5, §10 | Ontorite's `extraTriples` and `unmappedTriples` are valuable for preservation but risky as peer authoring channels. (ontorite.md §5, §10) | Use one tuple grammar; keep preserved/unmapped facts as diagnostics or migration input, not an alternate API. (ontorite.md §9-§10; owl-fol-translator.md §7-§8) |
| Serializer string-building or one-character flags as public API. | ontology-master.md §10; rdflib-js.md §10 | Hand-built Turtle emitters and string flags work but obscure semantic options and can overpromise projection fidelity. (ontology-master.md §10; rdflib-js.md §10) | Make projections pure folds with typed options and golden/canary tests. (rdflib-js.md §9; owl-fol-translator.md §7) |
| Placeholder or undeclared vocab terms filling gaps. | skygest.md §10; ontology-master.md §10 | Skygest inline-mints predicates when TTL vocabulary lacks terms, and ontology-master has placeholder/export gaps. (skygest.md §10; ontology-master.md §10) | Route owned terms through the composer and borrowed terms through the registry; do not patch gaps with ad hoc nodes. (skygest.md §11; effect-ontology.md §10-§11) |
| Validation split between real and placeholder paths. | effect-ontology.md §7, §10; ontosphere.md §7, §10 | Real SHACL services coexist with placeholder/no-op validation helpers, making the trusted gate unclear. (effect-ontology.md §7, §10; ontosphere.md §7, §10) | Put validation at the `$I.ontology` propose/gate/record boundary and make projection post-assembly pure. (owl-fol-translator.md §5; skygest.md §7) |
| Smushing or aliasing canonical identity by default. | rdflib-js.md §5, §10 | rdflib can redirect indexes through `owl:sameAs` and related identity features, changing retrieval semantics behind callers. (rdflib-js.md §5, §10) | Treat `owl:sameAs` as an explicit graph fact or opt-in reasoning closure, never as owned identity mutation. (rdflib-js.md §10-§11) |

# 4. DECISION PRESSURE

| decision | corpus pressure | support / contradict / silent | notes |
|---|---|---|---|
| D1 | Multiple repos use runtime or scattered IRI minting, and their own reports mark those paths as rough: Ontosphere has mutable/default namespace maps and counter-generated IRIs, Skygest has several authority roots, and rdflib has open per-call namespace factories. (ontosphere.md §11; skygest.md §11; rdflib-js.md §11) | supports | This is support by negative evidence: no report gives a strong reason to weaken total root authority. (ontorite.md §10; ontology-master.md §10) |
| D2 | N3 and rdflib both keep IRI identity separate from Turtle compaction and fall back to full IRIs when local names are unsafe; Skygest's main entity IRIs are slash-style. (n3.md §4, §7; rdflib-js.md §6, §11; skygest.md §11) | supports | The corpus supports slash mechanical IRIs plus projection-specific hash/prefix policy rather than model-level Turtle compromises. (effect-ontology.md §11) |
| D3 | RDF/JS/N3 type reports show literal-preserving `NamedNode<Iri>` and template-literal union tricks, while editor repos show runtime prefix registries are not enough. (rdfjs-types.md §3-§6; n3-types.md §4-§6; ontorite.md §10; ontosphere.md §11) | supports | Runtime vocab registries are useful as data, but no repo demonstrates they are safer than composer-baked CURIE literal types. (skygest.md §4, §11) |
| D4 | String references are repeatedly flagged as rough, while branded external handles in Skygest show that preserving external identity values is feasible. (ontograph-core.md §10; ontology-master.md §10; rdflib-js.md §10; skygest.md §9-§11) | supports | The corpus backs handles over strings, with the caveat that external DIDs/AT URIs should remain structured handles instead of being erased into IRIs. (skygest.md §9) |
| D5 | Effect-ontology validates/extracts local names for prompt schemas, Ontorite's domain-first property UX pre-fills context, and Skygest codegen derives property identifiers from IRI segments. (effect-ontology.md §4, §9; ontorite.md §9; skygest.md §11) | supports | Support is practical rather than universal; repos without schema-field authoring are silent. (rdflib-js.md §11; rdfjs-types.md §7) |
| D6 | Triple/quad cores are common in RDF libraries and graph editors, but OFBT, effect-ontology, ontograph-core, and ontology-master also show typed object/axiom models after ingestion. (rdflib-js.md §5, §11; ontosphere.md §5, §11; owl-fol-translator.md §4, §7; ontograph-core.md §5) | supports with counterpressure | Highest-value counterpressure: multiple repos independently argue against raw triples as the only internal representation; keep tuple authoring, then lower to explicit assembled axiom/property records. (owl-fol-translator.md §7; effect-ontology.md §12) |
| D7 | Skygest uses entity-local `toTriples`, predicate registries, entity links, and graph builders; Ontorite has class/property-local extra triples plus ontology-level unmapped triples. (skygest.md §5, §9, §11; ontorite.md §5, §9-§10) | supports hybrid, keeps open | Highest-value finding: multiple repos agree against a fold-only user experience for intrinsic facts, but Ontorite warns that two channels must share one tuple grammar and one assembly gate. (ontorite.md §10; skygest.md §9) |
| D8 | Retrieval/index evidence is strong: rdflib indexes four quad positions, DXOS exposes memory/SQLite store layers, Ontosphere partitions graphs and diagnostics, and Skygest has projection contracts and drift checks. (rdflib-js.md §5, §9; dxos-semantic-index.md §7; ontosphere.md §9; skygest.md §9) | supports | No repo implements our `Fibered` kit, but the corpus supports deterministic maps and exact registry resolution over search. (dxos-semantic-index.md §8; effect-ontology.md §9) |
| D9 | DXOS local-name reassembly risks collisions, effect-ontology reports generic identifier annotation drift, Ontorite has explicit migration/sweep passes, and Skygest separates many annotation symbols but still shows inline-term pressure. (dxos-semantic-index.md §8; effect-ontology.md §10-§11; ontorite.md §9; skygest.md §10-§11) | supports | The corpus reinforces separate owned/borrowed channels and a migration gate for legacy `identifier` overloading. (effect-ontology.md §10-§11; skygest.md §10) |

# 5. OPEN-QUESTION INPUT

## D7: inline vs fold triples

The corpus favors building the fold channel first and then adding inline intrinsic facts only if they compile into the same tuple grammar. Skygest's entity modules prove that entity-local `toTriples` plus projections are ergonomic, while its many fact locations also show why the assembly boundary must stay explicit. (skygest.md §5, §8-§11) Ontorite proves class/property-local extra facts are useful for humans, but its report calls generic triple buckets risky when they become a second model. (ontorite.md §5, §9-§10) OFBT argues for lowering into explicit axiom data after validation, not treating every downstream operation as raw triples. (owl-fol-translator.md §4, §7)

Recommendation: implement fold-only first, then allow `$I.class(..., { is: [...] })` for intrinsic facts if it desugars into the same assembled triple set and the same diagnostics ledger. (skygest.md §9-§11; ontorite.md §10; owl-fol-translator.md §7)

## Packaging: all-in-identity vs split pure-core/runtime seam

The stronger repos split pure kernels or domain models from runtime adapters: OFBT has a pure kernel, optional composition layer, and adapters; effect-ontology has separate RDF, ontology, registry, and SHACL service surfaces; Skygest isolates an `ontology-store` package from app data-layer concerns. (owl-fol-translator.md §1, §5; effect-ontology.md §7, §9; skygest.md §1, §6) DXOS also exposes one store API over memory and SQLite layers, though its license keeps it reference-only. (dxos-semantic-index.md §4-§7)

Recommendation: do not put everything into `@beep/identity`. Keep Phase 1 codecs/registry in the RDF layer, Phase 2 composer binding in identity, Phase 3 assembly/projections in ontology, and Phase 4 store-backed retrieval behind a service layer. (effect-ontology.md §9; owl-fol-translator.md §1; skygest.md §12)

## Turtle PN_LOCAL: escape vs full-IRI fallback

N3's parser accepts escaped local reserved characters, but its writer does not generate escaped slash/dot locals and instead falls back to full IRIs when the local does not match its contraction rule. (n3.md §4, §7-§8) rdflib has richer dotted-local behavior and tests for trailing-dot fallback and an option that forces full IRI output for dotted locals. (rdflib-js.md §6, §9) Ontorite's `compact` does not perform PN_LOCAL escaping, which its report marks as rough. (ontorite.md §10)

Recommendation: ship full-IRI fallback first for any slash/dot local that is not proven safe, with a shared PN_LOCAL codec and tests before adding escaped-local emission. (n3.md §7-§8; rdflib-js.md §9; ontorite.md §10)

## RDFJS structural interop: should our IRI type satisfy `NamedNode`?

RDFJS `NamedNode<Iri>` is an object interface with `termType: "NamedNode"`, `value: Iri`, and `equals`, while a string-like Beep IRI alone does not structurally satisfy it. (rdfjs-types.md §3-§6) N3 and rdflib demonstrate that ecosystem interop expects term objects and equality semantics, not bare strings. (n3.md §2; rdflib-js.md §3-§4)

Recommendation: keep the core owned IRI projection as a literal string/identity value, and provide an RDF/JS projection wrapper or factory that satisfies `NamedNode<Iri>` at package boundaries. (rdfjs-types.md §6-§7; n3-types.md §5-§6)

## Registry/retrieval service design

Exact indexed retrieval is the recurring useful pattern: rdflib indexes subject, predicate, object, and graph; DXOS has memory/SQLite layers over fact triples; Ontosphere separates named graphs and canonicalization; Skygest projection contracts declare metadata keys and reject drift. (rdflib-js.md §5, §9; dxos-semantic-index.md §4-§7; ontosphere.md §5-§9; skygest.md §6, §9) DXOS's fuzzy predicate matching is explicitly rough for our registry because it is search, not dereference. (dxos-semantic-index.md §8)

Recommendation: define a v4 service whose local layer indexes identity, IRI, CURIE, schema handle, and projection metadata exactly, with optional graph-store/SPARQL/DESCRIBE layers below the same interface. (effect-ontology.md §9; rdflib-js.md §9; skygest.md §9)

# 6. PROTOTYPE GUIDANCE

1. Start with an effect-only vocab data schema and derived `Curie`, `Predicate`, and `Expand` type tests, using RDFJS/N3 literal-preservation patterns but no repo code from reference-only reports. (rdfjs-types.md §3-§6; n3-types.md §4-§5)
2. Implement total expand/contract codecs over the registry, with unknown-prefix schema failures and property-based round trips. (n3.md §7; ontosphere.md §9; ontorite.md §10)
3. Add a PN_LOCAL projection helper that emits a prefixed name only when safe and otherwise emits `<fullIRI>`, plus dotted-local and trailing-dot tests. (n3.md §4, §7-§8; rdflib-js.md §6, §9)
4. Build the identity composer root binding with literal `iri` and `curie` projections, and keep `rebase` projection-only. (rdflib-js.md §10-§11; skygest.md §10-§11)
5. Add an RDF/JS `NamedNode<Iri>` projection wrapper/factory rather than making the core IRI value itself a term object. (rdfjs-types.md §4-§7; n3.md §2)
6. Define the tuple grammar for `[Subject, Predicate, Object]` with subject/object channels for schema handles, known CURIEs, absolute IRIs, and typed literals. (rdfjs-types.md §6-§7; rdflib-js.md §5, §11)
7. Lower tuple input into an explicit assembled ontology/axiom record before projection, separating object-property and data-property facts after AST inference. (owl-fol-translator.md §4, §7; effect-ontology.md §5, §12)
8. Implement `$I.ontology` fold-only first with typed assembly diagnostics, then add inline class facts only as sugar over the same tuple array. (ontorite.md §9-§10; skygest.md §9-§11)
9. Ship the cheapest projections first: JSON-LD context, Turtle, and a simple Markdown view, all as pure folds from the assembled value. (ontograph-core.md §6, §9; rdflib-js.md §9; ontorite.md §6)
10. Add SHACL as report data, not as thrown failure, after the fold has enough AST-derived property shape and optionality evidence. (effect-ontology.md §7, §9; skygest.md §7, §9)
11. Build a small exact registry index over identity, IRI, CURIE, schema handle, and generated projection metadata; do not add fuzzy predicate search to the registry. (rdflib-js.md §5, §9; dxos-semantic-index.md §8; skygest.md §9)
12. Add drift/canary tests: generated vocab drift, projection metadata key drift, wrong-shape domain/range canaries, and byte-stable round trips where possible. (skygest.md §7, §9; owl-fol-translator.md §5, §7; rdflib-js.md §9)

# 7. LICENSE LEDGER

| repo | verified license | port discipline exactly from its report |
|---|---|---|
| dxos-semantic-index | FSL-1.1-Apache-2.0 from package/root metadata. (dxos-semantic-index.md §2) | "REFERENCE-ONLY, not port-with-attribution." (dxos-semantic-index.md §2) |
| effect-ontology | MIT from `package.json` and `LICENSE`. (effect-ontology.md §2) | "verified MIT license -> `port-with-attribution`." (effect-ontology.md §2) |
| n3 | MIT from package metadata, `LICENSE.md`, and README. (n3.md §1) | Verified MIT basis; use with attribution when intentionally porting. (n3.md §1) |
| n3-types | No verifiable license grant in the vendored copy. (n3-types.md §2) | "REFERENCE-ONLY"; patterns may be described, no code copied unless a license is later verified. (n3-types.md §2) |
| ontograph-core | MIT from `LICENSE` and package metadata. (ontograph-core.md §2) | "port-with-attribution." (ontograph-core.md §2) |
| ontology-master | MIT from `LICENSE`, package metadata, and README. (ontology-master.md §2) | "`port-with-attribution` eligible." (ontology-master.md §2) |
| ontorite | MIT from `LICENSE` and README. (ontorite.md §2) | "port-with-attribution eligible" subject to preserving the MIT notice. (ontorite.md §2) |
| ontosphere | Apache-2.0 from `LICENSE` and package metadata. (ontosphere.md §2) | "`port-with-attribution`." (ontosphere.md §2) |
| owl-fol-translator | MIT from verified `LICENSE`. (owl-fol-translator.md §2) | "`port-with-attribution`." (owl-fol-translator.md §2) |
| rdfjs-types | MIT from package metadata and `LICENSE`. (rdfjs-types.md §2) | Verified MIT; portable with attribution under the report's MIT finding. (rdfjs-types.md §2) |
| rdflib-js | MIT from package metadata, README, and `MIT-LICENSE.txt`. (rdflib-js.md §2) | "port-with-attribution eligible." (rdflib-js.md §2) |
| skygest | No repository code license verified; vendored ontology TTL has CC-BY-4.0 metadata only for ontology modules. (skygest.md §2) | "REFERENCE-ONLY discipline applies - patterns may inform our design, but code is NEVER ported." (skygest.md §2) |

# 8. Sources

- <repo-root>/explorations/identity-as-iri/research/repos/dxos-semantic-index.md
- <repo-root>/explorations/identity-as-iri/research/repos/effect-ontology.md
- <repo-root>/explorations/identity-as-iri/research/repos/n3.md
- <repo-root>/explorations/identity-as-iri/research/repos/n3-types.md
- <repo-root>/explorations/identity-as-iri/research/repos/ontograph-core.md
- <repo-root>/explorations/identity-as-iri/research/repos/ontology-master.md
- <repo-root>/explorations/identity-as-iri/research/repos/ontorite.md
- <repo-root>/explorations/identity-as-iri/research/repos/ontosphere.md
- <repo-root>/explorations/identity-as-iri/research/repos/owl-fol-translator.md
- <repo-root>/explorations/identity-as-iri/research/repos/rdfjs-types.md
- <repo-root>/explorations/identity-as-iri/research/repos/rdflib-js.md
- <repo-root>/explorations/identity-as-iri/research/repos/skygest.md
