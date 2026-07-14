# Exploration Findings — 8-Area Codebase Survey

Freshness: 2026-07-08. Produced by dynamic workflow `wf_87d11a69-2ac`
(8 parallel codex read-only investigators + first-hand verification) during the
design session that authored this packet. Paths were spot-verified on
`main` @ `00b4752f91`.

## 1. Desktop app (`apps/professional-desktop`)

- Tauri 2 + Vite + React shell; only product surface is the chat command
  surface (thread list, rich-text composer, streamed turns).
- Dual transport: bun sidecar over HTTP (`127.0.0.1:3939`) or Tauri-IPC ndjson
  socket. `src/transport/TauriIpcSocket.ts` is a full `effect/unstable/socket`
  implementation over Tauri events and is the only module allowed to import
  `@tauri-apps/api` — the app-local framework-wrapper precedent D9 follows.
- State via `@effect/atom-react` (`src/runtime/ProfessionalAtomRuntime.ts`).
- Single-screen: `App.tsx` renders `ChatApp` unconditionally; no router.
- Single hardcoded workspace (`DEFAULT_WORKSPACE_ID = 1`).
- Rust shell (`src-tauri/src/lib.rs`) manages the sidecar, resolves the
  Anthropic API key (env or `op read`), and switches DB path to app-data dir in
  release builds. No fs-plugin/folder-picker/drag-drop commands exist.
- **Gaps**: no dockview or any docking library in the monorepo (only
  `react-resizable-panels` wrapper at
  `packages/foundation/ui-system/ui/src/components/resizable.tsx`); no
  app-level DnD; no vault/onboarding; no document viewer.

## 2. DMS drivers

- `@beep/box` (`packages/drivers/box`) — **implemented write surface**:
  `Box.service.ts`, `Box.streaming.ts`, upload sessions
  (`experimental/domain/entities/UploadSession`), generated operations/models
  (`_generated/Box.operations.gen.ts`), events and webhooks. The `box-driver`
  packet README said "Pending implementation" — stale; corrected 2026-07-08.
- `@beep/m365` — completed-retained, delegated MSAL auth, OneDrive/SharePoint
  read verbs incl. delta + download; **zero write verbs** (no upload,
  createFolder, move) by schema/config/service shape.
- `@beep/m365-mcp` — stdio, read-only tool wrapper over `@beep/m365`.
- **Gaps**: no sync engine anywhere — no durable sync state store, cursor
  registry, conflict records, or resumable jobs. Closest primitives:
  single-file watch in `packages/foundation/modeling/utils/src/FileSystem.ts`
  and `DrainableWorker.ts` (in-memory queue).

## 3. Parsing / NLP / extraction

- `@beep/file-processing` capability + `@beep/tika` + `@beep/libpff` drivers:
  schema-first contracts proven with synthetic fixtures; Tika real extraction
  for several format families is deferred ("engine-unavailable"), libpff PST is
  a synthetic proof, OCR is out of scope (strategy flag only).
- `@beep/langextract` — provider-neutral LLM structured extraction with
  source-span alignment (`GroundedExtraction[]`) and a `Handoff` IR into the
  NLP graph model; no live-provider tests yet.
- `@beep/nlp` + `@beep/nlp-processing` + `@beep/wink` + `@beep/nlp-mcp`
  (42-tool stdio MCP server).
- pandoc-ast: pure decode/encode over fixtures; no live pandoc driver.
- **Gaps**: no embedding/vector code in any `packages/**/src` (pgvector is
  docker-compose infra only); hybrid retrieval is the ungraduated
  `rag-retrieval-projection` exploration; no offset-preserving chunker wired
  end-to-end.

## 4. Ontology stack

- `@beep/rdf` + `@beep/ontology` turn annotated Effect Schema classes into
  JSON-LD/Turtle.
- `@beep/semantic-web`: JSON-LD, PROV, and a **bounded** SHACL-inspired
  validator (`BoundedShaclValidationServiceLive`: targetClass, minCount,
  maxCount, datatype only). SPARQL surface is a stub. No OWL/DL reasoner.
- FOLIO exists only as unused OpenAPI client schemas in
  `packages/foundation/modeling/ontology/src/Ontology.models.ts` — no
  fetch/cache driver.
- Packet landscape: the ontology authoring design (`Ontology.create`, dead
  prior art; packet removed 2026-07-14) was superseded by
  `explorations/identity-as-iri` and its identity-IRI packet sequence;
  `ontology-interop-roadmap` active but defers full SHACL and legal content;
  the ontology-survey scope now absorbed by `goals/semantic-foundation` and
  `explorations/legal-ontology-landscape`, with its storage question resolved by this packet's D6.
- **Gaps**: no legal document-type taxonomy anywhere; no ontology MCP tools.

## 5. Knowledge graph / epistemic

- `packages/epistemic` (domain, server, tables, use-cases): claim lifecycle
  (candidate → gated → admitted) with provenance; ClaimGate is the
  bounded-SHACL symbolic admit/reject gate.
- Proven E2E precedent: law-practice rung-0 loop (PR #262) — file-processing +
  tika → span-bearing `GroundedExtraction[]` → `IrToLaw` maps into law
  entities → candidate distinction gated through the epistemic surface.
  Files: `packages/law-practice/use-cases/src/IrToLaw/IrToLaw.service.ts`,
  `OfficeActionReview.service.ts`, `packages/law-practice/server/src/Layer.ts`.
- **Gaps**: no generic KG node/edge tables with DMS-link sources; no two-hop
  query engine; no LLM critic in the gate.

## 6. Workspace + law-practice domain

- `packages/workspace`: `Workspace` entity (fixtureKey, name, org, owner) has
  **no filesystem path**; DB schema has thread/turn/message +
  candidateProject/candidateDraft tables but **no workspace table**.
  `workspace-thread-domain` packet is explicitly chat-runtime-scoped.
- `packages/law-practice`: rich patent domain (LegalClient, LegalContact,
  Matter, PatentAsset, OfficeAction, Claim, PriorArtReference, Rejection,
  Distinction) + Span/Segment/SegmentMap text-position values; **no generic
  Document/Agreement entity**.
- No per-workspace settings service; config today is env vars, Tauri app-data
  wiring, localStorage drafts.

## 7. Agent orchestration + skills

- `packages/agents` is a real four-tier slice, but `AgentMode` is
  `LiteralKit(["deterministic_fixture"])` — **no live LLM mode**.
- Closest loop precedent: `agents/server/AssistantTurn/BlockRepair.ts` —
  2-attempt LLM repair loop with a hardcoded `REPAIR_ATTEMPTS` constant (the
  thing D7 generalizes with a typed config contract).
- No skill content model (Skill entity is fixtureKey+name only); `mcp-kit` and
  `mcp-host-retrofit` are in-flight, unmerged.
- "Librarian agent" is named as an unbuilt P2 concept in
  `explorations/atlas-synthesis` and `explorations/microsoft-365-integration`;
  `research/librarian-critic.md` records the relevant prior art from git history
  (packet removed 2026-07-14) to adapt, not port.
- Note: `goals/one-round-loop` / `@beep/fc-runs` are CI/property-testing infra
  — a false lead for agent loops.

## 8. External references (trustgraph/ts, cognee)

The external-reference investigator handed off to a background Codex task;
its full report was not captured in the workflow result. Treat mining
`~/YeeBois/dev/trustgraph/ts` and `~/YeeBois/dev/cognee` as P0 research task 4
(`research/librarian-critic.md`), alongside git history (packet removed
2026-07-14), which preserves the earlier librarian/critic inventory.

## Net-new work implied (gap list)

App-level DnD intake; vault/folder-picker onboarding + workspace table; DMS
sync engine; live-LLM AgentMode; legal taxonomy seed; librarian agent; LLM
critic + configurable turns config; KG node/edge tables + two-hop queries;
local embedding driver + pgvector wiring; dockview + span-highlight viewer;
Box OAuth setup UX; M365 write verbs.
