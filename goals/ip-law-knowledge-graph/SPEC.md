# IP Law Knowledge Graph

## Status

**PENDING**

## Supersession Note (2026-07-08)

This packet retains its knowledge-graph projection scope (deferred). Its
ontology-survey scope (LKIF-Core/IPRonto/ALIS/Copyright-Ontology/JudO/LCBR/
ESTRELLA/WIPO-IPC survey work) is superseded by
[`goals/semantic-foundation`](../semantic-foundation/README.md). The
FalkorDB/Cypher storage choice below is deferred pending the P4
semantic-topology report at
`explorations/legal-ontology-landscape/research/05-semantic-topology-recommendation.md`;
v1 follows [`goals/legal-document-intake`](../legal-document-intake/README.md)
D6: Postgres/PGlite projection.

## Owner

@beep-team

## Created / Updated

- **Created:** 2026-03-03
- **Updated:** 2026-03-03

## Quick Navigation

### Root

- [README.md](./README.md) — overview, status, and reading order
- [SPEC.md](./SPEC.md) — authoritative initiative contract
- [PLAN.md](./PLAN.md) — current implementation posture
- [history/quick-start.md](./history/quick-start.md) — 5-minute executive summary
- [history/reflection-log.md](./history/reflection-log.md) — Phase-by-phase learnings

### Handoffs

- [ops/handoffs/HANDOFF_P0.md](./ops/handoffs/HANDOFF_P0.md) — P0 Ontology Research handoff
- [ops/handoffs/HANDOFF_P1.md](./ops/handoffs/HANDOFF_P1.md) — P1 Schema Design handoff
- [ops/handoffs/HANDOFF_P2.md](./ops/handoffs/HANDOFF_P2.md) — P2 Implementation Plan handoff
- [ops/handoffs/HANDOFF_P3.md](./ops/handoffs/HANDOFF_P3.md) — P3 Implementation handoff
- [ops/handoffs/HANDOFF_P4.md](./ops/handoffs/HANDOFF_P4.md) — P4 Verification handoff
- [ops/handoffs/P0_ORCHESTRATOR_PROMPT.md](./ops/handoffs/P0_ORCHESTRATOR_PROMPT.md)
- [ops/handoffs/P1_ORCHESTRATOR_PROMPT.md](./ops/handoffs/P1_ORCHESTRATOR_PROMPT.md)
- [ops/handoffs/P2_ORCHESTRATOR_PROMPT.md](./ops/handoffs/P2_ORCHESTRATOR_PROMPT.md)
- [ops/handoffs/P3_ORCHESTRATOR_PROMPT.md](./ops/handoffs/P3_ORCHESTRATOR_PROMPT.md)
- [ops/handoffs/P4_ORCHESTRATOR_PROMPT.md](./ops/handoffs/P4_ORCHESTRATOR_PROMPT.md)

### History

- [ops/manifest.json](./ops/manifest.json) — Phase status tracking
- [history/outputs/p0-ontology-research.md](./history/outputs/p0-ontology-research.md) — Ontology survey findings
- [history/outputs/p1-schema-design.md](./history/outputs/p1-schema-design.md) — Effect Schema definitions
- [history/outputs/p2-implementation-plan.md](./history/outputs/p2-implementation-plan.md) — File-level build plan
- [history/outputs/p3-implementation-notes.md](./history/outputs/p3-implementation-notes.md) — Implementation record
- [history/outputs/p4-verification.md](./history/outputs/p4-verification.md) — Final verification evidence

---

## Purpose

### Problem

No TypeScript + Effect v4 knowledge graph exists for intellectual property law that is grounded in published OWL ontologies. IP attorneys and legal technologists lack a typed, composable graph layer for reasoning about patents, trademarks, copyrights, licensing, and jurisdictional scope. Existing solutions are either SPARQL-only academic prototypes or untyped JavaScript libraries with no formal ontological basis.

### Solution

A 5-phase spec that produces:

1. A curated survey of 7 published OWL ontologies covering IP law, legal reasoning, and normative concepts.
2. Effect Schema definitions (tagged unions + typed edge records) grounded in those ontologies.
3. A FalkorDB-backed graph storage layer with Cypher queries.
4. A seed data pipeline demonstrating patent, trademark, and copyright scenarios.
5. Full verification against repository quality gates.

### Why It Matters

- **Formal grounding** — OWL ontologies provide a peer-reviewed conceptual backbone; the graph is not ad-hoc.
- **Effect-first composability** — Schema-driven nodes and edges integrate with the repo's Effect pipelines for error decomposition, dependency injection, and type safety.
- **Attorney-facing potential** — Downstream UIs and search tools can rely on a well-typed, well-documented graph API rather than raw SQL or unstructured documents.

---

## Source-of-Truth Contract

The following 7 OWL ontologies serve as the formal conceptual grounding for this knowledge graph. All class hierarchies, object properties, and reasoning constraints referenced in this spec trace to these sources.

| # | Ontology | Domain | Access URL |
|---|---|---|---|
| S1 | LKIF-Core | Upper legal ontology (norms, roles, actions, expressions) | https://github.com/RinkeHoekstra/lkif-core |
| S2 | IPRonto / ALIS | Intellectual property rights (patents, trademarks, designs) | https://cordis.europa.eu/project/id/IST-2001-33174 |
| S3 | Copyright Ontology | Copyright law (works, rights, authorship, licensing) | https://rhizomik.net/ontologies/copyrightonto/ |
| S4 | JudO | Judicial decisions and case law structure | https://github.com/legalontology/JudO |
| S5 | LCBR | Legal case-based reasoning patterns | https://papers.ssrn.com/sol3/papers.cfm?abstract_id=3689543 |
| S6 | ESTRELLA | European legal knowledge management framework | https://cordis.europa.eu/project/id/IST-2004-027655 |
| S7 | WIPO IPC | International Patent Classification hierarchy | https://www.wipo.int/classifications/ipc/en/ |

**Contract:** Every node type and edge type in the schema design (P1) must cite at least one source from S1-S7. Types that cannot be traced to a published ontology require an explicit ADR justifying their inclusion.

---

## Scope

### In Scope

- Survey and analysis of 7 OWL ontologies for IP law coverage, class hierarchies, and object properties
- Effect Schema definitions for 15 node types and 11+ edge types as tagged unions
- FalkorDB graph storage with Cypher create/read/query operations
- Seed data covering patent, trademark, and copyright scenarios (10-20 representative entities)
- Query API for sub-graph extraction, path traversal, and type-filtered search
- Full verification against `pnpm check`, `pnpm lint-fix`, `pnpm test`, `pnpm build`

### Out of Scope

- Web UI or visual graph explorer
- Production deployment, scaling, or multi-tenant configuration
- SPARQL endpoint or OWL reasoner runtime
- Full corpus ingestion (WIPO bulk data, USPTO bulk data, case law corpora)
- Natural language query interface or LLM-driven question answering
- Cross-repo integration with existing knowledge-server package

---

## Architecture Decision Records

| ADR | Decision Surface | Decision | Rationale |
|---|---|---|---|
| ADR-001 | Ontology selection strategy | LKIF-Core as upper ontology; domain modules (IPRonto, Copyright Ontology, JudO) layered on top | LKIF-Core [S1] provides the broadest legal upper ontology with stable class hierarchies for norms, roles, and expressions. Domain ontologies [S2][S3][S4] specialize IP-specific concepts without duplicating upper-level abstractions. |
| ADR-002 | Graph database | FalkorDB | Aligns with repo-codegraph-canonical precedent in this repository. GraphBLAS engine provides sub-millisecond traversal. Zero external infrastructure for dev. falkordblite available for testing. |
| ADR-003 | OWL parsing approach | rdfxml-streaming-parser + n3.js in TypeScript | No Python dependency. Both packages are maintained, ESM-compatible, and handle RDF/XML and Turtle serializations that the target ontologies use. Streaming parser keeps memory bounded for large ontology files. |
| ADR-004 | Effect Schema mapping | OWL classes map to tagged unions with `_tag`; object properties map to typed edge records | Preserves OWL class hierarchy semantics via discriminated unions. Edge records carry source/target node IDs + relationship metadata. Integrates with existing repo `S.TaggedClass` patterns. |
| ADR-005 | Query language | Cypher via FalkorDB (no SPARQL runtime) | FalkorDB natively supports Cypher. Avoids introducing a SPARQL runtime dependency. Cypher is sufficient for sub-graph extraction, path queries, and property filtering required by this spec. |

---

## Phase Breakdown

| Phase | Focus | Deliverable | Exit Criteria |
|---|---|---|---|
| P0 | Ontology Research | `history/outputs/p0-ontology-research.md` | All 7 ontologies surveyed; key classes, object properties, and reasoning constraints documented; class-to-node-type mapping proposed |
| P1 | Schema Design | `history/outputs/p1-schema-design.md` | 15 node types + 11 edge types defined as Effect Schema tagged unions; OWL traceability annotations present; no open design decisions |
| P2 | Implementation Plan | `history/outputs/p2-implementation-plan.md` | File-level build plan with package scaffold, dependency order, seed data strategy, and quality gates defined |
| P3 | Implementation | `history/outputs/p3-implementation-notes.md` | All source files implemented; seed data loaded; tests passing; deviations from P2 plan documented |
| P4 | Verification | `history/outputs/p4-verification.md` | `pnpm check`, `pnpm lint-fix`, `pnpm test`, `pnpm build` all pass; failure classifications resolved; final readiness statement signed off |

---

## Success Criteria

- [ ] All 7 OWL ontologies surveyed with class hierarchies and object properties documented
- [ ] 15 node types defined as `S.TaggedClass` with `_tag` discriminant and OWL source annotation
- [ ] 11+ edge types defined as typed records with source/target node ID references
- [ ] FalkorDB graph storage layer with create, read, and query operations
- [ ] Seed data covering at least 1 patent scenario, 1 trademark scenario, and 1 copyright scenario
- [ ] Cypher query API supports sub-graph extraction by node type and path traversal by edge type
- [ ] Every node and edge type traces to at least one source ontology (S1-S7)
- [ ] `pnpm check` passes with zero type errors in the new package
- [ ] `pnpm lint-fix` produces no remaining warnings
- [ ] `pnpm test` passes all tests in the new package

---

## Risks and Mitigations

| Risk | Impact | Likelihood | Mitigation |
|---|---|---|---|
| OWL ontology files unavailable or broken URLs | P0 blocked; cannot verify class hierarchies | Medium | Cache ontology files locally during P0; document fallback sources; IPRonto/ALIS may require CORDIS archive retrieval |
| OWL reasoning constraints lost in translation to Effect Schema | Schema does not capture cardinality, disjointness, or transitivity from OWL | High | Document every dropped constraint in P1 output with explicit justification; add runtime validation where feasible |
| LKIF-Core class hierarchy too deep for practical tagged unions | Schema becomes unwieldy with 50+ types | Medium | Flatten to 15 domain-relevant types; map deep OWL hierarchies to metadata fields rather than union branches |
| FalkorDB Cypher dialect missing features needed for legal queries | Cannot express required graph patterns | Low | FalkorDB supports OpenCypher subset which covers path queries, OPTIONAL MATCH, and aggregation; verify during P2 |
| rdfxml-streaming-parser cannot parse all target ontology files | P0 research incomplete for affected ontologies | Medium | Fall back to n3.js Turtle parser; some ontologies publish both RDF/XML and Turtle; manual extraction as last resort |
| Seed data insufficient to exercise all node and edge types | Verification gaps; untested schema branches | Medium | Define minimum seed coverage matrix in P2; require at least 1 instance per node type and 1 instance per edge type |

---

## OWL Ontology Survey

| # | Ontology | Domain | OWL Dialect | Key Classes | Access URL |
|---|---|---|---|---|---|
| S1 | LKIF-Core | Upper legal (norms, roles, actions) | OWL-DL (RDF/XML) | Norm, LegalRole, Action, Expression, LegalDocument | https://github.com/RinkeHoekstra/lkif-core |
| S2 | IPRonto / ALIS | IP rights (patents, trademarks, designs) | OWL-DL (RDF/XML) | Patent, Trademark, IndustrialDesign, IPRight, RightsHolder | https://cordis.europa.eu/project/id/IST-2001-33174 |
| S3 | Copyright Ontology | Copyright (works, rights, authorship) | OWL-DL (Turtle) | CopyrightWork, Author, License, EconomicRight, MoralRight | https://rhizomik.net/ontologies/copyrightonto/ |
| S4 | JudO | Judicial decisions (case law) | OWL 2 (RDF/XML) | Judgment, Court, JudicialBody, LegalProvision, CaseFact | https://github.com/legalontology/JudO |
| S5 | LCBR | Legal case-based reasoning | OWL-DL (RDF/XML) | Case, Factor, Issue, Outcome, Precedent | https://papers.ssrn.com/sol3/papers.cfm?abstract_id=3689543 |
| S6 | ESTRELLA | European legal knowledge mgmt | OWL-DL (RDF/XML) | LegalKnowledgeBase, NormativeStatement, MetaRule, LegalActor | https://cordis.europa.eu/project/id/IST-2004-027655 |
| S7 | WIPO IPC | International patent classification | OWL/SKOS (RDF/XML) | Section, Class, Subclass, MainGroup, Subgroup | https://www.wipo.int/classifications/ipc/en/ |

---

## Planned Node Types

| # | Node Type | `_tag` Value | Primary Source | Description |
|---|---|---|---|---|
| 1 | Patent | `Patent` | S2, S7 | Granted patent or patent application with classification codes |
| 2 | Trademark | `Trademark` | S2 | Registered or pending trademark with class and jurisdiction |
| 3 | CopyrightWork | `CopyrightWork` | S3 | Protected creative work (literary, artistic, software, etc.) |
| 4 | LegalEntity | `LegalEntity` | S1, S2 | Person or organization that holds, files, or licenses IP rights |
| 5 | IPRight | `IPRight` | S2, S3 | Abstract intellectual property right (granted, pending, expired) |
| 6 | License | `License` | S3 | License agreement granting usage rights to an IP asset |
| 7 | Filing | `Filing` | S2 | Application filing event at a patent/trademark office |
| 8 | Jurisdiction | `Jurisdiction` | S1, S6 | Legal jurisdiction (country, region, treaty organization) |
| 9 | ClassificationCode | `ClassificationCode` | S7 | IPC or Nice classification code for categorizing IP assets |
| 10 | Court | `Court` | S4 | Judicial body that decides IP disputes |
| 11 | Judgment | `Judgment` | S4 | Court decision in an IP case with outcome and reasoning |
| 12 | LegalProvision | `LegalProvision` | S1, S6 | Statutory provision, regulation, or treaty article |
| 13 | Norm | `Norm` | S1, S6 | Normative statement (obligation, permission, prohibition) |
| 14 | Expression | `Expression` | S1 | Legal expression or propositional content within a document |
| 15 | Claim | `Claim` | S2, S5 | Patent claim or legal claim in a dispute |

---

## Planned Edge Types

| # | Edge Type | Source Node | Target Node | Primary Source | Description |
|---|---|---|---|---|---|
| 1 | GRANTS | Jurisdiction | IPRight | S1, S2 | Jurisdiction grants an IP right |
| 2 | HELD_BY | IPRight | LegalEntity | S2, S3 | IP right is held by an entity |
| 3 | FILED_BY | Filing | LegalEntity | S2 | Filing was submitted by an entity |
| 4 | CLASSIFIED_AS | Patent / Trademark | ClassificationCode | S7 | Asset is classified under a code |
| 5 | INFRINGES | LegalEntity | IPRight | S2, S5 | Alleged infringement of an IP right |
| 6 | LICENSES | License | IPRight | S3 | License grants usage of an IP right |
| 7 | COVERED_BY | CopyrightWork / Patent | LegalProvision | S1, S3 | Asset is covered by a legal provision |
| 8 | SUPERSEDES | IPRight | IPRight | S2 | One right supersedes a prior right |
| 9 | DECIDED_BY | Judgment | Court | S4 | Judgment was decided by a court |
| 10 | GOVERNED_BY | IPRight | Jurisdiction | S1, S6 | Right is governed by a jurisdiction |
| 11 | CITES | Judgment | Judgment / LegalProvision | S4, S5 | Judgment cites another judgment or provision |

---

## Execution Plan

### P0: Ontology Research

1. Retrieve or access all 7 OWL ontology files from the URLs in the Source-of-Truth Contract.
2. For each ontology, document: OWL dialect, serialization format, top-level class hierarchy, object properties relevant to IP law, and any reasoning constraints (cardinality, disjointness, transitivity).
3. Produce a class-to-node-type mapping table showing which OWL classes inform each of the 15 planned node types.
4. Identify gaps where planned types have weak ontological grounding and flag for ADR review.

**Test Cases:**
- Each of the 7 ontology sections in the output contains non-empty class lists
- Class-to-node-type mapping covers all 15 planned types
- At least 3 reasoning constraints documented per ontology that has them

**Verification Gate:** `outputs/p0-ontology-research.md` exists, is substantive, and all 7 ontology sections are populated.

### P1: Schema Design

1. Read P0 output and the Source-of-Truth Contract.
2. Define 15 node types as `S.TaggedClass` definitions with `_tag` discriminant, required fields, and optional metadata fields.
3. Define 11+ edge types as typed records with `sourceId`, `targetId`, `_type` discriminant, and relationship metadata.
4. Compose node types into a `NodeKind` tagged union and edge types into an `EdgeKind` tagged union.
5. Document every OWL reasoning constraint that was dropped during translation and justify the decision.

**Test Cases:**
- Every `S.TaggedClass` compiles without type errors
- `NodeKind` union has exactly 15 branches
- `EdgeKind` union has at least 11 branches
- Each type has a `/** @source S# */` JSDoc annotation

**Verification Gate:** `outputs/p1-schema-design.md` exists with complete schema definitions; no open design decisions remain.

### P2: Implementation Plan

1. Read P1 output.
2. Define package scaffold order (which files to create first, dependency relationships).
3. Produce a file-level plan listing every source file with its purpose, exports, and dependencies.
4. Define seed data plan: which entities to create, which relationships to establish, expected graph shape.
5. List quality gates that must pass before P3 is considered done.

**Test Cases:**
- File-level plan covers all schema types from P1
- Seed data plan references at least 1 patent, 1 trademark, 1 copyright scenario
- Quality gates include `pnpm check`, `pnpm lint-fix`, `pnpm test`, `pnpm build`

**Verification Gate:** `outputs/p2-implementation-plan.md` exists with file-level plan and seed data strategy.

### P3: Implementation

1. Read P2 output.
2. Create package scaffold in dependency order.
3. Implement Effect Schema definitions for all node and edge types.
4. Implement FalkorDB storage layer with create, read, and query operations.
5. Implement seed data pipeline and load representative data.
6. Write unit tests for schema validation and integration tests for graph queries.
7. Document any deviations from the P2 plan.

**Test Cases:**
- All planned source files exist
- `pnpm check` passes for the new package
- `pnpm test` passes all tests
- Seed data loads without errors

**Verification Gate:** `outputs/p3-implementation-notes.md` documents all implemented files, test results, and deviations.

### P4: Verification

1. Run `pnpm check` and record output.
2. Run `pnpm lint-fix` and record output.
3. Run `pnpm test` and record output.
4. Run `pnpm build` and record output.
5. Classify any failures and document resolutions.
6. Write final readiness statement.

**Test Cases:**
- All 4 commands produce exit code 0
- No pre-existing failures attributed to this package
- Readiness statement present

**Verification Gate:** `outputs/p4-verification.md` contains all command outputs and a signed-off readiness statement.

---

## Assumptions and Defaults

- **Package location:** `packages/ip-law-graph` within the monorepo
- **Effect version:** v4 (current repo standard)
- **FalkorDB client:** `falkordb` npm package (TypeScript bindings)
- **Testing framework:** `vitest` (repo standard) or `bun test`
- **Schema pattern:** `S.TaggedClass` with `_tag` discriminant (repo convention)
- **Edge record pattern:** Plain `S.Struct` with `_type` discriminant, `sourceId`, `targetId` fields
- **Seed data format:** TypeScript constants or JSON fixtures loaded via Effect pipeline
- **No runtime OWL reasoning:** OWL is used as a design-time reference only; no OWL reasoner in the runtime dependency graph

---

## Exit Condition

This spec is complete when another agent can execute P0 through P4 without making any additional design decisions and can deliver a `packages/ip-law-graph` package that passes all repository quality gates with a typed knowledge graph grounded in the 7 specified OWL ontologies.
