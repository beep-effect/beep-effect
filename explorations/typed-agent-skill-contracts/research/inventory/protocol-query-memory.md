# Protocol, query/browser operations, and memory-routing capability inventory

**Date:** 2026-08-13

The repository already contains reusable typed bricks for these tracks: Effect HTTP clients and
`HttpApi`-derived clients, one real `HttpApi` server, an OAuth2 authorization-code/PKCE provider,
schema-defined MCP toolkits with call-time gates, a live bounded SPARQL path, a schema-first browser
QA evidence pipeline, and source-backed cross-agent configuration metadata. It does **not** contain
the proposed end-to-end phase machines: A2A and ActivityPub are absent, the credential chain is not
modeled, browser references have no epochs or fenced tab leases, and memory/skill configuration has
no intent-to-context routing manifest or transcript-order gate. The closest protocol prior art is
`@beep/acp`, but ACP here means **Agent Client Protocol**, not agent-to-agent (A2A).

## 1. HTTP and protocol surface

### Raw Effect HTTP and typed API clients

- `effect/unstable/http` is the common client substrate. Representative production consumers
  include `@beep/tika`, whose engine probes `/version`, builds a typed PUT request, enforces status,
  timeout, and a streaming output budget
  (`packages/drivers/tika/src/Tika.server.ts:165`), and `@beep/epistemic-client`, whose NDJSON RPC
  transport derives a same-origin or loopback endpoint and supplies `FetchHttpClient.layer`
  (`packages/epistemic/client/src/Protocol.ts:59`, `:98`). Source search also found production raw
  clients in the Anthropic, Discord, eCFR, GovInfo, HubSpot, M365, OpenAI-compatible, OpenClaw,
  PACER, Runpod, Sanity, Tailscale, USPTO, Venice, and xAI drivers.
- `@beep/api-transport` is the reusable external-wrapper seam. `ApiAuth` is a tagged union for no
  auth, query API key, token header, and named API-key header
  (`packages/foundation/capability/api-transport/src/Transport.ts:61`); `makeApiTransport` composes
  request auth, native rate limiting, jittered transient retry, and observable rate-limit state
  (`packages/foundation/capability/api-transport/src/Transport.ts:382`). It is a transport policy,
  not endpoint discovery, OAuth, or a credential lifecycle.
- `effect/unstable/httpapi` has two production typed client families. `@beep/govinfo` defines
  `GovinfoApi`/search contracts and derives its client with `HttpApiClient.make`, applying the shared
  transport (`packages/drivers/govinfo/src/Govinfo.service.ts:113`). `@beep/pacer` defines five PCL
  endpoints in `PclHttpApiGroup` and aggregates them in `PclHttpApi`
  (`packages/drivers/pacer/src/Pcl.api.ts:36`, `:76`); `PclClient` derives the client, injects and
  refreshes the session token, adds timeouts, bounded polling, and bounded pagination
  (`packages/drivers/pacer/src/PclClient.service.ts:72`, `:130`, `:195`). These are the strongest
  existing “one contract -> typed client” precedents.

### HTTP servers

- `@beep/qa-capture` is the concrete `HttpApi` server. `QaCollectorApiGroup` models health, NDJSON
  event ingestion, beacon, marker, and stop endpoints and `QaCollectorApi` aggregates the group
  (`packages/tooling/library/qa-capture/src/Collector.api.ts:291`, `:311`);
  the service supplies `HttpApiBuilder` handlers and serves them through `HttpRouter` on Bun
  (`packages/tooling/library/qa-capture/src/Collector.service.ts:401`, `:432`).
- Shared server observability is contract-aware: `HttpApiTelemetryDescriptor` records API, group,
  endpoint, method, route, and success status, and `makeHttpApiTelemetryDescriptor` derives it from
  `HttpApi` metadata (`@beep/observability`,
  `packages/foundation/capability/observability/src/server/HttpApiTelemetry.ts:102`, `:332`).
- No production A2A or ActivityPub HTTP server was found. Searches over `packages/**/src` for
  `ActivityPub`, `WebFinger`, `host-meta`, `AgentCard`, and agent-to-agent/A2A identifiers returned no
  implementation.

### Authentication and discovery

- `@beep/m365` contains the only complete OAuth/PKCE flow found. `M365AuthorizationRequest` hands a
  host an authorization URL plus redirect URI (`packages/drivers/m365/src/M365.auth.ts:91`), while
  `interactiveAcquire` generates S256 PKCE material, obtains the code through a host callback, and
  exchanges it without exposing token persistence (`packages/drivers/m365/src/M365.auth.ts:195`).
  `M365Auth` exposes a rerunnable redacted-token Effect and falls back from silent cached-account
  acquisition to interactive authorization (`packages/drivers/m365/src/M365.auth.ts:237`, `:300`).
  Gap: the host owns redirect capture, and there is no repository-wide OAuth service, explicit
  `state` schema/state-machine node, provider discovery protocol, or secret-reference abstraction.
- **NOT FOUND — better-auth.** No source import, invocation, plugin, or package integration matching
  `better-auth`, `@better-auth`, or `betterAuth(...)` exists in the repository.
- **NOT FOUND — A2A/ActivityPub discovery.** There is no Agent Card, WebFinger, host-meta, actor
  discovery, Activity vocabulary, inbox/outbox, or federation-signature implementation.

## 2. MCP and AI wiring

- Effect v4 `unstable/ai` is established production infrastructure. For example,
  `@beep/ontology-use-cases` defines schema-typed `Tool.make` declarations through one helper and
  assembles full/read-only/mutation/publish `Toolkit.make` variants
  (`packages/ontology/use-cases/src/tools/OntologyToolkit.ts:692`, `:713`, `:881`, `:902`, `:920`,
  `:937`). The SPARQL tool itself has typed request, success, and failure schemas
  (`packages/ontology/use-cases/src/tools/OntologyToolkit.ts:761`).
- Multiple stdio MCP servers use the same Layer pattern: typed server config, sanitized toolkits,
  one shared `McpServer.layerStdio`, and a pinned MCP protocol. The clearest composite is
  `@beep/gov-legal-mcp` (`packages/drivers/gov-legal-mcp/src/Server.ts:45`, `:80`). Equivalent server
  wiring exists in `@beep/nlp-mcp`, `@beep/uspto-mcp`, `@beep/m365-mcp`, and
  `@beep/law-practice-server`.
- `@beep/mcp-kit` is stronger than list-time capability metadata. `TierGateVerdict` is a typed
  approved/refused value with a sanitized audit record
  (`packages/foundation/capability/mcp-kit/src/TierGate.ts:155`, `:215`), and
  `dispatchWithTierGate` enforces authorization at `tools/call` time and records terminal settlement
  (`packages/foundation/capability/mcp-kit/src/TierGate.ts:598`). `withEnabledWhenApprovedTool` only
  filters discovery and is explicitly documented as insufficient enforcement
  (`packages/foundation/capability/mcp-kit/src/TierGate.ts:615`). This is reusable capability-gate
  prior art for browser operations, but it is neither a browser lease nor identity delegation.
- `@beep/acp` is substantial typed protocol prior art: `Rpc.make` definitions cover initialize,
  authenticate/logout, session lifecycle, permission requests, elicitation, filesystem operations,
  and terminal create/output/release/wait/kill, aggregated into client and agent RPC groups
  (`packages/drivers/acp/src/AcpRpc.models.ts:28`, `:49`, `:280`, `:364`, `:406`, `:469`, `:499`).
  Its patched protocol owns wire parsing/encoding and request correlation
  (`packages/drivers/acp/src/AcpProtocol.service.ts:398`, `:471`). This is **Agent Client Protocol**
  and does not cover A2A Agent Cards/tasks or ActivityPub activities.
- **NOT FOUND — A2A or ActivityPub prior art.** The live source searches named above found neither.

## 3. Query machinery

### SPARQL/RDF and semantic-web state

- `@beep/semantic-web` has real RDF/JS-aligned values and service contracts, but its root barrel
  currently exports only `iri.ts` (`packages/foundation/capability/semantic-web/src/index.ts:13`);
  package wildcard exports make individual subpaths importable
  (`packages/foundation/capability/semantic-web/package.json:33`). Treat it as an active, subpath-led
  capability package, not a finished aggregate facade.
- Its SPARQL contract is well typed: `SparqlQueryRequest` carries opaque query text, a
  select/ask/construct profile, a dataset, and optional timeout
  (`packages/foundation/capability/semantic-web/src/services/sparql-query.ts:45`, `:90`);
  `SparqlQueryResult` is a profile-tagged union of row, boolean, and dataset results
  (`packages/foundation/capability/semantic-web/src/services/sparql-query.ts:119`, `:146`, `:177`,
  `:205`); `SparqlQueryService` is the execution port (`:317`, `:361`). The package-local default is
  intentionally unimplemented (`:397`).
- The repository nevertheless has a live SPARQL path. `@beep/ontology-use-cases` validates the
  selected profile, normalizes prefixes, lexically detects only a top-level `LIMIT`, injects a
  safety bound, executes, and truncates results
  (`packages/ontology/use-cases/src/aggregates/Session/Session.sparql.ts:399`, `:419`, `:593`).
  `@beep/ontology-server` supplies `OxigraphSparqlQueryServiceLive`
  (`packages/ontology/server/src/aggregates/Session/Session.layer.ts:125`). This is a bounded query
  runner, not an intent -> discovery -> compilation state machine.
- RDF and provenance bricks are present. `@beep/provenance` defines exact, re-sliceable UTF-16
  `TextAnchor` values (`packages/foundation/modeling/provenance/src/TextAnchor.ts:48`, `:161`), and
  `@beep/epistemic-domain` layers confidence onto them as `EvidenceSpan`
  (`packages/epistemic/domain/src/values/EvidenceSpan/EvidenceSpan.model.ts:105`, `:162`).
  `@beep/semantic-web` also defines dataset canonicalization/fingerprinting contracts through
  `CanonicalizationService`
  (`packages/foundation/capability/semantic-web/src/services/canonicalization.ts:173`, `:243`, `:354`).
  None is a canonical-IRI policy service returning an evidence-bearing decision.

### SQL and capability probing

- Drizzle tables/repositories provide strongly typed persistence boundaries, but no declarative
  cross-backend query-plan ADT was found. `@beep/duckdb` offers a typed row codec (`DuckDbRows`) and
  raw parameterized query/run operations (`packages/drivers/duckdb/src/DuckDb.models.ts:119`, `:165`;
  `packages/drivers/duckdb/src/DuckDb.service.ts:82`). `DuckDbSqlClient` adapts DuckDB to Effect SQL
  using the SQLite statement compiler (`packages/drivers/duckdb/src/DuckDbSqlClient.service.ts:404`,
  `:505`). These are execution/compilation mechanisms, not a plan with phase evidence.
- The closest capability probe is the ontology toolkit’s typed `CapabilityMetadataResponse`, which
  reports capabilities, budgets, canonicalization semantics, statelessness, and reasoner profile
  (`packages/ontology/use-cases/src/tools/OntologyToolkit.ts:680`). It is static service metadata,
  not endpoint negotiation.
- **NOT FOUND — general query-plan machine.** Searches for `QueryPlan`, “query plan,” “capability
  probe,” and phase/state-machine names found no intent -> endpoint/capability -> compile -> validate
  -> execute -> decode model. SPARQL query text also remains an opaque non-empty string; there is no
  general SPARQL AST/parser contract or CI structural gate.

## 4. Browser and QA operations

- The live CLI owns the complete record/extract/judge command graph. `qaCommand` registers record,
  stop, mark, extract, report, doctor, judge-pack, judge-ingest, and judge-lint
  (`@beep/repo-cli`, `packages/tooling/tool/cli/src/commands/Qa/Qa.command.ts:143`, `:210`, `:240`,
  `:264`, `:304`). The Playwright lane starts the witness collector, passes its origin/session data
  to a Bun-spawned scenario harness, and expects the harness to create `video/capture.webm`
  (`packages/tooling/tool/cli/src/commands/Qa/Record.ts:299`, `:307`, `:324`).
- The witness/collector boundary is typed. `ActionEvent` models sequenced pointer, keyboard,
  viewport, focus, marker, beacon, and related events, including deterministic `SelectorPath`
  (`@beep/qa-capture`, `packages/tooling/library/qa-capture/src/ActionEvent.models.ts:259`, `:1339`).
  `SessionManifest` binds `events.ndjson`, session identity, clock sync, source video, and derived
  artifacts (`packages/tooling/library/qa-capture/src/QaCapture.models.ts:766`); the collector writes
  the log through its typed HTTP API described in section 1.
- Extraction turns semantic `scenario:`/`gesture:` markers into bounded evidence windows, writes an
  extraction plan, renders strips/clips/contact sheets, and stamps artifact provenance
  (`@beep/repo-cli`, `packages/tooling/tool/cli/src/commands/Qa/Extract.ts:83`, `:503`, `:616`, `:822`).
  The judge output is not free-form acceptance: `QaInventory` fixes
  `schemaVersion: "qa-inventory/v1"` and checks required-count consistency
  (`packages/tooling/tool/cli/src/commands/Qa/Inventory.schemas.ts:474`, `:503`), while judge checks
  cross-reference cited artifact paths and witness sequence numbers
  (`packages/tooling/tool/cli/src/commands/Qa/JudgeCheck.ts:105`, `:137`).
- Portless is an executable input contract, not merely documentation: `PORTLESS_PORT` is 1355 and
  `portlessUrlForApp` maps an app name to `http://<app>.beep.localhost:1355`
  (`@beep/repo-cli`, `packages/tooling/tool/cli/src/commands/Qa/Qa.session.ts:42`, `:81`).
- The only live-session locator is `CollectorHandle`, written to `.beep/qa/current.json` for stop
  and mark (`@beep/qa-capture`, `packages/tooling/library/qa-capture/src/QaCapture.models.ts:812`;
  `@beep/repo-cli`, `packages/tooling/tool/cli/src/commands/Qa/Control.ts:39`). It identifies a
  process/port/session, but it has no tab identity, ref epoch, exclusive owner, expiry, renewal, or
  fencing token.
- **NOT FOUND — Pinchtab semantics.** Searches for fresh refs/ref epochs, tab locks, browser leases,
  fencing tokens, and snap-diff returned no browser implementation. There is also no capability set
  scoped to browser actions and no human-handoff protocol state. `@beep/mcp-kit` provides a reusable
  call-time gate pattern, and the QA pipeline provides evidence-backed postconditions, but neither
  closes these gaps.

## 5. Memory routing and skill formats

### `@beep/ai-sync` typed surface

- The package’s public barrel exports drift checks, models, native schemas, source maps, transforms,
  and validation (`packages/tooling/library/ai-sync/src/index.ts:46`, `:61`, `:79`, `:93`, `:112`,
  `:137`). Its model domains explicitly include skills, rules, commands, hooks, plugins, MCP servers,
  config/settings, protocol, and unified config
  (`packages/tooling/library/ai-sync/src/models.ts:29`, `:73`). Source provenance is itself data:
  source tier, support status, drift mechanism, source URL/version/hash metadata, schema cells, and
  transform-evidence records are typed (`packages/tooling/library/ai-sync/src/models.ts:121`, `:156`,
  `:191`, `:474`, `:535`, `:740`).
- `AgentSkillFrontmatter` currently types only required `name` and `description`, and its normalizer
  deliberately drops everything else (`packages/tooling/library/ai-sync/src/schemas.ts:141`).
  `normalizeAgentSkillFrontmatter` is exactly that normalizer
  (`packages/tooling/library/ai-sync/src/transforms.ts:165`). `AgentCommandMetadata` adds optional
  string arguments, while `AgentPluginManifestMetadata` carries optional description and opaque
  metadata (`packages/tooling/library/ai-sync/src/schemas.ts:200`, `:225`). There is no trigger,
  intent, context-source, retrieval-policy, precedence, capability, or audit field.
- Cross-agent MCP config is more complete: transforms cover Codex TOML and Claude/Junie JSON
  (`packages/tooling/library/ai-sync/src/transforms.ts:70`, `:91`, `:112`, `:130`). The evidence
  ledger explicitly marks skill frontmatter as lossy because only name/description round-trip and
  activation/resources remain native (`packages/tooling/library/ai-sync/src/source-map.ts:345`,
  `:388`). `validateRepoConfig` currently validates `.codex/config.toml`, `.mcp.json`, Claude
  settings, and instruction markdown, but not individual `SKILL.md` files or a routing manifest
  (`packages/tooling/library/ai-sync/src/validation.ts:33`, `:117`).
- `.claude/skills/*/SKILL.md` uses directory-per-skill markdown with YAML frontmatter. The local
  browser QA skill demonstrates the common `name`, multiline `description`, `version`, and `status`
  convention (`.claude/skills/browser-qa-loop/SKILL.md:1`). The last two fields are convention, not
  covered by `AgentSkillFrontmatter`.

### Memory and code-context integration

- The repository wires external memory/code-context services rather than implementing their stores:
  `.mcp.json` registers Basic Memory pinned to project `beep-shared` and CodeGraph as a local MCP
  server (`.mcp.json:39`, `:44`). `scripts/setup-agent-memory.sh` provisions the machine-local
  Basic Memory project and a per-checkout `.codegraph/` index
  (`scripts/setup-agent-memory.sh:26`, `:50`, `:57`). No typed in-repo adapter, routing policy, or
  intent classifier wraps these tools.
- **Documentation, not code:** the memory architecture index makes exact records authoritative,
  semantic layers managed caches, and provenance verification binding
  (`standards/memory-architecture/README.md:18`, `:34`, `:44`). It identifies Basic Memory plus
  CodeGraph adoption in its document index (`standards/memory-architecture/README.md:55`).
- **NOT FOUND — intent routing and transcript audit.** Searches for `routesToTopic`,
  `requiresHowTo`, `retrievalPolicy`, routing-manifest schemas, and “memory read before first
  response” enforcement found no source implementation. `@beep/ai-metrics` can decode agent
  transcript lines and produce privacy-preserving ingest summaries
  (`packages/tooling/library/ai-metrics/src/ingest.ts:47`, `:207`; models at
  `packages/tooling/library/ai-metrics/src/models.ts:802`), but it does not prove memory/tool reads
  preceded the first assistant response.

## Port-component verdicts

| Port | Major component | Verdict | Covering surface or gap |
|---:|---|---|---|
| 3 | Frozen source/input manifest | `PARTIAL` | `@beep/agents-use-cases` types source artifacts and source-span references in `SdkContextPacket` (`packages/agents/use-cases/src/processes/ProfessionalRuntime/ProfessionalRuntime.contracts.ts:552`, `:585`, `:746`), but there is no immutable KG `IngestionManifest` with input digests and policy/version pins. |
| 3 | Phase-typed ingestion state machine | `NET-NEW` | Searches for `IngestionManifest`, ingestion phase/state types, and compensations found transcript ingest helpers and domain events, but no source -> parse -> normalize -> identify -> emit KG state machine. |
| 3 | Compensation/rollback receipts | `NET-NEW` | No ingestion compensation algebra or per-phase rollback receipt was found; existing typed ingest errors are operation-local (`@beep/ai-metrics`, `packages/tooling/library/ai-metrics/src/ingest.ts:47`). |
| 3 | Canonical-IRI policy service with evidence decisions | `PARTIAL` | `@beep/semantic-web` has IRI schemas and dataset canonicalization/fingerprinting (`packages/foundation/capability/semantic-web/src/services/canonicalization.ts:173`, `:243`, `:354`), but no authority/alias IRI policy or evidence-bearing decision service. |
| 3 | Claim-level source-span ledger and PROV-O emission | `PARTIAL` | `@beep/provenance` `TextAnchor` and `@beep/epistemic-domain` `EvidenceSpan` provide exact spans (`packages/foundation/modeling/provenance/src/TextAnchor.ts:161`; `packages/epistemic/domain/src/values/EvidenceSpan/EvidenceSpan.model.ts:162`), while ontology tooling exports provenance sidecars (`packages/ontology/use-cases/src/tools/OntologyToolkit.ts:569`); no ingestion ledger binds every emitted claim to a span and emits PROV-O. |
| 3 | Typed RDF decode/canonical output bricks | `EXISTS` | `@beep/semantic-web` exposes JSON-LD stream parse/serialize services and dataset canonicalization (`packages/foundation/capability/semantic-web/src/services/jsonld-stream-parse.ts:409`; `packages/foundation/capability/semantic-web/src/services/jsonld-stream-serialize.ts:254`; `packages/foundation/capability/semantic-web/src/services/canonicalization.ts:354`). |
| 5 | Shared typed HTTP client/server substrate | `EXISTS` | `@beep/pacer` derives `PclClient` from `PclHttpApi` (`packages/drivers/pacer/src/Pcl.api.ts:76`; `packages/drivers/pacer/src/PclClient.service.ts:195`); `@beep/qa-capture` defines and serves `QaCollectorApi` (`packages/tooling/library/qa-capture/src/Collector.api.ts:311`; `packages/tooling/library/qa-capture/src/Collector.service.ts:401`). |
| 5 | A2A Agent Card discovery and JSON-RPC task lifecycle | `NET-NEW` | No Agent Card/A2A symbols were found. `@beep/acp` has typed JSON-RPC (`packages/drivers/acp/src/AcpRpc.models.ts:28`) but it models the distinct Agent Client Protocol and has no A2A task/status contract. |
| 5 | ActivityPub actor discovery and permissive inbound/canonical outbound Activity union | `NET-NEW` | Searches for ActivityPub, WebFinger, host-meta, actor inbox/outbox, and Activity types found no implementation. |
| 5 | Shared OAuth/PKCE/state/secret-ref service | `PARTIAL` | `@beep/m365` implements authorization-code + S256 PKCE and redacted tokens (`packages/drivers/m365/src/M365.auth.ts:195`, `:280`), but it is provider-specific and lacks shared discovery, explicit state-machine states, and secret references. Better-auth is absent. |
| 5 | Protocol capability/discovery negotiation | `PARTIAL` | ACP initialization/capability schemas and MCP list/call machinery exist (`packages/drivers/acp/src/AcpRpc.models.ts:28`; `packages/foundation/capability/mcp-kit/src/TierGate.ts:615`), but neither discovers A2A/ActivityPub endpoints. |
| 6 | Intent -> endpoint/capability phase model | `NET-NEW` | No general query-plan ADT or endpoint capability-probe workflow was found; `CapabilityMetadataResponse` is static toolkit metadata (`packages/ontology/use-cases/src/tools/OntologyToolkit.ts:680`). |
| 6 | Compile/validate bounded SPARQL plan | `PARTIAL` | The ontology runner validates profile, normalizes prefixes, scans top-level LIMIT, and injects bounds (`packages/ontology/use-cases/src/aggregates/Session/Session.sparql.ts:399`, `:419`, `:593`), but has no typed plan nodes, endpoint selection, or general SPARQL AST parser. |
| 6 | Execute against a real engine | `EXISTS` | `@beep/ontology-server` supplies the live Oxigraph service to the runner (`packages/ontology/server/src/aggregates/Session/Session.layer.ts:125`). |
| 6 | Profile-tagged result codecs | `EXISTS` | `@beep/semantic-web` defines select/ask/construct result schemas and `SparqlQueryResult` (`packages/foundation/capability/semantic-web/src/services/sparql-query.ts:119`, `:146`, `:177`, `:205`). |
| 6 | Query evidence envelope/receipt | `PARTIAL` | `RunOntologySparqlResult` records submitted/normalized query, effective limit, counts, and truncation (`packages/ontology/use-cases/src/aggregates/Session/Session.sparql.ts:614`), but omits endpoint discovery, capability evidence, execution timing/status, retries, and source/provenance refs. |
| 6 | Structural SPARQL CI parser gates | `PARTIAL` | The top-level-LIMIT lexical scanner handles comments/literals/subqueries (`packages/ontology/use-cases/src/aggregates/Session/Session.sparql.ts:419`), but there is no full structural parser or reusable CI gate. |
| 7 | `Generated -> Published -> Presented -> Dereferenced -> KeyMatched -> ACLAuthorized` ADT | `NET-NEW` | Searches for those credential phases and credential-chain models found no state machine. |
| 7 | Credential generation/presentation via OAuth PKCE | `PARTIAL` | M365 generates PKCE codes and presents a host-owned auth URL (`packages/drivers/m365/src/M365.auth.ts:91`, `:195`), but this is token acquisition, not the proposed identity credential chain. |
| 7 | Publication/dereference/key-match/ACL proof | `NET-NEW` | No credential publication artifact, dereference receipt, public-key equality proof, or ACL authorization transition was found. |
| 7 | Bilateral delegation as signed scoped grants | `NET-NEW` | MCP tier policies gate tool names and emit audit records (`packages/foundation/capability/mcp-kit/src/TierGate.ts:392`, `:598`), but no signed grant, delegator/delegatee, scope, expiry, or revocation model exists. |
| 8 | Witnessed gesture/event capture and evidence extraction | `EXISTS` | `@beep/qa-capture` models selector-bearing actions and session artifacts (`packages/tooling/library/qa-capture/src/ActionEvent.models.ts:259`, `:1339`; `packages/tooling/library/qa-capture/src/QaCapture.models.ts:766`); the CLI plans extraction (`packages/tooling/tool/cli/src/commands/Qa/Extract.ts:822`). |
| 8 | Fresh-ref epochs | `NET-NEW` | No ref epoch, stale-ref rejection, or ref refresh protocol was found. `SelectorPath` is deterministic but has no freshness token (`packages/tooling/library/qa-capture/src/ActionEvent.models.ts:259`). |
| 8 | Exclusive tab lease with expiry/renewal/fencing | `NET-NEW` | No browser/tab lease, lock owner, expiry, renewal, or fencing token was found. `CollectorHandle` only locates a live collector (`packages/tooling/library/qa-capture/src/QaCapture.models.ts:812`). |
| 8 | Capability-scoped/default-off browser action set | `PARTIAL` | `@beep/mcp-kit` has fail-closed call-time gating and audit (`packages/foundation/capability/mcp-kit/src/TierGate.ts:598`), but it is generic MCP tooling and is not wired to browser actions or per-tab authority. |
| 8 | Postcondition/snapshot-diff evidence | `PARTIAL` | QA cross-checks artifact paths and event refs against a schema-validated judge inventory (`packages/tooling/tool/cli/src/commands/Qa/JudgeCheck.ts:105`, `:137`), but no `snap-diff` state delta is enforced after every operation. |
| 8 | Human handoff as protocol state | `NET-NEW` | The OBS lane can be manually driven, but no typed offered/accepted/returned/cancelled handoff state exists; searches for browser handoff state models found none. |
| 10 | Typed skill/agent/command format metadata | `EXISTS` | `@beep/ai-sync` types agent/domain identities, skill frontmatter, command metadata, plugin metadata, MCP config, source evidence, and support status (`packages/tooling/library/ai-sync/src/models.ts:29`, `:73`; `packages/tooling/library/ai-sync/src/schemas.ts:141`, `:200`, `:225`). |
| 10 | Intent -> context routing manifest | `NET-NEW` | `AgentSkillFrontmatter` contains only name/description (`packages/tooling/library/ai-sync/src/schemas.ts:141`); searches found no intent, topic route, how-to requirement, context source, or retrieval-policy schema. |
| 10 | Schema-validated routing/precedence across agents | `PARTIAL` | `@beep/ai-sync` validates native config and records lossy cross-agent transforms (`packages/tooling/library/ai-sync/src/validation.ts:33`; `packages/tooling/library/ai-sync/src/source-map.ts:345`), but activation, lookup precedence, and context routing explicitly do not round-trip. |
| 10 | Basic Memory/CodeGraph adapters behind routing | `PARTIAL` | Both are registered and provisioned (`.mcp.json:39`, `:44`; `scripts/setup-agent-memory.sh:26`, `:57`), but they remain external MCP tools with no typed in-repo routing adapter or selection receipt. |
| 10 | Transcript-audit gate proving memory reads preceded first response | `NET-NEW` | Transcript ingestion exists (`@beep/ai-metrics`, `packages/tooling/library/ai-metrics/src/ingest.ts:207`), but searches found no ordering proof or blocking gate tied to memory-read tool events. |
