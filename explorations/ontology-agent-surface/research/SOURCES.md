# Ontology Agent Surface — Sources & Provenance

- **Cluster / origin:** in-repo capability inventory for the
  `ontology-agent-surface` exploration, read from the live
  `feat/explore-ontology-agent-surface` checkout on 2026-07-10.
- **Provenance:** capture at `explorations/ontology-agent-surface/CAPTURE.md`;
  governing predecessor constraints at `goals/ontology-workbench/SPEC.md`;
  findings at `explorations/ontology-agent-surface/RESEARCH.md`.
- **Scope discipline:** repository source, barrels, package metadata, and tests
  only. No external web sources were used in this half of research.

## 1. In-repo capability references

| Package / surface | Exact path | Role in this packet |
| --- | --- | --- |
| `@beep/mcp-kit` | `packages/foundation/capability/mcp-kit/package.json`; `packages/foundation/capability/mcp-kit/src/{index,ApiKeyRequired,FieldTier,SanitizedSpan,SourceAuth,TierGate,ToolAnnotations,ToolkitComposition}.ts`; `packages/foundation/capability/mcp-kit/test/*.test.ts` | Reuse sanitized toolkit registration, explicit behavior hints, result budgets, credential composition, and fail-closed mutation gating; extend with production gate/audit integration. |
| `@beep/m365-mcp` | `packages/drivers/m365-mcp/src/{M365Tools,M365Handlers,Server,bin}.ts`; `packages/drivers/m365-mcp/test/{Server,SanitizedSpan}.test.ts` | **Primary ontology MCP template:** schema tools, thin handlers, sanitized stdio server, and end-to-end protocol test. |
| `@beep/nlp-mcp` | `packages/drivers/nlp-mcp/src/{StreamingTools,StreamingHandlers,Server,bin}.ts`; `packages/drivers/nlp-mcp/test/Server.test.ts`; `packages/drivers/nlp-mcp/test/integration/Streaming.test.ts` | Reference multi-toolkit composition and a large tool surface; do not copy its unclassified mutation precedent. |
| `@beep/nlp-processing` | `packages/foundation/capability/nlp-processing/src/Tools/NlpToolkit.ts`; `packages/foundation/capability/nlp-processing/src/Tools/*.ts` | Evidence that a canonical toolkit can live outside its MCP transport driver. |
| `@beep/uspto-mcp` | `packages/drivers/uspto-mcp/src/{UsptoTools,UsptoHandlers,UsptoSourceAuth,UsptoDocumentTiers,Server,bin}.ts`; `packages/drivers/uspto-mcp/test/Server.test.ts` | Reference guarded executable launch, source gating, returned auth failures, field tiers, and response budgeting. |
| `@beep/ontology-domain` | `packages/ontology/domain/src/aggregates/Session/{Session.model,Session.values}.ts`; `packages/ontology/domain/src/aggregates/Session/index.ts` | Reuse schema-typed `Session`, `ChangeOperation`, real deltas, derived partitions, inversion, and batch application; extend for actor/revision/concurrency if chosen. |
| `@beep/ontology-use-cases` RPC contract | `packages/ontology/use-cases/src/aggregates/Session/Session.rpc.ts`; `packages/ontology/use-cases/src/aggregates/Session/index.ts` | Source of truth for the 9 wire-ready candidate tools and their request/response schemas. |
| `@beep/ontology-use-cases` session services | `packages/ontology/use-cases/src/aggregates/Session/{Session.commands,Session.ports,Session.service}.ts` | Open/serialize/save service boundary and evidence that no server session repository exists. |
| `@beep/ontology-use-cases` projections | `packages/ontology/use-cases/src/aggregates/Session/Session.projections.ts` | Snapshot, hierarchy, metrics, and pure local search; search needs a schema/RPC or purpose-built MCP tool contract. |
| `@beep/ontology-use-cases` query/reason/validation | `packages/ontology/use-cases/src/aggregates/Session/{Session.sparql,Session.reasoner,Session.validation}.ts`; `packages/ontology/use-cases/test/{Session,Session.validation,SchemaParity}.test.ts` | Reuse safeguarded SPARQL, bounded structural inference, SHACL validation, verify-then-offer repair, and PROV/VoID/DCAT export; extend the gaps inventoried in RESEARCH. |
| `@beep/ontology-client` | `packages/ontology/client/src/aggregates/Session/Session.atoms.ts`; `packages/ontology/client/test/Session.atoms.test.ts` | Evidence for `AtomRpc.Service`, shared Chat transport, browser-owned session, local undo/redo/search, and surfaced action state. |
| `@beep/ontology-server` | `packages/ontology/server/src/aggregates/Session/{Session.layer,Session.file-store}.ts`; `packages/ontology/server/src/Layer.ts`; `packages/ontology/server/test/{SessionServer,OntoauthorMatCompetency}.test.ts` | Reuse N3/Oxigraph/SHACL/reasoner/file Layers, path containment, atomic file writes, and live server proof. |
| `@beep/semantic-web` | `packages/foundation/capability/semantic-web/src/services/{sparql-query,shacl-validation}.ts` | Canonical SPARQL and SHACL contracts; extend SHACL violation/component and shape detail for a repair strategy registry. |
| `@beep/oxigraph` | `packages/drivers/oxigraph/src/Oxigraph.sparql.ts`; `packages/drivers/oxigraph/test/OxigraphLazyImport.test.ts` | Real SPARQL execution adapter and evidence that result truncation currently occurs after synchronous engine materialization. |
| `@beep/shacl` | `packages/drivers/shacl/src/Shacl.validation.ts`; `packages/drivers/shacl/test/ShaclEngineValidation.test.ts` | Real SHACL engine adapter and the point where constraint-component detail must be preserved. |
| `@beep/rdf` PROV vocabulary | `packages/foundation/modeling/rdf/src/Vocab/Prov.ts` | Canonical PROV constants used by the journal exporter; `prov:wasAssociatedWith` is currently constructed ad hoc. |
| `@beep/agents-use-cases` | `packages/agents/use-cases/src/processes/Chat/Chat.rpc.ts`; `packages/agents/use-cases/src/public.ts` | RPC-group declaration precedent followed by Ontology. |
| `@beep/agents-client` | `packages/agents/client/src/Chat.atoms.ts` | HTTP/IPC `AtomRpc.Service` client and shared protocol selector used by Ontology. |
| `@beep/professional-desktop` orchestration | `apps/professional-desktop/src/ontology/OntologyOrchestrator.ts`; `apps/professional-desktop/src/chat/ChatOrchestrator.ts`; `apps/professional-desktop/src/runtime/Layer.ts`; `apps/professional-desktop/src/App.tsx` | Handler adaptation, runtime Layer composition, Chat comparison, and client transport selection. |
| `@beep/professional-desktop` sidecar | `apps/professional-desktop/server/{main,RpcSessionAuth,IpcStdoutGuard.prelude}.ts`; `apps/professional-desktop/src-tauri/src/lib.rs`; `apps/professional-desktop/test/ontology-sidecar-registration.test.ts`; `apps/professional-desktop/test/integration/sidecar-ipc-stdio.test.ts` | Existing Effect RPC HTTP/stdio hosting, bearer-token boundary, stdio collision evidence, directional IPC framing bounds, and sidecar registration proof. |
| Ontology workbench predecessor packet | `goals/ontology-workbench/{GOAL,PLAN,SPEC}.md`; `goals/ontology-workbench/history/2026-07-09-p4-sparql-reasoning.md` | Normative definitions of derived partitions, invalidation discipline, agent-ready deltas/query safeguards, and bounded reasoner intent. |
| Repo-local skill directory | `.claude/skills/` | Audited requested location. **NOT FOUND:** any `ontology-*` skill directory in this checkout. |

## 2. External research sources

All cited in `RESEARCH.md` section "2026-07-10 — External landscape (claude,
web)". Licenses were NOT verified for the GitHub repositories during this
sweep — per port discipline, every repo below is **reference only** (concept
comparison; no code mining, no vendoring) until its license is read and
recorded here.

| Source | URL | Disposition |
| --- | --- | --- |
| MCP spec — transports (2025-06-18) | <https://modelcontextprotocol.io/specification/2025-06-18/basic/transports> | Normative protocol reference (stdio vs streamable HTTP, local-server security requirements). |
| open-ontologies (fabio-rovai) | <https://github.com/fabio-rovai/open-ontologies> | Reference only (license unverified). Build-vs-integrate comparator; tool-vocabulary reference (70+ tools over Oxigraph, OWL2-DL tableaux, SHACL). |
| open-ontologies HN thread | <https://news.ycombinator.com/item?id=47356390> | Context only. |
| owl-mcp (ai4curation) | <https://github.com/ai4curation/owl-mcp> | Reference only (license unverified). OWL axiom add/remove tool-shape comparator. |
| mcp-graphdb (keonchennl) | <https://github.com/keonchennl/mcp-graphdb> | Reference only (license unverified). Read-only SPARQL server prior art. |
| mcp-rdf-explorer (emekaokoye) | <https://github.com/emekaokoye/mcp-rdf-explorer> | Reference only (license unverified). Local-file Turtle exploration prior art. |
| mcp-proto-okn | <https://arxiv.org/abs/2605.30283> | Paper; multi-graph NL access patterns. |
| Ontology-to-tools compilation | <https://arxiv.org/pdf/2602.03439> | Paper; T-Box-derived tool schema generation direction. |
| GraphDB MCP announcement | <https://graphwise.ai/blog/the-power-of-model-context-protocol-using-natural-language-to-query-graphdb/> | Vendor prior art (SSE-streaming MCP over RDF repository). |
| MCP server directories | <https://glama.ai/mcp/servers?query=sparql>, <https://www.pulsemcp.com/servers/kludgeworks-sparql> | Landscape breadth only. |

## 3. Cross-links and provenance

- Capture (append-only): `explorations/ontology-agent-surface/CAPTURE.md`.
- In-repo findings: `explorations/ontology-agent-surface/RESEARCH.md`, section
  “2026-07-10 — In-repo capability inventory (codex)”.
- Predecessor implementation contract: `goals/ontology-workbench/SPEC.md`,
  Constraints 13–17.
- External landscape: `explorations/ontology-agent-surface/RESEARCH.md`,
  section "2026-07-10 — External landscape (claude, web)"; sources in
  section 2 above.
