# beep-effect KG / Semantic / Agent-Knowledge Direction

- **Date:** 2026-08-08
- **Packet:** `explorations/harvey-lab-firm-knowledge`
- **Scope:** the *intended* trajectory — vision, bets, sequencing, risk — read
  off the exploration and goal packets, product prose, and standards. A sibling
  agent profiles the shipped code; this report deliberately reads plans, not
  implementations, and marks the gap between them where it matters.
- **Method:** every claim below is grounded in a repo file cited as `path` or
  `path:line`. No web research. The `harvey-labs` clone was not read; only this
  packet's own mining reports under `research/` were used as external evidence.

---

## 1. The stated end-state vision

### 1.1 The outcome, in the Atlas's own words

`explorations/ATLAS.md` is the declared "first file a cold session should read"
(`explorations/ATLAS.md:5`) and states three durable outcomes, seeded from
`goals/agentic-professional-runtime`:

> "**Local-first agentic professional runtime** — a governed workspace where a
> professional brings their own agent clients, tools, data sources, and model
> credentials; every durable assertion carries evidence, provenance, lifecycle,
> and cost."
> — `explorations/ATLAS.md:17-21`

> "**Agentic solo IP law practice** (sole active vertical) — capture context,
> propose work, maintain evidence-backed practice memory, automate safe office
> loops, keep legal judgment under attorney approval."
> — `explorations/ATLAS.md:22-25`

> "**Agent control plane** — `apps/professional-desktop` as the workbench where
> the professional directs, reviews, and approves agent work."
> — `explorations/ATLAS.md:26-27`

The law vertical is the *only* live one: the wealth-management proof was demoted
to a dormant fixture on 2026-06-11 (`goals/agentic-professional-runtime/SPEC.md:69-77`).

### 1.2 The load-bearing epistemic sentence

The single most consequential sentence in the whole corpus — the one every KG
decision downstream defers to — is the runtime SPEC's authority clause:

> "Claim plus evidence plus provenance plus lifecycle is the authoritative
> record of what was asserted, evidenced, and decided — not of whether the
> underlying proposition is true. Search, graph views, retrieval packets,
> summaries, and MCP outputs are **projections**."
> — `goals/agentic-professional-runtime/SPEC.md:52-55`

Two properties follow and are enforced everywhere: (a) the KG is *never* the
authority, it is a derived view; (b) approval is a **disposition**, not a truth
operator. The academia corpus mining align session made (b) binding prose,
replacing "becomes a fact"/"authoritative runtime truth" with a seven-verdict
vocabulary (`explorations/academia-corpus-mining/DECISIONS.md`, "align:
prose-to-proof fact language (master Q2)"; landed at
`docs/product/prose-to-proof.md:111`).

### 1.3 The product wedge

> "Prose-to-Proof is a **local-first, provenance-grounded knowledge workbench
> for a solo IP practice**. A document comes in; the system reads it, proposes
> structured claims grounded to the exact source text, surfaces them in a
> document-portal editor, and admits nothing to the practice's memory until the
> attorney approves."
> — `docs/product/prose-to-proof.md:19-24`

> "**The gap:** *local-first **and** every-assertion-grounded **and**
> IP-specialized* is essentially unoccupied. That intersection is the product
> wedge."
> — `docs/product/prose-to-proof.md:45-46`

### 1.4 The named KG architecture: BeepGraph

> "For beep-effect's knowledge-graph / ontology spine, adopt the
> *effect-ontology*-style architecture as the AUTHORITY SPINE, wrapped by a
> *TrustGraph*-style PROJECTION + RETRIEVAL shell. The synthesis is named
> *BeepGraph*." … "*EO is the spine; TG is the shell.*"
> — `docs/BEEPGRAPH_ARCHITECTURE.md` §1

Its status line is honest: **"Proposed"** (`docs/BEEPGRAPH_ARCHITECTURE.md`
header), and the memory doctrine records the same: "BeepGraph is **specced, not
shipped**" with "the **authority spine** … largely built … the projection/
retrieval shell and the extraction kernel are the net-new work"
(`standards/memory-architecture/01-memory-layer-taxonomy.md:113`).

### 1.5 The agent-knowledge doctrine

The agent-memory direction is not "add a graph"; it is a theorem-constrained
layering. `standards/memory-architecture/00-no-escape-theorem.md` opens:

> "Every semantic memory system forgets. Every semantic memory system
> fabricates. This is not a quality problem. It is a mathematical consequence of
> organizing information by meaning."

From that, the four-layer taxonomy assigns each layer an INSIDE/OUTSIDE verdict
and a single routing rule:

> "Always route queries to the highest-certainty layer that can answer them."
> — `standards/memory-architecture/01-memory-layer-taxonomy.md:147`

Layer 1 (curated files) and Layer 3 (deterministic code graph) are OUTSIDE the
theorem; Layer 4 (relational/conceptual semantic graph) is INSIDE and is
explicitly a **managed-degradation** problem, not a solvable one
(`01-memory-layer-taxonomy.md:102-115`). The 2026-07-25 academia dispatch split
Layer 2 into *exact episodic records* (OUTSIDE, retention-governed) and
*prunable semantic projections* (INSIDE, consolidation-governed)
(`01-memory-layer-taxonomy.md:38-43`).

**End-state in one line:** a local-first IP-practice workbench whose durable
memory is a schema-first, span-grounded, bitemporal claim/evidence store in
Postgres/PGlite; whose "knowledge graph", search, RDF, and MCP surfaces are all
rebuildable projections of that store; and whose ontology layer is repo-owned
SKOS minted under `https://ns.beep.sh/` with external vocabularies as *aligned
metadata*, never source of truth.

---

## 2. The architectural bets

Nine bets, each with its owning packet, stage, and the decisions already locked.

### Bet 1 — Effect Schema is the ontology substrate; RDF is a projection

- **Owner:** `goals/semantic-foundation` (lifecycle `active`); doctrine mirrored
  in `explorations/legal-ontology-landscape/DECISIONS.md`.
- **Locked:** D2 as summarized in the Lynx grounding — "**Effect Schema is the
  authority and RDF/JSON-LD is derived**"; also "no third-party TTL/OWL in
  tracked package source"; "`https://ns.beep.sh/` is the sole minting
  authority"; "FOLIO alignment is metadata, never source of truth"
  (`explorations/lynx-lkg-ontology-grounding/RESEARCH.md:94-100`).
- **SPEC form:** "repo-owned SKOS concept schemes minted with `@beep/identity`
  under `https://ns.beep.sh/`, FOLIO-aligned where vetted … without introducing
  a graph store, SPARQL runtime, or law-practice domain entities"
  (`goals/semantic-foundation/SPEC.md:6-12`).
- **Stage:** **M1 complete**, M2/M3/M4 gated (`goals/semantic-foundation/README.md:40-41`;
  milestone table at `goals/semantic-foundation/SPEC.md:96-101`).
- **Known caveat, in-packet:** *no vendor slice is live-wired* — "research names
  no slice `VETTED` for loading, so package-local fixtures prove the fail-closed
  loader contract", and pointing the loader at the real asset-pack manifest
  "fails closed with a parse error" (the R1 caveat,
  `goals/semantic-foundation/README.md:49-60`).
- **Adjacent proof:** the identity strand makes the schema↔IRI equivalence
  literal — "identity path and IRI as two literal-typed encodings of one value,
  borrowed RDF vocab as CURIE literal types, `$I.ontology` fold over
  triples-as-tuples" (`explorations/ATLAS.md:330-334`). `identity-iri-core` is
  `completed-retained`; `identity-iri-fold` is `active`; `identity-iri-fibered`
  remains gated.

### Bet 2 — Graph-is-projection: no graph store, no SPARQL engine in the registry

- **Owner:** `goals/legal-document-intake` D6 + `goals/semantic-foundation`.
- **Locked (intake D6):** "Postgres/PGlite projection: nodes/edges as
  schema-first tables; embeddings via pgvector; two-hop traversal via recursive
  SQL. … Dedicated graph DB stays a later optimization behind the same port."
  (`goals/legal-document-intake/SPEC.md`, decision table row D6).
- **Locked (semantic-foundation non-goals):** "No SPARQL engine wiring in v1.
  The contract stays `UnsupportedSparqlQueryServiceLive`" and "No graph store"
  (`goals/semantic-foundation/SPEC.md:14-19`); constraint restated at
  `SPEC.md:74-77`.
- **Refinement (remo2, 2026-08-01):** a derived `MatterProjection` does **not**
  violate the lock — "rows first plus an in-memory RDF lane … typed Effect
  queries over materialized rows rebuilt from accepted claims, never
  authoritative. Lineage/path queries may spin a *disposable* in-memory
  `@beep/rdf` dataset session" (`explorations/legal-patent-kg-deepening/DECISIONS.md:161-178`).
- **Stage:** doctrine settled; the intake KG loop itself (P4) is the *active*
  phase (`goals/legal-document-intake/README.md:54-58`), i.e. the doctrine is
  ahead of the implementation.

### Bet 3 — Deterministic extraction with verified spans ("ground before cite")

- **Owner:** `explorations/citation-grounding-hallucination-guard` (stage
  `graduate`, still active) → `goals/citation-verified-span-substrate`,
  `goals/citation-extraction-engine`; doctrine at
  `docs/product/citation-grounding.md`.
- **Ratified doctrine:** "**Ground before cite.** No citation or quotation
  reaches legal work product unless identified source text verifies the exact
  raw span it would emit." (`docs/product/citation-grounding.md:3-4`), and
  "Machine output therefore has zero citation authority."
  (`docs/product/citation-grounding.md:24`).
- **Locked mechanics:** Q7 — "Normalization of whitespace and typographic quotes
  is a locator only. Do not case-fold and do not fuzzy-match. Replace the
  emitted quote with the exact raw source slice and require
  `source.slice(start, end) === quote`."
  (`explorations/citation-grounding-hallucination-guard/DECISIONS.md:379-390`).
- **Locked scope:** Q3 verified-span-first, *not* parser-first
  (`.../DECISIONS.md:286-308`); Q4 local-only v1, CourtListener never the parser
  or grounding truth (`.../DECISIONS.md:310-326`); Q1 **USER OVERRIDE** —
  port/reimplement eyecite in Effect rather than adopt `eyecite-js`
  (`.../DECISIONS.md:229-258`); Q5 the three-home package split
  (`.../DECISIONS.md:328-352`).
- **Stage:** `citation-verified-span-substrate` at **P1 implement, green**
  (`goals/citation-verified-span-substrate/README.md:35-41`);
  `citation-extraction-engine` at P0 evidenced but "production contract work is
  blocked by the verified-span and public reporter-vocabulary goals"
  (`goals/citation-extraction-engine/README.md:9-11`);
  `court-reporter-vocabulary` at P1a with P1b pending
  (`goals/court-reporter-vocabulary/README.md:32-37`).
- **Sibling consumer:** `explorations/deterministic-doc-structure-extraction`
  ("Versioned, deterministic, fail-closed recognition of non-citation legal
  document structure, expressed as evidence-backed candidates")
  graduated `goals/law-doc-structure-oa-slice`, whose "P1 remains blocked until
  `citation-verified-span-substrate` P0/P1 proves the shared verified-anchor
  contract" (`goals/law-doc-structure-oa-slice/README.md:35-40`).

### Bet 4 — Bitemporal, invalidate-don't-delete graph memory

- **Owner:** `explorations/agent-memory-tiers-bitemporal-edges` (stage
  `graduate`; retention lane still open) → `goals/epistemic-bitemporal-edge-core`
  (`completed-retained`) → `goals/epistemic-contradiction-triage` (`active`, P2).
- **Locked, Decision 4:** "Durable truth lives in repo-native Postgres through
  epistemic domain entities, `@beep/epistemic-tables`, server-owned
  transactional repositories, and `@beep/db-admin` migrations. **No external
  graph vendor enters the authority path.** Any future graph service is
  optional, rebuildable, driver-isolated, fed only from accepted authority
  records, and prohibited from direct authoritative writes."
  (`explorations/agent-memory-tiers-bitemporal-edges/DECISIONS.md:118-135`).
- **Locked, Decision 7:** half-open `[validFrom, validTo)` and
  `[recordedAt, expiredAt)`; open ends are SQL `NULL` through Effect Schema
  `Option`; "magic dates are forbidden"; fact payloads immutable; "'Latest' is
  derived from open intervals; no persisted `isLatest`"
  (`.../DECISIONS.md:186-211`).
- **Locked, Decision 6:** `CONTRADICTS` is a persisted, evidence-backed,
  reviewable relation; "Detection creates a candidate … and never changes
  authoritative validity" (`.../DECISIONS.md:163-184`).
- **Locked, scope determination:** product memory ≠ operator memory. "Product
  tables must never become an operator-memory backend."
  (`.../DECISIONS.md:15-21`); reaffirmed by remo3
  (`explorations/legal-patent-kg-deepening/DECISIONS.md:180-198`).
- **Queued composition:** `explorations/epistemic-belief-view-revision` was
  chosen as *the* first composition over the core — "Preferred belief views …
  what does the attorney currently believe, and why, with inconsistent evidence
  retained rather than destroyed" (`explorations/academia-corpus-mining/DECISIONS.md`,
  "align: first composition over the bitemporal core (master Q4)"). It sits at
  capture stage (`explorations/ATLAS.md:147-155`).

### Bet 5 — Ontology grounding: borrow patterns, not vocabularies

- **Owner:** `explorations/lynx-lkg-ontology-grounding` (stage `align`),
  successor to graduated `explorations/legal-ontology-landscape`; wave-2 corpus
  work in `explorations/legal-patent-kg-deepening` (stage `align`).
- **Verdict:** "Lynx is a **pattern donor, not a vocabulary donor**."
  (`explorations/lynx-lkg-ontology-grounding/RESEARCH.md:192`). The shortlist:
  (1) attributed multi-claim span annotation reshaping `nif:AnnotationUnit` onto
  `EvidenceSpan`/`TextAnchorFields`; (2) `lkg.ttl` (CC-BY-4.0, 12.7 KB) as the
  first real **VETTED** vendor slice, forcing the R1 manifest reconciliation;
  (3) a lang-map combinator; (4) schema→SHACL projection into the M4 lane;
  (5) an ELI temporal/FRBR donor profile for the unopened
  `legal-rule-time-identity` slug (`RESEARCH.md:192-200`).
- **The negative finding is the important one:** "**Zero patent or IP modelling
  anywhere in the corpus.**" (`RESEARCH.md:82-84`), therefore "Lynx unlocks
  **nothing** for M2, M3, case law, or clause-level contracts — recorded as a
  result, not an omission" (`RESEARCH.md:199-200`), and the largest declared
  vocabulary hole (docketing obligations) "is **still uncovered after this
  packet**" (`research/05-value-assessment.md` §0).
- **Corroboration, not adoption:** Lynx runs ~70M triples with "the concept
  layer is SKOS, never OWL … zero OWL reasoning" — read as "the strongest
  external validation in this packet — cite it, do not re-decide it"
  (`research/05-value-assessment.md` L15). And LKG's four published artifacts
  disagreeing in 18 places is filed as "D2 … demonstrated by counterexample"
  (`research/05-value-assessment.md` §0.3).
- **Stage caveat:** `DECISIONS.md` in this packet is still the **unfilled
  template** (`explorations/lynx-lkg-ontology-grounding/DECISIONS.md:10-18`) —
  the align grill has not run, so none of the five shortlist items is locked.
- **The wave-2 strand is the productive one:** `legal-patent-kg-deepening`
  signed off an 8-cluster routing matrix and has produced three wedges, two of
  them fully graduated — `patent-citation-candor-gate` (`completed-retained`,
  implemented via PR #575) and `legal-position-relator-runtime` (`active`, P0
  not started) — with `patent-drafting-episode-ledger` at capture
  (`explorations/legal-patent-kg-deepening/README.md:45-119`).

### Bet 6 — Legal semantics as closed, derivable domains (not ontology imports)

- **Owner:** `goals/legal-position-relator-runtime` (graduated 2026-08-06).
- **Shape:** "A closed eight-member `HohfeldPosition` domain whose correlative
  and opposite derivations range over `(kind, content)` … plus a simple
  `LegalPositionRelator` storing one advantage-side relation and deriving every
  other view" (`explorations/ATLAS.md:380-387`).
- **Locked boundary (remo1, 2026-08-01):** correlativity lands "now as Effect
  Schema constructs (LiteralKit eight-position domain + correlative bimap in the
  consuming domain package; registry data untouched)"; registry-carried
  executable shapes route to the semantic-foundation **M4** gate
  (`explorations/legal-patent-kg-deepening/DECISIONS.md:141-159`).
- **Locked boundary (contradiction cluster):** "Compose, don't widen" — legal
  vocabulary rides with the relator wedge; the generic
  `epistemic-contradiction-triage` SPEC is not amended
  (`.../DECISIONS.md:254-275`).
- This is the repo's answer to "which legal ontology do we import": it doesn't.
  It ports the *formalism* (Hohfeld/FLINT/UFO-L) into closed LiteralKit domains
  in a law-owned package, and keeps external ontologies as alignment metadata.

### Bet 7 — Corpus pipelines and the MCP delivery surface as the KG's front door

- **Owner:** `goals/practice-kg-mcp` (`active`), over the `completed-retained`
  `goals/oppold-corpus-pipeline` / `oppold-corpus-refresh` substrate.
- **Strategic frame, verbatim:** "The MCP surface is not an interim shim around
  `apps/professional-desktop`; it is **the product thesis executed** — the
  integration layer that multiplies Claude Desktop (client #1; Word, Outlook,
  cron jobs, and codex-style background processes are the same consumer)."
  (`goals/practice-kg-mcp/SPEC.md:16-22`).
- **Acceptance framing:** "a question Tom actually asks, answered verifiably
  better than grep over his SSD corpus copy … Cross-document joins, provenance,
  and side-by-side document pulls are the wedge; 'tables populated' is not
  success." (`goals/practice-kg-mcp/SPEC.md:24-27`).
- **Locked:** D-1 P4-lite (defer librarian/critic/SHACL to intake P4-proper);
  D-4 read-only, every candidate labeled `candidate — unreviewed`; D-6 storage
  per intake D6 (PGlite KG rows + DuckDB catalog/FTS); D-9 placement ruling —
  "An MCP host inherits the family of what it exposes"
  (`goals/practice-kg-mcp/SPEC.md:32-41`).
- **Stage and honest state:** P5 acceptance. AC-2 is **not met** — "graph nodes
  (family / application / patent) do **not** resolve in the shipped build"
  (D-10, `goals/practice-kg-mcp/SPEC.md:40`), and the gauntlet record says the
  "graph layer NOT trustworthy in the shipped build (cross-client family
  contamination + mention-derived cartesian joins)"
  (`goals/practice-kg-mcp/README.md:61-68`). This packet also "takes live
  ownership of the knowledge-graph scope orphaned when
  `goals/ip-law-knowledge-graph` was deleted (2026-07-14, PR #401)"
  (`goals/practice-kg-mcp/SPEC.md:10-12`).
- **Adjacent official-data spine:** `goals/uspto-prosecution-read` (`active`,
  "Not started", `goals/uspto-prosecution-read/README.md:34-40`),
  `goals/uspto-mcp` (`completed-retained`), `goals/uspto-ptmnfee2-ingest`
  (`active`).

### Bet 8 — Retrieval as a single, explainable, non-admitting fusion seam

- **Owner:** `goals/hybrid-retrieval-fusion-core` (`active`), from
  `explorations/rag-retrieval-projection` (stage `graduate`, four gated
  satellites).
- **Shape:** "a deterministic, fixture-driven hybrid retrieval seam that fuses
  semantic, lexical FTS, literal, and optional graph ranks while preserving
  spans, explaining every channel contribution, and **remaining outside
  admission**" (`goals/hybrid-retrieval-fusion-core/README.md:11-14`).
- **Locked upstream:** the memory packet defers "RRF arithmetic to that packet
  as the single owner" and rejects "A third RRF implementation"
  (`explorations/agent-memory-tiers-bitemporal-edges/DECISIONS.md:71-86`).
- **Stage:** P0 not started (`goals/hybrid-retrieval-fusion-core/README.md:33-38`).
- This bet is the operational discharge of the No-Escape theorem: hybrid
  retrieval is named in the doctrine as the way to "navigate the frontier even
  though no single component escapes"
  (`standards/memory-architecture/01-memory-layer-taxonomy.md:108`).

### Bet 9 — Workspace-as-data / computable geometry (agents gain sight)

- **Owner:** `explorations/computable-workspace-geometry` (stage `graduate`) →
  `goals/pretext-driver`.
- **Thesis:** "text layout as pure arithmetic over shippable per-engine font
  metrics closes the workspace-as-data composition — rendered geometry becomes
  data, agents gain sight" (`explorations/ATLAS.md:167-173`).
- **Locked Q1:** consume/wrap `@chenglou/pretext` as `@beep/pretext`, because
  "Pretext's irreplaceable asset is not its architecture — it is the **validated
  corpus**" (`explorations/computable-workspace-geometry/DECISIONS.md`, Q1).
- **Locked Q2:** versioned `FontMetricsV1` envelope; unknown higher version
  "hard-fails typed (no silent degrade)" (same file, Q2).
- Relevance to KG: this is the same schema-first-projection instinct applied to
  the *render* surface — the workbench's visual state becomes queryable data on
  the same terms as its knowledge state.

### Bet 10 (emerging) — Graded external corpora as the measurement instrument

- **Owner:** `explorations/harvey-lab-firm-knowledge` (stage `research`,
  opened and mined 2026-08-08).
- **Locked already:** the C&H corpus is a **standing test asset** — "can and
  should be leveraged to test aspects of beep-effect against — ingestion,
  retrieval, indexing, knowledge-graph construction, agentic search, judge
  pipelines … Any goal graduated from this packet must carry this directive
  forward in its SPEC"
  (`explorations/harvey-lab-firm-knowledge/DECISIONS.md:10-31`).
- **Locked already:** eval code is "**Roll our own, better**" — reference for an
  Effect-native eval with "schema-first rubrics (Effect Schema instead of loose
  JSON), typed judge services"
  (`explorations/harvey-lab-firm-knowledge/DECISIONS.md:33-53`).
- This is the first packet in the strand whose deliverable is *measurement of
  the KG bet* rather than more KG capability — a structurally new move.

---

## 3. Sequencing and coherence

### 3.1 The dependency spine (as the packets themselves declare it)

```
provenance / identity substrate
  @beep/provenance TextAnchor · @beep/identity IdentityComposer ($I)
        │                                   │
        ▼                                   ▼
citation-verified-span-substrate      identity-iri-core → identity-iri-fold
  (P1 green)                            (done)            (active) → fibered (gated)
        │
        ├────────────► citation-extraction-engine (blocked on ↑ + court vocab)
        ├────────────► law-doc-structure-oa-slice  (P1 blocked on ↑)
        └────────────► ground-before-cite integration (lane 3, gated)

epistemic-bitemporal-edge-core (done)
        ├────────────► epistemic-contradiction-triage (P2, active)
        └────────────► epistemic-belief-view-revision (capture; designated
                       first composition)

semantic-foundation M1 (done) ─┬─ M2 classifications (gated: metric/demo pull)
                               ├─ M3 docketing + party roles (gated behind M2)
                               └─ M4 ClaimGate SHACL shapes (gated; receives
                                    remo1 constraint profiles + Lynx #4)

oppold-corpus-pipeline (done) ──► practice-kg-mcp (P5; AC-2 unmet)
                                     └─ handoff ──► legal-document-intake P4→P6
                                                      └─ P5 retrieval needs
                                                         hybrid-retrieval-fusion-core
                                                         (not started)
legal-patent-kg-deepening (align) ──► candor gate (done) ──► relator runtime
                                        (P0 not started) ──► episode ledger (capture)
lynx-lkg-ontology-grounding (align; DECISIONS empty) ──► feeds semantic-foundation
                                                          M4 + a multi-claim
                                                          span-annotation change
harvey-lab-firm-knowledge (research) ──► measurement over all of the above
```

`docs/ROADMAP.md:55-66` confirms the live front: practice-kg-mcp this week,
`legal-document-intake` P4–P6 resuming after handoff, semantic-foundation
"scoped to **M1** … and **M4**" with M2/M3 in NEXT (`docs/ROADMAP.md:98-102`).

### 3.2 Where the direction is genuinely coherent

1. **One authority, many projections.** Every packet that could have claimed
   authority explicitly declines it: `agent-memory-tiers` D4 (no graph vendor in
   the authority path), intake D6 (rows, not a graph DB), remo2 (`MatterProjection`
   "never authoritative"), remo3 (Cognee may carry "a lossy, rebuildable
   projection … and is never their authority"). Four independent grills, one
   answer. That is unusually strong coherence.
2. **Slice boundaries hold under pressure.** "Keep citation/IP-law vocabulary
   OUT of the epistemic/shared slice" is enforced in the citation packet
   (`DECISIONS.md:328-352`), in the contradiction cluster re-route
   (`legal-patent-kg-deepening/DECISIONS.md:254-275`), and in the
   architecture-guardian placement ruling for the MCP host
   (`practice-kg-mcp/SPEC.md:41`). No packet has been allowed to widen a
   completed kernel; the standing verb is "compose, don't widen".
3. **Single-owner rules for cross-cutting math.** RRF has exactly one owner;
   the verbatim gate has exactly one owner; the eyecite port has exactly one
   owner after the Q1 user override propagated into
   `deterministic-doc-structure-extraction` (`citation-grounding.../DECISIONS.md:248-252`).
4. **Refusal is recorded as a result.** Lynx's "unlocks nothing for M2/M3" and
   the harvey ledger's 10 WEAKEN / 2 KILL are written down rather than quietly
   dropped. The graduation pipeline produces *negative* findings that stick.
5. **Operator memory vs product memory never blur.** The doctrine
   (`standards/memory-architecture/`) governs Claude/Codex dev memory; the
   epistemic slice governs product truth; remo3 wrote the missing clarification
   the moment an /adhd lens found the ambiguity.

### 3.3 Where packets pull against each other

1. **"No graph store" vs the named architecture and the PRD roadmap.**
   `semantic-foundation/SPEC.md:14-19` and intake D6 forbid a graph DB;
   `docs/BEEPGRAPH_ARCHITECTURE.md` §1 makes a "TG-style FalkorDB graph +
   GraphRAG retrieval" the shell of the named architecture, and
   `docs/product/prose-to-proof.md:62,149-151` still lists "full GraphRAG, and
   full FalkorDB projection (GA)" and a P3 "graph & ask" / P4 OWL 2 EL/RL
   reasoner. remo2 reconciles the *registry* half; the PRD's GA phases are still
   written in FalkorDB terms. BEEPGRAPH is marked "Proposed" and has not been
   reconciled to remo2's rows-first-plus-disposable-RDF form. **Risk: a future
   session reads BEEPGRAPH as current.**
2. **"No SPARQL in v1" vs two shipped SPARQL surfaces.** `semantic-foundation`
   holds `UnsupportedSparqlQueryServiceLive`, while
   `docs/product/ontology-agent-surface.md` ships `ontology_sparql_query`
   through Oxigraph with a 200-result ceiling, and the workbench slice has "an
   in-memory SPARQL runner, and a structural reasoner"
   (`explorations/lynx-lkg-ontology-grounding/RESEARCH.md:120-122`). The lock is
   *scoped to the `@beep/ontology` registry surface* — correct, but the scoping
   lives only in a grill rationale (`legal-patent-kg-deepening/DECISIONS.md:172-176`),
   not in the SPEC's own non-goal wording. This is the single most quotable-out-
   of-context tension in the corpus.
3. **Three ontology homes.** `@beep/ontology` (foundation registry, SKOS,
   fail-closed loader), `packages/ontology/*` (workbench slice: named-graph
   partitions asserted/inferred/shapes/provenance, SPARQL, structural reasoner),
   and law-practice KG tables (`practice-kg-mcp` D-9). Each is individually
   justified; nothing in the tree states the three-way boundary in one place.
   `docs/product/ontology-workbench.md` gets closest ("does not replace the
   foundation `@beep/ontology` package").
4. **Two KG projection lanes over the same corpus.** `practice-kg-mcp` ships
   `PracticeKgProjections` plus hand-rolled BM25 in DuckDB SQL
   (`explorations/harvey-lab-firm-knowledge/RESEARCH.md:87-91`), while
   `legal-document-intake` P4 will build the ClaimGate-admitted KG rows and
   `hybrid-retrieval-fusion-core` is the declared single owner of rank fusion.
   The intended reconciliation is "P4-lite now, P4-proper after handoff"
   (`practice-kg-mcp/SPEC.md:32` D-1) — but until the handoff happens the repo
   carries two live retrieval/projection implementations with different
   provenance guarantees.
5. **Lynx's align gate is unopened while its findings are already cited.** The
   Lynx `RESEARCH.md` conclusions are load-bearing in this report and in the
   packet's own README, yet `DECISIONS.md` is a bare template — nothing is
   locked, so the multi-claim `AnnotationUnit` change to `EvidenceSpan` (which
   would touch a *completed-retained* epistemic package) has no ratified
   boundary yet.
6. **`legal-rule-time-identity` is a routed home with no repo path.** Five ELI
   temporal/FRBR items and the `LegalApplicabilityContext` /
   `LegalChangeEvent` / `LegalDocumentVersion` cluster route to an unopened slug
   requiring "Benjamin's routing approval"
   (`explorations/lynx-lkg-ontology-grounding/RESEARCH.md:146-149,174-176`).
   Legal-time semantics is currently homeless.

---

## 4. Honest trajectory risks

### 4.1 Aspiration-to-shipped ratio

Counting only KG/semantic/ingestion-relevant goal packets:

| State | Packets |
|---|---|
| `completed-retained` (16) | oppold-corpus-pipeline, oppold-corpus-refresh, uspto-mcp, epistemic-bitemporal-edge-core, epistemic-claim-lifecycle-gate, ontology-workbench, ontology-workbench-migration, ontology-agent-surface, ontology-interop-roadmap, identity-iri-core, pandoc-ast-foundation, langextract-capability, provenance-shared-claim-kernel, shared-memory-code-kg-wiring, patent-citation-candor-gate, graph-3d-view |
| `active`, mid-flight (6) | semantic-foundation (M1 done), practice-kg-mcp (P5, AC-2 unmet), epistemic-contradiction-triage (P2), citation-verified-span-substrate (P1), court-reporter-vocabulary (P1a), legal-document-intake (P4) |
| `active`, **not started** (3) | uspto-prosecution-read, hybrid-retrieval-fusion-core, legal-position-relator-runtime |
| `active`, **blocked** (2) | citation-extraction-engine, law-doc-structure-oa-slice (P1) |

The substrate half genuinely shipped. The *product* half — the loop that turns a
corpus into an approved, queryable practice memory — has exactly one delivered
artifact (practice-kg-mcp), and its graph layer is the part that failed.

**The sharpest single datum:** the flagship KG deliverable's own SPEC records
that "**AC-2 as a whole remains unmet until node provenance exists or is
declared out of scope with a typed capability boundary**"
(`goals/practice-kg-mcp/SPEC.md:40`). A repo whose central doctrine is
"every durable assertion carries evidence, provenance, lifecycle" shipped a
knowledge graph whose *nodes* carry no provenance. That is not a small
inconsistency; it is the doctrine failing its first field test, and the packet
is commendably explicit about it.

### 4.2 Single-developer bandwidth

- The exploration tree carries **~14 active packets** plus 3 parked and a
  13-packet gold-intake cohort at research-complete
  (`explorations/ATLAS.md:41-372`). Many entries end in "on Benjamin's call":
  the FunctionalUnit extension, wedge opening order, goal execution on both
  graduated `legal-patent-kg-deepening` packets
  (`explorations/legal-patent-kg-deepening/README.md:29-33`), the Lynx align
  session, and the harvey align session.
- The campaign design is *deliberately* serialized to protect one person's
  judgment: "Sequential first wedge only … splits align attention across three
  packets" (`explorations/legal-patent-kg-deepening/DECISIONS.md:234-252`). That
  is the right call and also the binding constraint — the strand produces
  roughly one graduated wedge per 1–2 days of Benjamin-attention, and each wedge
  then queues a goal that mostly has not started.
- Research throughput vastly exceeds execution throughput. In eight days the
  repo produced a 5-agent Lynx run (~834k tokens), a 12-agent harvey run (~2.5M
  tokens, 12 reports), and a 122-distillate legal/patent campaign — while
  `legal-position-relator-runtime`, graduated 2026-08-06, is still "P0 Research
  — not started" (`goals/legal-position-relator-runtime/README.md:40-45`).
  **The pipeline's bottleneck is not knowledge; it is hands.**

### 4.3 Parked / stalled bets

- `explorations/academia-corpus-mining` — parked at align-complete; wave 2 (97
  legal-NLP/extraction papers) approved but deferred; that wave is where "the
  largest remaining source of empirical retrieval and extraction evidence" lives
  (`explorations/academia-corpus-mining/DECISIONS.md`, "align: backlog wave 2").
  The parked bet is precisely the one that would validate Bet 3 and Bet 8
  empirically.
- `explorations/effect-ontology-harvest` — parked, "harvest-not-port complete
  with zero goals by design" (`explorations/ATLAS.md:361-364`).
- `effect-capability-kg` — packet deleted; "Resume on an explicit decision to
  invest in agent capability guidance, as a fresh packet"
  (`explorations/ATLAS.md:365-372`).
- `goals/ip-law-knowledge-graph` — **deleted** 2026-07-14 (PR #401), scope
  re-homed into practice-kg-mcp (`goals/practice-kg-mcp/SPEC.md:10-12`).
  Combined with the `effect-capability-kg` deletion and
  `ontology-modeling-foundation` being superseded by `identity-as-iri`
  (`goals/ontology-interop-roadmap/README.md`), the KG scope has now been
  re-homed three times. Each move was individually justified; the pattern is
  worth naming.
- `goals/domain-kernel-hardening` — "paused until KG tables approach scale with
  PRD P2 librarian; packets 2–7 are held behind it"
  (`explorations/ATLAS.md:233-236`). Seven packets gated on a scale event that
  requires the librarian loop that is itself in intake P4.
- `explorations/knowledge-workspace` — capture-stage since inception
  (`explorations/ATLAS.md:156-159`), and it is the packet that carries the
  "immutable event journal projected into a live graph … auditable temporal
  replay" vision most directly.

### 4.4 What the harvey-lab evidence does to each bet

Read strictly from this packet's own verified reports:

| Bet | Effect | Evidence |
|---|---|---|
| **Deterministic extraction / verified spans (Bet 3)** | **Strengthened, and given a wedge** | 371 tasks with real `w:ins`/`w:del` grade redline work that both the LAB harness and frontier agents are structurally blind to; "unclaimed axis, OIP-load-bearing (claim amendments ARE redlines)" (`RESEARCH.md:134-137`). But gated on U4 — "no tracked-changes awareness anywhere (`rg track-changes` → 0)" (`RESEARCH.md:104-107`). |
| **Ontology/vocabulary depth (Bets 1, 5, 6)** | **Neutral-to-negative** | C&H has "147 IP rubrics (patent-litigation drafting exists; patent *prosecution* does not)" (`RESEARCH.md:64-70`) — so the corpus cannot exercise the OIP vocabulary the repo is building. Conversely the repo is "**Schema-complete for the OIP shapes C&H lacks**" (`RESEARCH.md:92-95`), which is a real but self-referential validation. |
| **Corpus pipelines / ingestion (Bet 7)** | **Weakened on readiness** | "pptx + eml missing from `FileFormatFamily` (660 of 9,288 C&H files unroutable)"; "zero hits for adverse-party/counterparty modeling and matter lifecycle status/dates"; the Pandoc JSON → .docx render lane is absent (`RESEARCH.md:102-109`). |
| **Amortized structural representation (the implicit KG thesis)** | **Weakened by crowding** | Engram "has published prior art for the amortization thesis itself (Cartridges / Active Reading)" — "We would be entering a claimed race on that axis" (`RESEARCH.md:71-74`). Align Q2 is exactly this fork (`RESEARCH.md:177-180`). |
| **practice-kg-mcp acceptance (Bet 7)** | **Explicitly refuted as a shortcut** | "'Unblocks `goals/practice-kg-mcp` P5' is false … it is NOT acceptance evidence for `goals/practice-kg-mcp` P5 (that claim was refuted against the packet's own SPEC)" (`research/verify-refutations.md:91-121`; `RESEARCH.md:131-137`). |
| **Judge / eval machinery (Bet 10)** | **Strengthened, with two live defects found** | beep's judge is "ahead of LAB on output integrity … behind on rubric mechanics" (`RESEARCH.md:96-101`); `extractLastJsonBlock` "hard-fails on correct unfenced judge JSON", and the 16 `QaLens` literals are hand-duplicated with no lint binding them (`RESEARCH.md:110-114`). |

The mining run's own refutation pass is the strongest evidence *for* the
direction's epistemic hygiene: 20 opportunities went in, "**6 KEEP · 2
KEEP-with-condition · 10 WEAKEN · 2 KILL**" came out
(`RESEARCH.md:118-119`), and the strongest *new* finding (redline-blindness) was
produced by the completeness critic attacking the run's own coverage.

### 4.5 The three risks I would rank highest

1. **Provenance completeness is doctrine everywhere and unmet where it shipped.**
   Until practice-kg-mcp AC-2 is either satisfied or converted into "a typed
   capability boundary" (its own D-10 wording), the repo's central claim is
   unproven on its only delivered KG. Everything downstream — intake P4's
   ClaimGate loop, hybrid retrieval's span preservation, the harvey testbed —
   inherits that unproven claim.
2. **The measurement bet arrived after the capability bet, and is cheaper.**
   Bet 10 (graded external corpus + Effect-native eval) could tell the project
   which of Bets 1–9 actually pay, at a fraction of their cost. But it is gated
   on infrastructure the workstation does not have — "podman and pandoc absent
   on DankStation … running any LAB baseline needs metered API keys — the
   subscription-OAuth quota model doesn't cover it"
   (`explorations/harvey-lab-firm-knowledge/RESEARCH.md:155-160`). The cheapest
   validating move is the one blocked by a sudo install and a billing decision.
3. **Ontology work keeps returning "no external donor covers our domain."**
   Wave 1 (`legal-ontology-landscape`), Lynx, and the reference-ontology sweep
   all land on the same result: nothing external models patent prosecution,
   docketing obligations, or clause-level contracts. That is a durable moat
   argument *and* a durable cost argument — every vocabulary in M2/M3 has to be
   authored, not adopted, by one person, and both milestones are gated behind
   demand signals that only a shipped product produces. The gating is circular
   and nobody has written down how it breaks.

---

## 5. Sources

Every file below was read in this session. Line citations refer to the file as
it exists at 2026-08-08 on branch `main`.

**Navigation & product prose**
- `explorations/ATLAS.md`
- `docs/ROADMAP.md`
- `docs/BEEPGRAPH_ARCHITECTURE.md`
- `docs/product/prose-to-proof.md`
- `docs/product/citation-grounding.md`
- `docs/product/ontology-agent-surface.md`
- `docs/product/ontology-workbench.md`

**Standards & doctrine**
- `standards/memory-architecture/00-no-escape-theorem.md`
- `standards/memory-architecture/01-memory-layer-taxonomy.md`
- `standards/ARCHITECTURE.md` (searched; no dedicated semantic-family section —
  the semantic/KG families are documented in the packets and product docs, not
  the architecture standard)

**Exploration packets**
- `explorations/harvey-lab-firm-knowledge/README.md`
- `explorations/harvey-lab-firm-knowledge/RESEARCH.md`
- `explorations/harvey-lab-firm-knowledge/DECISIONS.md`
- `explorations/harvey-lab-firm-knowledge/research/OPPORTUNITIES.md`
- `explorations/harvey-lab-firm-knowledge/research/SOURCES.md`
- `explorations/harvey-lab-firm-knowledge/research/verify-refutations.md`
- `explorations/lynx-lkg-ontology-grounding/README.md`
- `explorations/lynx-lkg-ontology-grounding/RESEARCH.md`
- `explorations/lynx-lkg-ontology-grounding/DECISIONS.md` (template — unfilled)
- `explorations/lynx-lkg-ontology-grounding/research/05-value-assessment.md`
- `explorations/legal-patent-kg-deepening/README.md`
- `explorations/legal-patent-kg-deepening/DECISIONS.md`
- `explorations/agent-memory-tiers-bitemporal-edges/DECISIONS.md`
- `explorations/citation-grounding-hallucination-guard/DECISIONS.md`
- `explorations/deterministic-doc-structure-extraction/README.md`
- `explorations/docx-roundtrip-interop/README.md`
- `explorations/academia-corpus-mining/DECISIONS.md`
- `explorations/computable-workspace-geometry/DECISIONS.md`

**Goal packets**
- `goals/agentic-professional-runtime/SPEC.md`
- `goals/semantic-foundation/SPEC.md`, `goals/semantic-foundation/README.md`
- `goals/practice-kg-mcp/SPEC.md`, `goals/practice-kg-mcp/README.md`
- `goals/legal-document-intake/SPEC.md`, `goals/legal-document-intake/README.md`
- `goals/citation-verified-span-substrate/README.md`
- `goals/citation-extraction-engine/README.md`
- `goals/court-reporter-vocabulary/README.md`
- `goals/law-doc-structure-oa-slice/README.md`
- `goals/epistemic-bitemporal-edge-core/README.md`
- `goals/epistemic-contradiction-triage/README.md`
- `goals/legal-position-relator-runtime/README.md`
- `goals/hybrid-retrieval-fusion-core/README.md`
- `goals/uspto-prosecution-read/README.md`
- `goals/ontology-interop-roadmap/README.md`
- `goals/knowledge-surface-automation/README.md`
- `goals/trustgraph-doc-ontology/ops/manifest.json`
- Lifecycle values for 32 KG-relevant goal packets read from
  `goals/<slug>/ops/manifest.json`

**Not read (deliberately):** the `harvey-labs` clone at
`~/YeeBois/research/harvey-labs`; any external URL; implementation sources under
`packages/**/src` (the sibling agent's scope).
