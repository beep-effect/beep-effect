# Decisions

<!--
Stage 2. The grilling log. One entry per resolved branch-closing question,
newest last. Unresolved questions live in ops/manifest.json `openQuestions`
until they land here. Deferred questions get an entry too, marked DEFERRED
with the reason.

NOTE: this file was pre-seeded during the research stage (a decision landed
early); the manifest `stage` remains the authoritative resume point.
-->

## 2026-07-01 — prototype home + first-principles constraint

**Question:** Where does the shape-stage prototype live, and what may it
import?

**Answer:** [`scratchpad/identity/`](../../scratchpad/identity/README.md)
inside the existing `@beep/scratchpad` workspace package, so it runs under the
repo's real type-check/lint/test gates while we experiment. Imports are
restricted to `effect` only — no `@beep/*` packages, not even `@beep/identity`
or `@beep/types` — enforced by
[`scratchpad/test/identity-first-principles.test.ts`](../../scratchpad/test/identity-first-principles.test.ts).

**Rationale:** elpresidank: the old `@beep/identity` / `@beep/ontology` code
had a chicken-and-egg dependency problem; the rebuild starts from first
principles (official RFC/W3C specs) under the working assumption of a full
rewrite of those packages. Options rejected: prototyping inside the
exploration packet (no type-check gates); prototyping in the session
scratchpad (outside the repo's quality gates); importing `@beep/identity` for
comparison (would re-import the coupling the exercise is designed to break —
comparison happens in research audits instead). `@beep/types` was floated as a
possibly-acceptable dependency but the prototype starts stricter (effect-only)
and can relax later if a concrete need appears.

## 2026-07-02 — packaging seam (working hypothesis)

**Question:** Where does each layer of the identity-as-IRI system live —
all-in-`@beep/identity` (cycle argument) or the handoff/corpus pure-kernel vs
runtime split (seam argument)?

**Answer:** Pure core in `@beep/identity`, runtime downstream. Identity
absorbs: vocab registry data, CURIE expand/contract + PN_LOCAL codecs,
composer binding (`iri`/`curie`/`rebase`), the `$I.key`/`$I.class`/
`$I.ontology` fold, pure projections, and `Fibered` — all effect-only (the
scratchpad purity test is the proof instrument). Downstream keeps runtime:
`@beep/rdf` hosts RDF/JS interop (`NamedNode<Iri>` wrapper/factory, n3
bridges); `@beep/semantic-web` hosts stores/SHACL/SPARQL behind the registry
service interface defined in identity.

**Rationale:** The cycle argument (elpresidank) decides where the vocab
registry lives — identity must not import `@beep/rdf`, so the registry bakes
into identity (D3 already requires this). The seam argument (mining corpus:
owl-fol-translator pure kernel/adapters, effect-ontology service surfaces,
skygest ontology-store isolation — synthesis §5 + arbitration) decides where
runtime lives — never in the repo's most-imported package. Rejected:
handoff's 4-package split with vocab in `@beep/rdf` (reintroduces the cycle);
literally-everything-in-identity including stores (contradicts corpus seam
evidence, drags service deps into the foundation package); defer-to-prototype
(the two arguments already compose cleanly; deferral costs an align loop for
no new information).

## 2026-07-02 — SemanticSchemaMetadata fate

**Question:** `@beep/rdf`'s `SemanticSchemaMetadata` channel
(`canonicalIri`/`preferredPrefix` + rich documentation payload) vs the new
composer-derived `iri`/`curie` annotations — absorb, layer, or keep both?

**Answer:** Layer. Composer-derived `iri`/`curie` become the single owned
address-projection channel; `SemanticSchemaMetadata` survives as the
semantic/documentation payload layer (kind, overview, status, specifications,
provenance, evidence, …); its `canonicalIri` and `preferredPrefix` fields are
deprecated once composer fields land.

**Rationale:** Audit
([`research/10-audit-semantic-schema-metadata.md`](./research/10-audit-semantic-schema-metadata.md)
Final Recommendation): zero of the ~110 production writer attachments use the
two address fields, so deprecation costs nothing; runtime reading is
centralized in `getSemanticSchemaMetadata` (low reader risk). Rejected: full
absorb (conflates addressing with documentation, forces 110-writer
migration); keep-both (two owned address channels violates the spirit of D9).

## 2026-07-02 — D7: where relational facts are authored

**Question:** Inline predicate–object pairs on `$I.class` (`is:`), fold-only
`triples` at `$I.ontology`, or both? (The handoff's single OPEN decision.)

**Answer:** Fold-first; inline as strict sugar. Phase 3 ships
`$I.ontology({ triples })` only. Inline `$I.class(..., { is: [...] })` is
added afterwards, gated on desugaring into the SAME tuple grammar, the SAME
assembly walk, and the SAME diagnostics ledger — no separate validation path.
If the sugar cannot meet that bar, it does not ship.

**Rationale:** Corpus pressure (adversarially corrected): skygest's
entity-local `toTriples` shows intrinsic-fact locality is genuinely ergonomic
(skygest report §9); ontorite's `extraTriples` shows a second channel becomes
a second model unless grammar+gate are shared (ontorite report §10);
fold-first ordering is the handoff's own instruction, not corpus consensus
(adversarial review §5.1). Rejected: fold-only-permanently (forfeits proven
locality ergonomics); both-from-day-one (two surfaces to stabilize during the
riskiest phase).

## 2026-07-02 — $I.key authoring form

**Question:** Struct-key default only, or also the curried typed-path form
(`annoteKey<Parent>()`) for parent-scoped key checking?

**Answer:** Struct-key only. The curried form returns only if the scratchpad
prototype demonstrates a concrete type-safety hole (e.g. typo'd explicit
overrides).

**Rationale:** D5 already makes the assembly walker read the field name; the
curried form is additional authoring surface with no proven need. Minimal
first.

## 2026-07-02 — registry service name

**Question:** Name for the ServiceMap.Service resolving
`identity | iri | curie → fiber parts`?

**Answer:** `IdentityRegistry`. Interface defined in `@beep/identity` (per
the packaging decision); local layer near the interning table; graph-store
layers downstream in `@beep/semantic-web`.

**Rationale:** It resolves identities in all encodings — ontology is one
fiber source among several (annotations, docs, provenance). Rejected:
`OntologyRegistry` (names one use case, reads narrower than the interface),
bare `Registry` (leans entirely on package namespace).

## 2026-07-02 — authority host (RESOLVED)

**Question:** What real authority host replaces the `https://ns.beep.sh/`
placeholder?

**Answer:** `https://ns.beep.sh/` CONFIRMED as the real authority
(elpresidank, 2026-07-02, at `goals/identity-iri-core` P0). Every beep
identity derives its IRI from this root; published vocabularies may still
`rebase` per-module (e.g. opip.law namespaces).

**Rationale:** Purpose-built `ns.` subdomain on a beep-owned domain; matches
the handoff, prototype, and spec examples; slash-style per-term dereference
remains servable there. Rejected: oip.law namespace (anchors repo-wide
identity to one client vertical); deciding at PR review (no new information
would arrive). Originally DEFERRED 2026-07-01; resolved when the core packet
launched.

## 2026-07-02 — apply goals supersession now

**Question:** Apply the `goals/ontology-modeling-foundation` supersession
edit (specified in
[`research/12-audit-goals-supersession.md`](./research/12-audit-goals-supersession.md))
immediately, or bundle with graduation?

**Answer:** Apply now.

**Rationale:** Small, precisely specified, reversible; until applied, a goals
SPEC mandating the dead `Ontology.create` design remains
authoritative-looking to future agents.

## 2026-07-31 — fold packaging supersession: split surface

**Question:** The 2026-07-02 packaging-seam entry placed the
`$I.key`/`$I.class`/`$I.ontology` fold and pure projections inside
`@beep/identity` (effect-only), while `MAP.md` and the graduated
`goals/identity-iri-fold` SPEC assign the fold to `@beep/ontology`. Which
packaging stands, and what is the authoring surface?

**Answer:** Split surface. `$I.key` and `$I.class` become composer methods in
`@beep/identity` — effect-only annotation writers over the in-package
`Predicate` literal type, preserving D3's zero-import ergonomics at every
field site. The fold, assembly walk, schema-first error taxonomy, and all
projections live in `@beep/ontology` behind one entrypoint,
`Ontology.fold($I, { label, schemas, triples })` — one import per ontology
module. The fold clause of the 2026-07-02 packaging entry is superseded; its
composer-binding/vocab/codec clauses stand (shipped by `identity-iri-core`).

**Rationale:** `@beep/identity` depends only on `effect` and is imported by
`@beep/schema` and `@beep/rdf`; it can never import
`TaggedErrorClass`/`LiteralKit` (`@beep/schema`) or `IRI` (`@beep/rdf`)
without inverting foundation dependency order, so a schema-first fold
physically cannot live there. The scratchpad prototype itself shipped
`ontology()` and `key()` as free functions — the composer-method fold was
never validated. The fold is called once per module; zero-import ergonomics
are load-bearing only for the per-field writers. Rejected: proposal-split
(`$I.ontology` returns inert validated data, ontology assembles — a two-step
API with grammar and gate split across packages); all-in-identity
(`Data.TaggedError` + hand-rolled unions violate schema-first law inside the
repo's most-imported package).

## 2026-07-31 — SKOS collapses into the fact channel

**Question:** How do the old package's opt-in SKOS profiles (17-bucket
concept/conceptScheme payloads) survive under the predicate-open assembled
model?

**Answer:** They don't. SKOS relations and labels ride the one tuple grammar
(`[Cls, "skos:broader", Other]`; `[Cls, "skos:prefLabel", { value, language }]`).
The opt-in payload on `$I.class` shrinks to a classification marker
(`skos: "concept" | "conceptScheme"`) that drives `@type` emission. The
assembly gate enforces SKOS integrity (S9, S13, S14, S27 hard-fail;
scheme-membership and hierarchy warnings) by filtering assembled facts by
predicate. The old profile model classes stay dead with the rest of the
authoring API.

**Rationale:** `skos:*` predicates are already in the CURIE registry and
`TypedLiteral` carries language tags, so an enumerated profile would be a
second authoring channel for edges the grammar covers — the exact ontorite
second-model trap D7 ruled against. Rejected: enumerated-profile port (two
channels for the same edges); literals-only profile (two sources for the same
label plus a guard rule to police them).

## 2026-07-31 — inline `is:` sugar: not planned

**Question:** D7 resolved fold-first with inline `is:` allowed later as
strict sugar. Does the sugar remain on the roadmap?

**Answer:** No. Inline `is:` is not planned — not merely deferred. It returns
only if a real authored module's diff demonstrates concrete authoring pain
that tuples referencing schema handles cannot absorb, and even then only
under D7's original bar: same tuple grammar, same assembly walk, same
diagnostics ledger.

**Rationale:** Tuples referencing schema handles directly are already terse;
the inline channel is where the old API's synonym ghosts would re-enter.
YAGNI until proven by evidence, not anticipation.
