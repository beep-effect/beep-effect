# Project Intelligence — Sources & Provenance

Primary in-packet research artifact:
[`recon-findings.md`](./recon-findings.md) — the distilled 4-area
reconnaissance (packet mechanics, prior art + reuse map, net-new gaps,
doctrine constraints) behind SPEC decisions D1–D7.

- **Source exploration:** none — authored directly (manifest
  `provenance.authoredDirectly: true`); this ledger is built here and extended
  during P0 Research.
- **Provenance:** sanitized operator assignment brief (below); grilled design
  session 2026-07-11 (grill-with-docs); read-only recon workflow
  wf_24cbd840-0ff (4 sweep agents + completeness critic).

## 1. Mined source corpus

| Source | Title | Upstream (repo) | Location | Theme | Disposition |
|--------|-------|-----------------|----------|-------|-------------|
| `assignment-brief` | Operator assignment brief: "Project Intelligence" mission, phases, first-proof preference, non-goals, success criteria | n/a (operator document) | local, uncommitted (D2: absorbed sanitized into SPEC/PLAN/GOAL) | research-intelligence loop | absorbed, not vendored |
| `recon-findings` | Distilled repo reconnaissance | this repo | [`recon-findings.md`](./recon-findings.md) | prior art, gaps, doctrine | primary evidence for D1–D7, G1–G7 |
| `corpus-sweep-2026-07-11` | Read-only corpus reconnaissance aggregates (allowlisted operator projects collection + knowledge vault; frontmatter/metadata only) | n/a (operator corpus) | local, uncommitted (D2: session-only working data; coarsened conclusions in [`recon-report.md`](./recon-report.md)) | interest taxonomy, watchlist seeds, pain points | absorbed, coarsened per D2 |

**How these inform implementation:** the brief fixes the loop's product shape
and first-proof preference (GitHub watchlist, deterministic fixtures); the
recon fixes what already exists (epistemic kernel, `beep research` prototype,
driver/fixture/markdown bricks) so P0 composes instead of rebuilding.

## 2. Upstream repositories & licenses

Recorded by the G2 technology ADR
([`technology-adr.md`](./technology-adr.md)); licenses web-verified
2026-07-11 from upstream license metadata/files. No evaluation code is
authorized: G2 selected the repo-native relational baseline, so these are
donor/reference upstreams only.

| Upstream (repo) | SPDX license | Port discipline |
| --- | --- | --- |
| `topoteretes/cognee` | Apache-2.0 | Donor or rebuildable cache only; any integration via a product-neutral `drivers/*` wrapper; never owns claims or lifecycle. |
| `getzep/graphiti` | Apache-2.0 | Port temporal contracts or use as a bounded projection only; graph-backend licenses reviewed at selection time (the FalkorDB backend is SSPLv1). |
| `trustgraph-ai/trustgraph` | Apache-2.0 | Port provenance/explainability capabilities, not service topology or product authority. |
| `mem0ai/mem0` | Apache-2.0 | Port extraction/retrieval discipline or use as a cache; mutation and approval semantics stay repo-owned. |

## 3. External research sources

Consulted during P0 (each entry names what it evidences; retrieval date
2026-07-11). Only sources actually consulted are listed.

| Source | Evidences |
| --- | --- |
| GitHub machine-readable license/repo metadata (four upstreams above plus the twenty watchlist candidates) | SPDX license, existence, archived state, rename resolution ([`interest-taxonomy-watchlist.md`](./interest-taxonomy-watchlist.md)) |
| Cognee documentation, "main operations: add" page (`docs.cognee.ai`) | content-hash deduplication behavior of the add operation |
| Graphiti upstream documentation (`getzep/graphiti`) | supported graph backends (Neo4j default, FalkorDB incl. embedded, Amazon Neptune; Kuzu deprecated), self-hosting shape |
| mem0 documentation (`docs.mem0.ai`) | single-pass ADD-only open-source algorithm; hosted-platform-only "Graph Memory" |
| Zep help documentation, "zep-vs-graphiti" page (`help.getzep.com`) | managed Zep vs open-source Graphiti distinction |
| FalkorDB upstream license file (`FalkorDB/FalkorDB`) | SSPLv1 license text |

## 4. In-repo capability references

| Brick | Path | Status |
| --- | --- | --- |
| Epistemic kernel (CandidateClaim, Evidence, EvidenceSpan, ClaimLifecycle, ClaimGate, ClaimProjection, EpistemicFixtureKey) | `packages/epistemic/{domain,use-cases,tables,server}` | G1 candidate: mechanism/live-Layer consumption requires an Exception Ledger entry per the 2026-06-18 boundary decision; substrate/vocabulary reuse is unconditional |
| Provenance substrate (TextAnchor) | `packages/foundation/modeling/provenance` | reuse |
| UnitInterval, schema substrate | `packages/foundation/modeling/schema` | reuse |
| Markdown rendering (`renderMarkdownBlocks`) | `packages/foundation/modeling/md` | reuse |
| `beep research` prototype (capture, vault cards, DuckDB dedup catalog, digest, repo cards, Cognee/Graphiti clients, systemd user timers) | `packages/tooling/tool/cli/src/commands/Research/` | gate G3: promote / reuse / retire / defer (SPEC D8) |
| Firecrawl driver incl. Monitor/Watcher | `packages/drivers/firecrawl` | reuse (later web stages; monitor-shape prior art) |
| DuckDB driver | `packages/drivers/duckdb` | candidate (G2/G3) |
| Gov/legal HTTP driver triads (config/errors/service) | `packages/drivers/{courtlistener,govinfo,federal-register,ecfr,dol,uspto,pacer}` | template for the net-new GitHub driver |
| Runtime-data-loop fixture catalog | `goals/agentic-professional-runtime/fixtures/runtime-data-loop/` | pattern (gate G5) |
| Snapshot + drift + report-backed PR | `goals/official-data-sync-foundation`, `packages/tooling/tool/cli/src/commands/SyncDataToTs/` | pattern |
| File processing capability | `packages/foundation/capability/file-processing` | reuse (roadmap stages) |
| MCP host kit | `packages/foundation/capability/mcp-kit` | deferred adapter candidate (gate G7) |
| SSRF-safe host validation (`SafeRemoteHost`) | `packages/foundation/modeling/schema/src/SafeRemoteHost.ts` (consumers: box, nlp-mcp drivers) | reuse — P0 threat model assesses fit + residual risks (e.g. DNS rebinding) |
| GitHub API driver | — | NET-NEW (no driver exists; `gh` shell-out only) |
| Watchlist / daily-brief domain concepts | — | NET-NEW (zero code hits) |
| Scheduler / unattended worker | tooling-level systemd user timers exist (`beep research install-timers`; AI-metrics install tooling) | NET-NEW only at slice/runtime level; tooling timers are G3 scope; deferred to roadmap |

## 5. Cross-links & provenance

- SPEC decision log: [`../SPEC.md`](../SPEC.md) D1–D7 (locked 2026-07-11);
  gate resolutions append D8+.
- Dependency packets: see manifest `dependencies[]` and README table.
- Adjacent explorations (cross-link, never duplicate):
  `explorations/ingestion-security-secret-governance` (D7 threat-model
  baseline), `explorations/rag-retrieval-projection`,
  `explorations/local-first-projection-sync`,
  `explorations/agent-memory-tiers-bitemporal-edges`,
  `explorations/citation-grounding-hallucination-guard`,
  `explorations/solo-firm-docketing`.
- Governing doctrine: `standards/ARCHITECTURE.md`;
  `standards/architecture/DECISIONS.md` 2026-06-18 "Cross-Slice Consumption
  Of The Epistemic Boundary";
  `standards/architecture/13-onboarding-the-minimum-viable-slice.md`.
