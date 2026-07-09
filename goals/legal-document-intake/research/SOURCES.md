# Legal Document Intake — Sources & Provenance

- **Source exploration:** none — this packet was authored directly from a
  2026-07-08 brain dump + grilled design session (`grill-with-docs`), backed by
  the 8-agent exploration workflow `wf_87d11a69-2ac`. The distilled survey is
  the primary in-packet research artifact:
  [`exploration-findings.md`](./exploration-findings.md).
- **Provenance:** SPEC.md decision table D1–D11 records the locked design
  decisions with date; each traces to survey evidence in
  `exploration-findings.md`.

## 1. Mined source corpus

| Source | Title | Upstream (repo) | Location | Theme | Disposition |
|--------|-------|-----------------|----------|-------|-------------|
| `tg-ts` | TrustGraph TypeScript port | local checkout | `~/YeeBois/dev/trustgraph/ts` | librarian/critic KG ingestion architecture | reference (mine in P0 task 4; adapt patterns, do not port — per `goals/trustgraph-port` posture) |
| `cognee` | Cognee KG ingestion pipeline | local checkout | `~/YeeBois/dev/cognee` | pipeline stages, ontology validation, provenance anchoring, hybrid search | reference (mine in P0 task 4) |
| `tg-port` | TrustGraph port research | this repo | `goals/trustgraph-port/` | librarian.py prior-art inventory | reference |
| `iplaw-kg` | IP-law KG grounding corpus | this repo | `goals/ip-law-knowledge-graph/research/` | FOLIO/LKIF grounding, storage posture question | reference; its FalkorDB-vs-projection P0 is resolved by this packet's D6 |

**How these inform implementation:** librarian/critic loop shape and prompts
come from trustgraph/cognee patterns adapted onto the epistemic claim
lifecycle (D7); ontology grounding and IRI alignment follow the
ip-law-knowledge-graph research corpus (D5).

## 2. Upstream repositories & licenses

| Repo | License | Port discipline | What we take |
|------|---------|-----------------|--------------|
| trustgraph (local `~/YeeBois/dev/trustgraph/ts`) | verify in P0 before any code-level borrowing | reference-only until verified | loop/agent architecture patterns |
| cognee (local `~/YeeBois/dev/cognee`) | Apache-2.0 per its repo (verify at P0) | pattern reference; attribution if any port | pipeline staging, provenance anchoring |

## 3. External research sources

To be populated by P0 research notes (`folder-structure.md`,
`taxonomy-seed.md`, `embedding-bakeoff.md`, `librarian-critic.md`,
`sync-state-model.md`). Do not cite URLs here until they appear in those
on-disk notes. Known target areas: FOLIO ontology (concept IRIs for D5),
legal DMS folder conventions (NetDocuments/iManage-style matter-centric
workspaces), local embedding models (bge-m3, nomic-embed-text) for D10.

## 4. In-repo capability references

| Brick | Path | Role |
|-------|------|------|
| `@beep/box` | `packages/drivers/box` | reuse (write surface exists) |
| `@beep/m365` | `packages/drivers/m365` | extend (write verbs in P6) |
| `@beep/file-processing` + `@beep/tika` + `@beep/libpff` | `packages/foundation/*`, `packages/drivers/*` | reuse |
| `@beep/langextract` | span-grounded extraction | reuse |
| `@beep/nlp` / `@beep/nlp-processing` / `@beep/wink` / `@beep/nlp-mcp` | NLP toolkit | reuse |
| `@beep/rdf` / `@beep/ontology` / `@beep/semantic-web` | ontology + bounded SHACL validation | extend (taxonomy validation hook) |
| `packages/epistemic` | claim lifecycle + ClaimGate | extend (LLM critic, KG materialization) |
| `packages/agents` | agent slice, BlockRepair loop precedent | extend (live AgentMode, configurable turns) |
| `packages/workspace` | Workspace entity, thread runtime | extend (vault path, workspace table) |
| `packages/law-practice` | rung-0 E2E precedent, Span/Segment values | reuse as pattern |
| `packages/foundation/modeling/utils` (`FileSystem.ts`, `DrainableWorker.ts`) | watch + queue primitives | reuse |
| `packages/documents/*` | new slice | NET-NEW |
| local embedding driver | `packages/drivers/<tbd>` | NET-NEW |

## 5. Cross-links & provenance

- `SPEC.md` D1–D11 — dated decision log for this packet.
- `goals/ip-law-knowledge-graph/research/kg-storage-resolution.md` — D6
  resolution recorded in the dependency packet.
- `goals/box-driver/README.md` — status drift corrected during authoring.
- Exploration workflow transcript: session-local
  (`wf_87d11a69-2ac`); durable distillation lives in
  [`exploration-findings.md`](./exploration-findings.md).
