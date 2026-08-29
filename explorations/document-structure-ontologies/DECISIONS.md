# Decisions

<!--
Stage 2. Dated Question / Answer / Rationale entries, one per resolved
branch. Rejected options are recorded, not erased. DEFERRED entries carry a
reason.
-->

## 2026-08-11 — D1: Frame — accept the 5-layer stack

**Question:** Accept the 5-layer stack as the packet's frame? (1: PO
cited-not-adopted over the ASTs · 2: DOCO/DEO + FaBiO/CiTO wire vocab in
`@beep/rdf` · 3: home-grown patent-document schema from CFR 1.77 / MPEP §608 /
ST.96 · 4: FOLIO matter-tag interop · 5: MCP delivery by extending the
existing 9-tool ontology toolkit.)

**Answer:** Accept the stack.

**Rationale:** Each layer is independently shippable, grounded in a different
research-verified source, and maps onto an existing repo brick (ASTs,
`@beep/rdf` vocab modules, `@beep/ontology` loader + MCP toolkit,
practice-kg/uspto MCP surfaces). Accepting the frame commits the
decomposition, not any single layer — D2+ decide each layer's fate.

**Rejected:** patent-first-skip-generics (forfeits the reusable annotation
layer); retrieval-first reframing (chunking win is real but is a consumer of
the layers, not the frame); bespoke frame (none proposed).

## 2026-08-11 — D2: Vocab scope — all four, with acquisition work

**Question:** Which vocab modules get generated into `@beep/rdf`, in what
order — Doco, Deo, FaBiO, CiTO? And does PO become a vocab module or stay a
LiteralKit?

**Answer:** Generate all four terms modules from version-pinned, attributed
upstream artifacts. PO stays a LiteralKit next to the ASTs — it is a type
discipline, not graph vocabulary. DEO's official ontology page establishes
CC-BY 3.0 (not 4.0); the other selected SPAR artifacts use CC-BY 4.0.

**Rationale:** The existing generator is only a target shape: `CoreVocab` and
`VocabTerms.ts` currently hard-code RDF, RDFS, SKOS, OWL, and DCTERMS. This
slice must add a curated acquisition source, registry entries, generator
inputs, exports, attribution, and drift tests for DOCO, DEO, FaBiO, and CiTO.
Their compatible attribution licenses permit one implementation slice once
the exact pinned artifacts and notices are recorded; consumers (annotation
layer, chunker, drafting agents) can then share one source of terms.

**Rejected:** treating the current generator as already capable of ingesting
the four vocabularies; unpinned downloads; defer-all (risks the annotation
layer shipping ad-hoc IRIs that need migration).

## 2026-08-11 — D3: Patent-document schema lives in @beep/law-practice-domain

**Question:** Where does the home-grown patent-document schema live
(PatentApplicationSection literal domain per 37 CFR 1.77(b), claim
substructure preamble/transition/body + dependency graph, ST.96-aligned
names, heading normalizers over `@beep/md`)?

**Answer:** `@beep/law-practice-domain` (existing family slice).

**Rationale:** Patent section roles and claim structure are legal-practice
domain models; the family exists with the standard slice shape, its
server/use-cases already process office-action claims (practice-kg-mcp is
the first consumer), and repo convention puts schema-first domain models in
the domain slice. Foundation stays free of US-patent-specific CFR/MPEP
semantics.

**Rejected:** new foundation/modeling package (pollutes foundation with
jurisdictional semantics); TTL-seed-only (loses compile-time typing for
claim-graph logic); split roles-as-seed/claims-as-domain (two artifacts to
sync — a projection of the domain schema into a seed can still be generated
later if the MCP toolkit needs it, which is derivation, not a split source
of truth).

## 2026-08-11 — D4: MCP delivery — extend the existing ontology toolkit

**Question:** Deliver folio-mcp-style taxonomy-browse tools how, given the
existing governed 9-tool toolkit in `packages/ontology/use-cases`+`server`
is inspect/SPARQL-shaped?

**Answer:** Extend the existing toolkit with read-only browse tools
(`ontology_list_branches`, `_get_concept`, `_get_children`, `_get_parents`,
`_search_definitions` or equivalents).

**Rationale:** Read-only tools make governance trivial under the existing
ExecutionLedger gate; reuses transport, auth, and the integration harness;
agents get one MCP surface. Lane-4 evidence: navigational tools beat query
languages for mid-draft agent use.

**Rejected:** new dedicated taxonomy MCP (second surface to configure
everywhere, no governance benefit for read-only calls); SPARQL-is-enough
(contradicts lane-4 reliability finding); out-of-scope (leaves the original
professional-desktop spark unserved).

## 2026-08-11 — D5: PO classification via schema annotations

**Question:** What mechanism carries the PO pattern classification of the
Md/Pandoc/Lexical constructors?

**Answer:** A PO LiteralKit plus an annotation stamped on each tagged class,
colocated with the schema definition. Correspondence tables and the mapping
conservation-law property tests ("pattern preserved or explicitly demoted,
never silently") derive from the annotations. They classify and reuse the
existing `PandocMappingIssue` and Lexical codec lossiness diagnostics rather
than introducing a second reporting mechanism.

**Rationale:** Schema-is-truth — a constructor's pattern is part of its
meaning, so it belongs on the schema, not in a sidecar that drifts. The
annotation hierarchy and tooling already exist.

**Rejected:** standalone Record tables (drift risk, classification divorced
from schema); classify-only-mapped-constructors (loses exhaustiveness — new
constructors escape); skip (forfeits the two artifacts research said pay for
themselves).

## 2026-08-11 — D6: FOLIO as a scoped, pinned vendor slice

**Question:** How to take FOLIO given the contested SALI↔FOLIO fork and its
matter/billing-only patent depth?

**Answer:** Vendor only the IP-relevant branches (IP Law areas, UTBMS
PA*/TR* task trees, USPTO/governmental entities, coarse document types),
pinned to a FOLIO release. Add an explicit conversion/curation step from the
upstream ontology into the repo-specific `TaxonomySeed` JSON-LD schema,
validate the resulting vetted CC-BY-attributed seed through TaxonomyLoader,
and serve it through the extended MCP browse tools.

**Rationale:** Follows the lynx packet's vetted-vendor-slice precedent.
Governance risk is contained — a fork-war outcome affects a future slice
refresh, not our runtime. UTBMS PA430 ("Office Action") and siblings are
directly useful matter/task tags for an IP practice.

**Rejected:** live-API dependency (ALEA infra availability + governance as
runtime risk in a desktop app); defer (slice recipe is cheap and the MCP
browse tools want a non-trivial taxonomy to serve); reject (forfeits interop
with the broadest open legal taxonomy).

## 2026-08-13 — D7: Shape sign-off and decomposition

**Decision:** Ratify `BRIEF.md` as-is. Decompose into four goal packets, in
this order: (1) patent-document schema first, consumed by the
practice-kg-mcp claims batch; (2) PO classification; (3) SPAR wire vocabulary
plus annotation shape, including the DOCO section fold; and (4) the FOLIO
slice plus MCP browse tools.

**Rationale:** The patent schema is the first concrete consumer contract; the
remaining packets preserve the ratified layer boundaries without combining
independent delivery units.

## 2026-08-13 — D8: Lynx lkg.ttl routing

**Decision:** Lynx `lkg.ttl` rides this packet's FOLIO `TaxonomySeed`
machinery. Lynx owns the vetting and license check recorded in its packet.

**Rationale:** One vetted-seed mechanism avoids a parallel vendor path while
preserving source-specific provenance responsibility.
