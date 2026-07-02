# Identity as IRI — Design Handoff

**Merging `IdentityComposer`, the ontology layer, and fibered metadata retrieval**

> Handoff target: Fable (Claude Code) working in `beep-effect`.
> Author of record: elpresidank, distilled from a design session on 2026-07-01.
> Status: design locked except where marked **OPEN**. Defaults below stand unless vetoed.

---

## 0. Mission

Promote `@beep/identity`'s `IdentityComposer` from a typesafe path builder into a
**fully compliant, literal-preserving IRI builder**, bake borrowed RDF vocabulary
(SKOS/RDFS/OWL/DC/RDF) into the composer as a **CURIE literal type** (zero import
duty at usage sites), replace the deleted `@beep/ontology` authoring API with a
terse `$I.ontology` fold over **triples-as-tuples**, and extract the
**Grothendieck-fibration metadata pattern** already proven in
`JSDocTagDefinition.make` into a reusable `Fibered` kit that gives O(path-length)
deterministic metadata retrieval for agents (context injection, structured
output grounding).

One sentence: **the identity path and the IRI become two literal-typed encodings
of the same value; annotations become sections over the base category `$I`
mints; retrieval becomes dereference.**

---

## 1. Context and constraints

- **Effect v4** (`effect@4.x`). Service identity via `ServiceMap.Service` —
  `Context.Tag` does not exist in v4. Do not import from `@effect/schema`
  (deprecated); use `effect/Schema` as `S`.
- House conventions are non-negotiable and enforced by the
  `jsdoc-annotation-specialist` skill (`.patterns/jsdoc-documentation.md` is the
  source of truth). Every export: JSDoc with `@example`, `@category` (lowercase),
  `@since 0.0.0`. Every schema: `$I.annote` / `$I.annoteSchema` / `.annotate($I.annote(...))`
  per shape. Same-name type alias after every non-class schema export. Run
  `bun run docgen` until green.
- The file-local convention `const $I = $SomePackageId.create("path/to/module")`
  as the first constant of nearly every file **must not change shape**. All new
  power arrives through the root `make()` call and new methods on the composer.
- The interpolation ban on identity template tags is **load-bearing**: every
  identity and every borrowed-vocab reference must remain a static literal,
  statically extractable without executing code (`grep`-harvestable). No design
  below may introduce runtime-computed IRIs or CURIEs.
- Prior art to resurrect selectively: the deleted `@beep/ontology` package
  (draft→assembly pipeline, JSON-LD/Turtle/Markdown projections, SKOS profiles,
  `OntologyAssemblyError` taxonomy). The projections and assembly walker are
  good; the authoring API (`Ontology.create`, `createOntologyIdentity`, the
  eight-way `ref`/`parent`/`child`/`exact`/... synonym set, runtime draft
  sniffing, string term references) is dead and stays dead.
- Existing vocab constant modules `@beep/rdf/Vocab/{Skos,Rdfs,Owl,Rdf,Xsd}`
  become the **source** for the type-level vocab registry (generate the literal
  unions from them, or move both to a shared generated artifact). They stop
  appearing at authoring call sites.

### Packages touched

| Package | Change |
|---|---|
| `@beep/identity` | Root binding (`authority`, `prefix`, `vocab`), IRI/CURIE derivation, `rebase`, `key`, `class`, `ontology`, second type param `V` |
| `@beep/rdf` | Vocab registry as data + literal types; CURIE expand/contract codec; PN_LOCAL escaping util |
| `@beep/ontology` (new) | The fold, projections (resurrected), `Fibered` kit, registry service |
| `@beep/schema` | Possibly hosts `Fibered` if it is deemed vocabulary-agnostic (judgment call — see Open Questions) |

---

## 2. Decisions

Marked **LOCKED** (agreed in session), **DEFAULT** (recommended, proceed unless
vetoed), or **OPEN** (blocked on elpresidank).

- **D1 — Authority binding is total, at the root. LOCKED.**
  `make("beep", { authority: "https://ns.beep.sh/", prefix: "beep", vocab })`.
  Every composer monorepo-wide derives `.iri`/`.curie` mechanically from its
  path. Even never-published identities get canonical IRIs (provenance needs
  them).
- **D2 — Slash IRIs for the mechanical mapping; hash allowed via `rebase`. DEFAULT.**
  Internal: `https://ns.beep.sh/ontology/Ontology.models/HttpUrl`. Published
  vocabularies may rebase to hash namespaces
  (`https://opip.law/ns/patent#Claim`). Rationale: slash → per-term
  dereference/docs pages (explore/tree ambition); hash → single-document
  vocabularies, friendlier Turtle prefixed names.
- **D3 — Borrowed vocabulary is a CURIE literal type baked into the composer. LOCKED.**
  `"skos:prefLabel"`, `"rdfs:subClassOf"`, with SPARQL property-path inverse
  syntax `"^rdfs:subClassOf"` for reverse direction (replaces any
  `reverse: true` flag; makes the `parent_class_of` direction bug
  unrepresentable). Zero imports at usage sites. Turtle-isomorphic notation.
  Extensible at the root (`vocab: { folio: ... }`) — inherited silently through
  every `create`.
- **D4 — References are handles, never strings. LOCKED.**
  Relation endpoints accept: a schema (resolved via `schemaId`), a known CURIE,
  or an absolute IRI literal. No `Ont.ref`-style wrappers. Typos in schema
  references are compile errors.
- **D5 — Predicate local names default to the struct key. LOCKED.**
  `$I.key("skos:prefLabel")` in a pipe needs no name argument; the assembly
  walker reads the field name (the old assembly already did —
  `unsupportedFieldName` proves it). Explicit override for custom-IRI cases.
- **D6 — Relational facts are triples-as-tuples. LOCKED.**
  `[Subject, Predicate, Object]` where `Predicate` is the CURIE literal type.
  The relation set is predicate-open; the metadata model stays tiny (kills the
  old 18-field draft records). Datatype-vs-object property is **inferred** from
  the AST at fold time (scalar-valued key → `owl:DatatypeProperty`,
  schema-valued key → `owl:ObjectProperty`), never declared.
- **D7 — Where relational facts live: OPEN.**
  (a) inline at the class site as predicate–object pairs
  (`$I.class("Claim", { is: [["rdfs:subClassOf", "folio:Document"]] })`),
  (b) only at the `$I.ontology` fold (`triples: [...]`), or (c) both channels,
  one tuple grammar, fold merges. Recommendation on file: **(c)** — intrinsic
  facts read best at the class, cross-module wiring at the fold, and it dodges
  import cycles. Risk: two-ways-to-do-everything. **Implement the fold channel
  first regardless** (it is required either way); add the inline channel only
  after D7 is answered.
- **D8 — The fibration pattern becomes a first-class kit. LOCKED.**
  Generalize `JSDocTagDefinition.make`'s factoring (constant-per-tag metadata
  moved from the value Σ-type into per-case AST annotations, recovered via the
  display map) into `Fibered` (§6).
- **D9 — Owned/borrowed annotation channels never share a key. LOCKED.**
  The `identifier` annotation belongs to owned `@beep` identities exclusively.
  Borrowed predicates ride a dedicated `term` slot (written by `$I.key`). This
  retro-fixes the `Ontology_models.ts` overloading (§8).

---

## 3. Type-level machinery (`@beep/rdf` + `@beep/identity`)

### 3.1 Vocab registry

One generated/curated data module; literal types derived from it. The registry
is itself a **section over the discrete base of prefixes** — model it as data
first, types second (the schema is truth):

```ts
// @beep/rdf — shape sketch (names final, term lists per the W3C specs)
type VocabShape = Record<string, { readonly iri: string; readonly terms: string }>;

interface CoreVocab extends VocabShape {
  rdf:     { iri: "http://www.w3.org/1999/02/22-rdf-syntax-ns#"; terms: "type" | "value" | "first" | "rest" | /* … */ };
  rdfs:    { iri: "http://www.w3.org/2000/01/rdf-schema#";       terms: "label" | "comment" | "subClassOf" | "subPropertyOf" | "domain" | "range" | "seeAlso" | "isDefinedBy" | /* … */ };
  skos:    { iri: "http://www.w3.org/2004/02/skos/core#";        terms: "prefLabel" | "altLabel" | "hiddenLabel" | "definition" | "note" | "scopeNote" | "editorialNote" | "historyNote" | "example" | "broader" | "narrower" | "related" | "exactMatch" | "closeMatch" | "broadMatch" | "narrowMatch" | "relatedMatch" | "inScheme" | "topConceptOf" | "hasTopConcept" | /* … */ };
  owl:     { iri: "http://www.w3.org/2002/07/owl#";              terms: "Class" | "ObjectProperty" | "DatatypeProperty" | "sameAs" | "equivalentClass" | "inverseOf" | "deprecated" | /* … */ };
  dcterms: { iri: "http://purl.org/dc/terms/";                   terms: "identifier" | "description" | "source" | "title" | "creator" | /* … */ };
}
```

Use **`dcterms:`** (not legacy `dc/elements/1.1/`) as the default Dublin Core
namespace (see §8 migrations).

### 3.2 CURIE types

```ts
type Curie<V extends VocabShape>     = { [P in keyof V & string]: `${P}:${V[P]["terms"]}` }[keyof V & string];
type Predicate<V extends VocabShape> = Curie<V> | `^${Curie<V>}`;
type Expand<C extends string, V extends VocabShape> =
  C extends `${infer P}:${infer L}` ? P extends keyof V ? `${V[P]["iri"]}${L}` : never : never;
```

Value-level `expand`/`contract` must be a **codec** (`{ decode, encode }` —
optic-shaped, per house doctrine) with literal-preserving overloads. Both
directions total over the registry; unknown prefixes are schema errors, never
silent pass-through.

### 3.3 Identity → IRI derivation

New members of the `TitleFromIdentifier` family:

```ts
type IriFromIdentity<Authority extends string, Path extends string> = /* "@beep/a/b" → `${Authority}a/b` */;
type CurieFromIdentity<Prefix extends string, Path extends string>  = /* "@beep/a/b" → `${Prefix}:a/b` */;
type SlugFromIdentifier<I extends string>                           = /* kebab-case, for markdown anchors */;
```

`IdentityComposer` gains a second type parameter and three literal-typed
getters, with the binding threaded from `make`:

```ts
export const { $BeepId } = make("beep", {
  authority: "https://ns.beep.sh/",
  prefix: "beep",
  // vocab?: extensions merged into CoreVocab
});

interface IdentityComposer<Value extends string, V extends VocabShape = CoreVocab> {
  // existing surface unchanged …
  readonly iri:   IdentityString<IriFromIdentity<Authority, Value>>;
  readonly curie: CurieFromIdentity<Prefix, Value>;
  rebase<const Iri extends string, const P extends string>(opts: { iri: Iri; prefix: P }): /* IRI projection rebased; identity + symbol untouched */;
  // new methods §4
}
```

`rebase` changes **only** the IRI/CURIE projection. `identifier` and the
interned symbol are immutable — renaming a public namespace must never touch
the interning table. Annotation records written by `annote`/`annoteSchema`
grow `iri` and `curie` fields (owned identity), all literal-typed.

Turtle caveat: `/` and `.` in PN_LOCAL need escaping (`\/`) or full-IRI
emission — this is a **projection concern** in the Turtle writer, never a model
concern. JSON-LD contexts handle slash CURIEs natively.

---

## 4. Authoring API surface

The composer absorbs the dead `Ontology.create` scope. Everything below derives
`baseIri`/`prefix` from the (possibly rebased) composer — **zero plumbing**.

```ts
const $I = $SomePackageId.create("patent"); // convention unchanged

// ── field predicates ───────────────────────────────────────────────
prefLabel: S.String.pipe($I.key("skos:prefLabel")),
children:  S.Array(S.String).pipe($I.key("^rdfs:subClassOf")),   // JSON-LD @reverse
text:      S.NonEmptyString.pipe($I.key({ description: "Claim text." })),
// name defaults to the struct key (D5); CURIE arg optional when the predicate
// is owned (minted from the key name); extras bag mirrors annoteKey's.

// ── classes ────────────────────────────────────────────────────────
export class Claim extends S.Class<Claim>($I`Claim`)(
  { /* fields */ },
  $I.class("Claim", {
    description: "A patent claim.",
    // is: [["rdfs:subClassOf", "folio:Document"]],   // only if D7 = (a)|(c)
  })
) {}

// ── the fold ───────────────────────────────────────────────────────
const mod = $I.ontology({
  label: "Patent Core",
  schemas: [Claim, Spec, ClaimSet],
  triples: [
    [Claim,    "rdfs:subClassOf", "folio:Document"],
    [Claim,    "owl:sameAs",      "https://schema.org/CreativeWork"],
    [ClaimSet, "skos:related",    Spec],
  ],
});
mod.toJsonLD(); mod.toTurtle(); mod.toMarkdown(); mod.context(); // + toShacl() later
```

Rules:

1. `$I.key`, `$I.class`, `$I.ontology` are **nominal entrypoints with distinct
   payload schemas** — no runtime overload sniffing, no type-guard forensics.
2. The `triples` array is **schema-validated**
   (`S.Tuple([Subject, Predicate, Object])` with the CURIE literal type as
   `Predicate`; `Subject`/`Object` = schema handle | CURIE | absolute-IRI
   literal | typed literal). The ontology definition is an instance of
   schema-is-truth, not an exception.
3. No synonym methods (`exact`, `sameAs`, `parent`, …). If sugar is ever
   wanted, it is a one-line tuple factory over the general channel — never a
   peer of it.
4. `$I.ontology` returns an assembled value (resurrect `AssembledOntology` +
   error taxonomy from the deleted package) whose projections are pure
   catamorphisms. Keep the propose→gate→record split: fold validates (SKOS
   hard failures vs warnings, unresolved handles → typed `OntologyAssemblyError`),
   projections never fail.
5. SKOS profiles survive as opt-in payloads on `$I.class` (`skosProfile:`),
   ported from the old drafts but with reference targets = handles/CURIEs (D4).

---

## 5. Retrieval identities (why this is one system)

- `$I` mints the **base category**: interned symbols are its object set at
  runtime; IRIs are the same points on the wire. `Symbol.for` round-trips are
  the in-memory canonical form; the CURIE/IRI codec is the transport form.
- The fiber over an identity is a **union across stores sharing one index**:

  ```
  fiber(x) = annotations(x)      — local AST walk
           ∪ DESCRIBE iri(x)     — Oxigraph / SPARQL
           ∪ docs(slug(x))       — generated markdown
           ∪ prov(x)             — PROV-O bitemporal records
  ```

  Local annotation lookup and `DESCRIBE` are the same operation over different
  stores. Address computation is O(path length), independent of corpus size —
  dereference, not search.

---

## 6. The `Fibered` kit (D8)

Generalize the `JSDocTagDefinition.make` pattern. Given a discrete base, a
functor of fiber schemas, and a constant-per-tag section, produce the tagged
union with the section soldered onto each base point:

```ts
const JSDocTag = Fibered({
  base:    TagName,                 // literal schema — the discrete base B
  fibers:  TagValue.cases,          // F : B → Schemas   (varies per instance)
  section: JSDocTagDefinitions,     // M : B → Meta      (constant per tag; schema-validated record)
});

JSDocTag.union                       // S.Union of thin members: { _tag, value } — Σ(t) F(t)
JSDocTag.meta("param")               // M(t) — O(1), from the case map
JSDocTag.fiberOf(value)              // display map ∘ section: value → _tag → M(t)
JSDocTag.project(value, policy)      // task-indexed sub-section (see below)
```

Implementation notes:

1. Mechanism = exactly what `make` does today: decode the section entry once
   (validated), `mapFields` to pin `_tag` via `S.tag`, `.annotate({ …meta })`
   on the member. The kit standardizes the annotation key and provides the
   accessors, and builds an O(1) case map (tag → member AST) at construction.
2. `section` must itself be schema-validated (a record schema keyed by the base
   literals — total: every base point has a section value, enforced at the type
   level).
3. **`project(value, policy)`**: policies are named sub-sections of the fiber —
   the skill's Agent Context Lifting Rules (`callSite` lifts
   `@deprecated`/`@effects`/`@precondition`/`@throws`/`@remarks`;
   `implementation` lifts `@postcondition`/`@invariant`/`@remarks`/`@effects`;
   `selection` lifts stability tags) become data: a policy is a list of fiber
   component keys. This is the deterministic agent-context-injection hook.
4. **Change of base**: `Fibered.pullback(f)` restricts to a sub-base (subset of
   tags / sub-vocabulary / sub-module) and fibers come along automatically.
   This is the principled form of context budgeting.
5. Migrate `JSDocTagDefinition.make` to the kit as the first consumer
   (behavior-preserving; annotation key may stay `jsDocTagMetadata` behind an
   option for compat). Second consumer: the vocab registry itself (base =
   prefixes, section = `{iri, terms}`). Third: RDF term definitions
   (elpresidank's `RdfDefinition` sketch).
6. **Registry service**: a `ServiceMap.Service` (v4!) exposing
   `resolve(identity | iri | curie) → fiber parts`, backed by (a) the interning
   table + case maps locally, (b) optional Oxigraph layer for the graph store.
   Same interface, two layers — the store is swappable, the index is not.
7. Scope discipline: everything here is the **discrete** case (Set-valued
   functor, category of elements) — exact, no pseudofunctor coherence. Fibers
   with morphisms (schema **versions** + migrations, cartesian lifts as
   transport along version maps, `@since`/PROV-O as sections over a version
   poset) are real but **out of scope for this handoff** — do not build 2-cells.

---

## 7. Projections

Resurrect from the deleted package and adapt:

- **JSON-LD**: `projectJsonLdOntology` / `projectJsonLdContext` /
  `parseJsonLdOntology` (round-trip tested before). `^curie` emits `@reverse`
  (the old projection already did this for `children`). The context is
  derivable from annotations alone — every `$I.key` CURIE and owned IRI is a
  context entry; ship `mod.context()` early, it is the cheapest win.
- **Turtle**: `projectTurtle` — port; add PN_LOCAL escaping for slash/dot
  locals or fall back to full IRIs; keep canonical boolean literals and string
  escaping tests.
- **Markdown**: `projectMarkdown` (plain + obsidian link modes) — port; anchor
  slugs via `SlugFromIdentifier`.
- **SHACL** (new, phase 4): each `$I.key` → `sh:property` with `sh:path` =
  expanded CURIE, `sh:datatype` from the AST, `sh:minCount` from
  `OptionFromOptional*` optionality. Output feeds the existing shacl-engine
  gate.

---

## 8. Migrations / retro-fixes (do these regardless of phases)

In `Ontology_models.ts` (the FOLIO OpenAPI models):

1. **`identifier` overloading (D9)**: every `annotateKey({ identifier: "https://…" })`
   carrying a *borrowed* predicate migrates to `$I.key("skos:…" | "rdfs:…" | …)`.
   Owned `identifier` is reserved for `$I`.
2. **Direction bug**: `parent_class_of` currently carries `rdfs:subClassOf`
   (same as `sub_class_of`) — wrong direction. Becomes `"^rdfs:subClassOf"`.
3. **Dublin Core**: `purl.org/dc/elements/1.1/*` → `dcterms:*`.
4. **MADS `country`**: the identifier points at an XML-outline HTML anchor
   (`mads-outline-2-1.html#country`) — not a dereferenceable RDF predicate.
   Either map to a real MADS/RDF construct (`http://www.loc.gov/mads/rdf/v1#`
   geographic authorities) or mark the field vocab-less until resolved.

---

## 9. Phased plan

Each phase independently shippable; gates green (`bun run docgen`, tests, lint)
before the next.

**Phase 1 — Vocab + CURIE types** (`@beep/rdf`)
Registry data module (generated from / reconciled with existing `Vocab/*`
constants), `Curie`/`Predicate`/`Expand` types, expand↔contract codec,
PN_LOCAL escaper. *Accept*: `"skos:prefLabl"` is a compile error;
`Expand<"skos:prefLabel">` is the exact literal IRI; codec round-trips;
property-based tests over the registry.

**Phase 2 — Composer binding** (`@beep/identity`)
`make` gains `{ authority, prefix, vocab? }`; `iri`/`curie` getters
(literal-typed); `rebase`; vocab type param threads through `create`/`compose`;
`annote*` records gain `iri`/`curie`. *Accept*: zero changes required at any
existing `$I = $PkgId.create(...)` call site; type-level tests pin the literal
IRIs; interning behavior unchanged under `rebase`.

**Phase 3 — `$I.key` / `$I.class` / `$I.ontology` fold** (`@beep/ontology`)
Nominal entrypoints, schema-validated triples, assembly walker (port + adapt:
handles resolve via `schemaId`; predicate names default to struct keys;
datatype/object inference), error taxonomy, JSON-LD + context + Turtle +
Markdown projections, SKOS profiles. *Accept*: the old test suite's semantic
assertions pass against the new API (round-trip JSON-LD, `@reverse` children,
Turtle escaping, SKOS hard-fail vs warning split); §8 migrations applied to
`Ontology_models.ts`; a FOLIO-derived module renders through all projections.

**Phase 4 — `Fibered` + retrieval** (`@beep/ontology` or `@beep/schema`)
The kit, `JSDocTagDefinition.make` migrated onto it, policy projections
encoding the skill's lifting rules, `pullback`, registry `ServiceMap.Service`
(local layer now; Oxigraph layer stubbed behind the same interface). SHACL
projection. *Accept*: `fiberOf`/`meta`/`project` O(1) after construction;
JSDoc behavior byte-identical; a demo: value → fiber → assembled agent-context
block, deterministic across runs.

---

## 10. Open questions for elpresidank

1. **D7** — inline `is:` pairs on `$I.class`, fold-only `triples`, or both?
   (Fold channel ships in Phase 3 regardless.)
2. Authority host: `https://ns.beep.sh/` is a placeholder — confirm the real
   authority before Phase 2 lands (it is `rebase`-able later, but the default
   should be right).
3. Where does `Fibered` live — `@beep/schema` (vocab-agnostic, near
   `LiteralKit`) or `@beep/ontology` (near its consumers)? Lean: `@beep/schema`
   if it can be expressed without importing the vocab registry.
4. Should `$I.key` also accept the existing typed-path curried form
   (`annoteKey<Parent>()`) for parent-scoped key checking, or is the
   struct-key default enough?
5. Registry service name + package placement (`OntologyRegistry`?
   `IdentityRegistry`?) — naming call.

---

## 11. Testing strategy

- **Type-level**: `expect-type`-style assertions for every literal transform
  (`IriFromIdentity`, `CurieFromIdentity`, `Expand`, `Predicate` rejection of
  unknown prefixes/terms, `rebase` literal propagation).
- **Property-based**: CURIE expand↔contract round-trip over the whole registry;
  Turtle PN_LOCAL escaping; identity path grammar (existing segment checks).
- **Golden files**: JSON-LD, `@context`, Turtle, Markdown projections of a
  fixture module (port the old suite's fixtures — `Parent`/`Child`/`RichClass`/
  `PracticeScheme`/`PatentConcept` translate almost mechanically to the new
  API and double as a before/after ergonomics demonstration).
- **Behavioral**: `JSDocTagDefinition` pre/post `Fibered` migration —
  annotation payloads byte-identical; decode/encode unchanged.
- **Static-extraction invariant**: a repo-wide grep harness proving every
  identity and CURIE in the codebase is a static literal (CI-check the
  interpolation ban's downstream promise).

---

## Appendix — one-screen mental model

```
            make("beep", {authority, prefix, vocab})
                          │  mints base category (interned symbols ≅ IRIs)
                          ▼
   $I = $PkgId.create("module")          ← convention unchanged
        │ .iri  .curie  .rebase          ← literal-typed codecs of the path
        │
        ├─ $I.key("skos:prefLabel")      ← borrowed vocab: CURIE literal, ^ = inverse
        ├─ $I.class("Claim", {...})      ← owned class node + annotations (a section value)
        └─ $I.ontology({schemas, triples})
                 │ fold = validation gate (propose→gate→record)
                 ▼
          AssembledOntology ──catamorphisms──▶ JSON-LD / @context / Turtle / Markdown / SHACL

   Fibered({base, fibers, section})      ← Grothendieck kit (discrete case, exact)
        value ──display map──▶ tag ──section──▶ metadata ──iri──▶ DESCRIBE / docs / PROV-O
        retrieval = O(path length) dereference; policies = task-indexed sub-sections
```
