# Brief

<!--
Stage 3. The shaped pitch (Shape Up anatomy). Fat-marker fidelity: concrete
enough to evaluate and decompose, rough enough to leave design latitude to
the implementing goal packets. The exploration is shaped when the human says
this file matches the picture in their head.
-->

## Problem

The repo has three disconnected identity systems that are secretly one thing:
`$I` mints typesafe `@beep/...` paths, `@beep/rdf` holds IRIs and vocab
constants nobody wants to import at authoring sites, and the deleted
`@beep/ontology` authoring API died of its own ergonomics (split identity/IRI
architecture, eight synonym methods, runtime draft sniffing). Meanwhile the
FOLIO models overload the `identifier` annotation with borrowed RDF
predicates (including a direction bug), and agent context retrieval is search
where it should be dereference. The design session of 2026-07-01 locked the
unification (handoff D1–D9); this packet grounds it in official specs, 12
mined implementations, and repo audits before rebuilding.

## Appetite

Scratchpad prototype: a few focused sessions (it is disposable proof, not
product). Then four independently-shippable goal packets tracking the
handoff's phases, each gated green before the next. Budget discipline: if the
type-level machinery blows the repo's compile budget (identity is imported
everywhere), the packaging seam — not the design — absorbs the hit.

## Solution Sketch

One system, one seam (per DECISIONS 2026-07-02):

```
@beep/identity  (PURE — effect-only; proven in scratchpad/identity)
  make("beep", {authority, prefix, vocab})   ← total root binding (D1)
  $I = $PkgId.create("module")               ← convention unchanged
      .iri .curie .rebase                    ← literal-typed projections (D2)
      $I.key("skos:prefLabel" | "^rdfs:subClassOf")  ← CURIE literals, zero imports (D3)
      $I.class("Claim", {...})               ← owned node + section payload
      $I.ontology({schemas, triples})        ← fold: propose→gate→record (D6)
  vocab registry as data → Curie/Predicate/Expand literal types
  CURIE expand↔contract codec + PN_LOCAL codec (parser-side acceptance model)
  AssembledOntology → pure projections: JSON-LD/@context/Turtle/Markdown
  Fibered({base, fibers, section})           ← discrete case only (D8)
  IdentityRegistry interface                 ← resolve(identity|iri|curie) → fibers

@beep/rdf        (runtime interop) — NamedNode<Iri> wrapper/factory, n3 bridges;
                 SemanticSchemaMetadata survives as documentation layer
                 (canonicalIri/preferredPrefix deprecated)
@beep/semantic-web (runtime services) — IdentityRegistry store layers
                 (Oxigraph/SPARQL), SHACL gating
```

Authoring rules: references are handles (D4), predicate names default to
struct keys (D5), owned/borrowed channels never share a key (D9), fold-first
with inline `is:` only as strict sugar over the same grammar+gate (D7).
Turtle writer policy: prefixed names only when proven safe, full-`<IRI>`
fallback otherwise. §8 migrations (identifier overloading, `parent_class_of`
direction, dcterms, MADS) ship with Phase 3 under idempotent sweep tests.

Prototype = the corrected 12-step guidance
([`RESEARCH.md`](./RESEARCH.md) arbitration over
[`research/20-repo-mining-synthesis.md`](./research/20-repo-mining-synthesis.md)
§6), built in [`scratchpad/identity/`](../../scratchpad/identity/README.md)
under the effect-only purity test.

## Rabbit Holes

- **Compile blast radius**: `Curie<V>` unions × every-file-imports-identity.
  Prototype must measure (`tsc --extendedDiagnostics`) with the vocab
  machinery behind a separate module boundary before the seam is final.
- **Fibered 2-cells temptation**: versions/migrations/cartesian lifts are
  real and explicitly out of scope; the kit stays discrete-case.
- **General PN_LOCAL escaping**: writer-side escaped-local generation is a
  tarpit (n3 refuses it entirely); we ship acceptance-model codec + full-IRI
  fallback and stop there until proven needed.
- **JSON-LD general import**: `parseJsonLdOntology` stays bounded to our own
  projection dialect; a general RDF importer is a different project.
- **Two-channel authoring drift** (D7): inline sugar must desugar into the
  fold's tuple set and diagnostics ledger — any divergence kills the sugar.
- **Interning-table immutability under `rebase`**: renaming a public
  namespace must never touch `identifier`/symbols; type-level tests pin it.

## No-Gos

- No resurrection of `Ontology.create`, `createOntologyIdentity`, the
  eight-way reference synonym set, runtime draft sniffing, or string term
  references (now enforced by the applied supersession of
  `goals/ontology-modeling-foundation`).
- No runtime-computed IRIs or CURIEs anywhere — the interpolation ban is
  load-bearing (grep-harvestability, docgen, MCP registry, provenance).
- No fuzzy matching in `IdentityRegistry` — retrieval is exact dereference;
  discovery/search surfaces live elsewhere.
- No synonym methods as peers of the triple grammar — sugar is a tuple
  factory or it doesn't exist.
- No code from reference-only repos (dxos FSL-1.1, skygest, n3-types) —
  patterns clean-room only, per the SOURCES ledger.
- No version fibers / pseudofunctor coherence in this cycle.
- No new store technology decisions — Oxigraph stays a stubbed layer behind
  the service interface.
