# Identity as IRI — Exploration Report

## Context
elpresidank distilled a 2026-07-01 design session into a handoff + XML context
packet in the WebStorm scratch folder "Identity as IRI". This report synthesizes
those artifacts (via 4 Codex sub-agents + direct read of the handoff) into a
decision-useful picture. **No implementation yet** — the user must answer open
decisions and explicitly authorize coding.

## 1. What the handoff accomplishes
Promote `@beep/identity`'s `IdentityComposer` from typesafe path builder into a
literal-preserving IRI builder; bake borrowed RDF vocab (SKOS/RDFS/OWL/DC/RDF)
into the composer as a CURIE literal type (zero imports at usage sites); replace
the deleted `@beep/ontology` authoring API with a `$I.ontology` fold over
triples-as-tuples; extract the Grothendieck-fibration pattern from
`JSDocTagDefinition.make` into a reusable `Fibered` kit for O(path-length)
deterministic agent metadata retrieval.

## 2. Core thesis in plain terms
An identity path (`@beep/ontology/patent/Claim`) and an IRI
(`https://ns.beep.sh/ontology/patent/Claim`) are the same value in two literal-
typed encodings. `$I` mints the identity space (base category); every piece of
metadata (annotations, docs, graph triples, provenance) is a section over it.
Retrieval becomes address computation (dereference), not search — the hook for
deterministic agent context injection.

## 3. Key artifacts
| Artifact | Role |
|---|---|
| `identity-iri-fibration-handoff.md` (24K) | AUTHORITATIVE design handoff: 9 decisions (7 LOCKED, 1 DEFAULT, 1 OPEN), 4 phases, salvage/kill list, testing strategy |
| `identity-as-iri-agent-context.xml` (184K) | Structured context packet — verified ≡ handoff (same decisions/questions, zero drift); adds full standards map + constraints |
| `Exploring ontology specifications and semantic standards.md` (136K) | Provenance transcript: standards research arc (RDF/RDFS/OWL/SKOS/DC/MADS/DID layering) |
| `ontology.md` (root, 196K) | Provenance transcript: design session; includes prototype source dump |
| `ontology/src/*` + `test/` | Deleted `@beep/ontology` prototype — salvage donor (projections, assembly, error taxonomy, test fixtures) |
| `ontology/ontology.md` | Redundant source dump of the prototype |

## 4. Locked decisions (handoff §2; XML confirms verbatim)
- **D1** Authority binding total at root: `make("beep", {authority, prefix, vocab})`; all composers derive `.iri`/`.curie` mechanically. LOCKED
- **D2** Slash IRIs mechanical; hash via `rebase` for published vocabs. DEFAULT
- **D3** Borrowed vocab = CURIE literal type in composer (`"skos:prefLabel"`, `"^rdfs:subClassOf"` inverse). LOCKED
- **D4** References are handles (schema | CURIE | absolute-IRI literal), never strings. LOCKED
- **D5** Predicate local names default to struct key. LOCKED
- **D6** Relational facts = triples-as-tuples; datatype/object property INFERRED from AST. LOCKED
- **D8** `Fibered` kit generalizes JSDocTagDefinition.make (discrete case only — no version 2-cells). LOCKED
- **D9** Owned `identifier` vs borrowed `term` annotation channels never share a key. LOCKED

Hard constraints: Effect v4 (ServiceMap.Service), interpolation ban (all
identities/CURIEs statically greppable), `const $I = $Pkg.create(...)` shape
unchanged, no synonym methods ever as peers of triples, house JSDoc/docgen gates.

## 5. Open decisions needing elpresidank
1. **D7** — relational facts inline on `$I.class` (`is:`), fold-only `triples`, or both? (Handoff rec: both; fold ships first regardless.)
2. **Authority host** — `https://ns.beep.sh/` is placeholder; must confirm before Phase 2. (Given oip.law context, is the real authority beep-owned or something else?)
3. **`Fibered` placement** — `@beep/schema` (vocab-agnostic, near LiteralKit) vs `@beep/ontology`. Lean: schema if expressible without vocab registry.
4. **`$I.key` curried typed-path form** (`annoteKey<Parent>()`) or struct-key default only?
5. **Registry service name/placement** — `OntologyRegistry`? `IdentityRegistry`?

NEW from repo inspection (not in handoff — needs a call):
6. **`SemanticSchemaMetadata` reconciliation** — `@beep/rdf` already has an owned
   annotation channel (`canonicalIri`/`preferredPrefix`, `annotateSemanticSchema`).
   The composer-derived `iri`/`curie` fields overlap it. Deprecate/absorb/keep?

## 6. Likely implementation phases (handoff §9)
1. **Vocab + CURIE types** (`@beep/rdf`) — registry data module from existing `Vocab/*`, `Curie`/`Predicate`/`Expand` types, expand↔contract codec, PN_LOCAL escaper. NOTE: existing `Rdf.ts` `Curie`/`PrefixMap` are runtime filter schemas — must be reconciled with the new literal-typed layer, not duplicated.
2. **Composer binding** (`@beep/identity` = `packages/foundation/modeling/identity`) — `make` gains `{authority, prefix, vocab?}`, literal-typed `.iri`/`.curie`, `rebase`; zero call-site changes; interning untouched.
3. **`$I.key`/`$I.class`/`$I.ontology` fold** (`@beep/ontology` = `packages/foundation/modeling/ontology` — EXISTS, currently holds FOLIO `Ontology.models.ts`) — nominal entrypoints, schema-validated triples, ported assembly walker + `AssembledOntology` + `OntologyAssemblyError`, JSON-LD/@context/Turtle/Markdown projections, SKOS profiles; §8 migrations to `Ontology.models.ts` (identifier→`$I.key`, `parent_class_of`→`^rdfs:subClassOf`, dc/1.1→dcterms, MADS anchor fix).
4. **`Fibered` + retrieval** — kit, JSDocTagDefinition migration (byte-identical), policy projections, `pullback`, registry ServiceMap.Service (local layer; Oxigraph stubbed), SHACL projection (feeds existing shacl-engine in `@beep/semantic-web`).

Salvage map (verified against prototype source):
- Explicit: JSON-LD/Turtle/Markdown projections, parseJsonLdOntology, AssembledOntology, error taxonomy, assembly-walker concept, SKOS profiles (retargeted to handles/CURIEs), semantic test fixtures.
- Plausible: language literals, provenance metadata, validation report shapes, JSON Schema sidecars, humanized labels, skos selector helpers.
- Dead: `Ontology.create`, `createOntologyIdentity`, 8 synonym methods, runtime draft sniffing, string term refs, manual predicate-kind declaration.

## 7. Risks / design tensions
1. **`@beep/ontology` is not greenfield** — FOLIO `Ontology.models.ts` lives there; Phase 3 must repopulate without breaking it before §8 migrations land.
2. **Dual CURIE representations** — new literal-typed registry vs existing runtime `Curie`/`PrefixMap`/`NamespaceBinding` in `Rdf.ts`; must converge or clearly layer.
3. **Dual owned-metadata channels** — `SemanticSchemaMetadata.canonicalIri` vs new composer `iri` annotation (open decision #6); leaving both violates the spirit of D9.
4. **`goals/ontology-modeling-foundation` encodes the DEAD design** — its SPEC specifies `Ontology.create` POC; must be superseded or future agents get contradictory guidance.
5. **TS compile cost** — `Curie<V>` is a large template-literal union crossed over all vocab terms; `Expand` is conditional-type-heavy. Type-level perf needs watching (handoff mandates type-level tests, good).
6. **D7 two-channel authoring risk** — handoff itself flags "two ways to do everything"; mitigated by fold-first.
7. **PN_LOCAL escaping is new work, not a port** — old Turtle projection avoided prefixed locals entirely.
8. **Fibered scope creep** — versions/migrations/2-cells explicitly out of scope; the transcripts show the temptation is real.
9. **EntityId is orthogonal** — persisted row ids stay branded integers; identity-as-IRI is definition-level identity only. Keep that boundary explicit to avoid confusion.

## 8. Sub-agent ledger
| Agent | Task | Key return |
|---|---|---|
| xml-extractor | Digest 184K XML packet | Packet ≡ handoff (no drift); standards map; full constraint list |
| old-code-digest | Prototype API + delta vs handoff | Verified salvage/kill list; delta table; prototype flaws confirmed in code |
| provenance-miner | Two transcripts (~330K) | Design evolution arc; rationale not in handoff; drift = resolved evolution only; loose threads |
| repo-inspector | Live beep-effect source | `$I` at `packages/foundation/modeling/identity`; `@beep/rdf` Iri/Uri/Curie/Vocab/SemanticSchemaMetadata exist; `@beep/ontology` exists w/ FOLIO models; goals packets found; EntityId orthogonal |

## User rulings (2026-07-01, post-report)
- **Route**: user asked exploration packet vs goals packet — see recommendation below.
- **Authority host**: placeholder `https://ns.beep.sh/` now; decide before Phase 2 merges.
- **Packaging**: user leans EVERYTHING in `@beep/identity`, pure, deps = `effect` (+ maybe `@beep/types`) only — avoids circularity. Notes moving the Id module OUT of @beep/identity is a heavy lift (monorepo-wide imports + create-package codegen in @beep/repo-cli).
- **SemanticSchemaMetadata**: needs exploration/audit before deciding.
- **Method**: prove out design/types/ergonomics from first principles BEFORE touching foundation/modeling packages. Standards research from official RFCs/OASIS/W3C collected by Codex agents into the packet as prose. Prototype in ./scratchpad importing only `effect`. Working assumption: full rewrite of @beep/identity and/or @beep/ontology.

## RECOMMENDED PLAN: exploration packet first (/explore)

**Recommendation: start `explorations/identity-as-iri/` via /explore — do not graduate to goals/ yet.**
Why: the handoff locks the *semantics* (D1–D9), but the user's remaining questions are
research- and shape-phase questions (packaging boundary, SemanticSchemaMetadata fate,
authority, first-principles spec grounding, ergonomics proof). goals/ packets are for
crystallized, decomposable work; this isn't decomposable until the scratchpad prototype
validates the type-level design and the packaging call is made. Graduation target:
one goals packet per implementation phase once shaped.

### Exploration packet plan
1. **Capture** — create packet via /explore; seed with: this report, pointers to the
   scratch-folder handoff + XML (copy into packet), the salvage map, user rulings above.
2. **Research (Codex fan-out, prose into packet)** — one doc per source cluster:
   - RFC 3986 (URI) + RFC 3987 (IRI): grammar, iunreserved, mapping IRI↔URI
   - W3C CURIE Syntax 1.0 + RDFa prefix rules
   - RDF 1.1/1.2 Concepts (IRIs, literals, triples), Turtle grammar (PN_LOCAL escaping)
   - JSON-LD 1.1 (contexts, @vocab, @reverse, slash-CURIE behavior)
   - SKOS Reference (labels, notes, semantic relations, integrity conditions)
   - OWL 2 (ObjectProperty vs DatatypeProperty, punning constraints)
   - SHACL (property shapes, sh:path/datatype/minCount)
   - DCMI Terms migration (dc/1.1 → dcterms), PROV-O (future fiber source)
   - Repo audits: SemanticSchemaMetadata call sites; Id.ts coupling surface +
     create-package codegen constraints; goals/ontology-modeling-foundation supersession
3. **Shape (scratchpad prototype)** — effect-only imports, in the packet's scratchpad:
   - Vocab registry as data + Curie/Predicate/Expand literal types; TS perf check
   - IriFromIdentity/CurieFromIdentity/SlugFromIdentifier; composer binding + rebase
   - $I.key/$I.class/$I.ontology nominal payload schemas; triples tuple schema
   - Fibered kit sketch (discrete case); JSDocTag migration feasibility note
   - Ergonomics fixture: port Parent/Child/RichClass/PracticeScheme/PatentConcept
4. **Align** — /grill-with-docs session: packaging call (all-in-identity vs split),
   authority host, D7, SemanticSchemaMetadata fate, supersede old goals packet.
5. **Decompose/graduate** — goals packets per phase (vocab+types, composer, fold+projections, Fibered+retrieval), each with acceptance gates from handoff §9/§11.

## 9. Recommended next action (superseded by plan above — kept for provenance)
Answer open decisions in this order: **#2 authority host** (blocks Phase 2
default), **#6 SemanticSchemaMetadata fate** (shapes Phase 2 annotation record),
**#3 Fibered placement** (Phase 4, but affects package deps early), then D7 /
#4 / #5 (can trail; fold-first is safe). Then authorize:
"Implement Phase 1 per the handoff (§9): vocab registry + CURIE literal types +
expand/contract codec + PN_LOCAL escaper in @beep/rdf, reconciling with the
existing Rdf.ts Curie/PrefixMap schemas; gates green via yeet."
Also worth a small side task: mark `goals/ontology-modeling-foundation` as
superseded by this handoff before implementation starts.

## Verification (when implementation is authorized)
Per handoff §11: type-level literal assertions (`expect-type`), property-based
CURIE round-trip over the registry, golden-file projections (port old fixtures:
Parent/Child/RichClass/PracticeScheme/PatentConcept), JSDocTagDefinition
byte-identical pre/post Fibered, repo-wide static-extraction grep harness.
Gates: `bun run docgen`, tests, lint — via `bun run beep yeet verify`.
