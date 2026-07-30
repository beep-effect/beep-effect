# In-repo inventory — execution & authority surfaces

> Research-stage artifact of `explorations/agent-execution-sandbox`, produced
> 2026-07-25 by the `agent-sandbox-research` workflow (repo-exec sweep agent; structured
> output, verbatim). URLs were retrieved or seen in search results by the
> agent under a no-fabrication rule; license fields reflect what the agent
> verified (see per-source notes; unverified licenses are marked
> reference-only). Synthesis and caveats: [`../RESEARCH.md`](../RESEARCH.md);
> provenance ledger: [`SOURCES.md`](./SOURCES.md).
## findings

### [0] Server-owned tool budgets + typed refusal vocabulary (canonical idiom)
pkg: @beep/ontology-use-cases
path: packages/ontology/use-cases/src/tools/OntologyToolkit.ts (budgets L72-98; refusals L137-298; makeTool L644-654; toolkits L810-849)
symbols: OntologyToolBudgets, ontologyToolBudgets, OntologyBudgetKind, OntologyCasConflict, OntologyBudgetRefusal, OntologyReasonerDriftRefusal, OntologyNoOpRefusal, OntologyActorIdentityRefusal, OntologyTierGateRefusal, OntologyToolExecutionError, OntologyToolFailure, OntologyReadOnlyToolkit, OntologyMutationToolkit, OntologyFingerprint

The verified pattern: static server-owned ceilings (maxChangeOperations=256, maxQueryResults=200, maxSearchResults=100, maxValidationResults=100, reasonerDriftCap=64) baked into an immutable schema value the caller cannot influence; every failure is a schema class carrying `recoverable: boolean` + `guidance` prose, unioned into OntologyToolFailure and attached to every Tool.make with `failureMode: "return"` so refusals are values on the MCP wire, never thrown. Toolkits are split read-only vs mutation so mutation registration is a separately-mounted Layer. A sandbox packet can copy this exactly: ceilings-as-schema-constants, refusal-as-value union, capability metadata tool (CapabilityMetadataTool L793) advertising actual limits.

*caveats:* Budgets are counts (operations/results), not CPU/memory/time ceilings; they are compile-time constants, not per-principal or per-grant.

### [1] Enforcement service: CAS, budget checks, single-writer semaphore, workspace-root confinement
pkg: @beep/ontology-use-cases
path: packages/ontology/use-cases/src/tools/OntologyToolService.ts (ensureCas L130-143; ensureBatchBudget L145-158; ensureReasonerDriftCap L160-172; ONTOLOGY_WORKSPACE_ROOT + realPath L365-366; mutation Semaphore.make(1) L367-370; overwrite refusal L371-406)
symbols: OntologyToolService, OntologyToolServiceLive, ensureCas, ensureBatchBudget, mutationSemaphore

Live enforcement of the toolkit contracts: rdfc-1.0 semantic fingerprint compare-and-set on every mutation, budget refusals before any work, an in-process Semaphore(1) closing compare/apply/write TOCTOU (comment L368-370 documents the sidecar as sole v1 write authority), canonical workspace root resolved via fileSystem.realPath from Config. Sandbox composition: this is the template for a per-execution authority check pipeline — validate grant, check ceiling, take permit, execute, record.

*caveats:* Semaphore is process-local only (no cross-process lock, deliberately); ceilings enforced per-call, no cumulative accounting.

### [2] Fail-closed tool-dispatch permission gate with audit record per call
pkg: @beep/mcp-kit (packages/foundation/capability/mcp-kit)
path: packages/foundation/capability/mcp-kit/src/TierGate.ts (TierGateAuditRecord L107-136; TierGateVerdict L166-174; TierGate service L304; TierGatePolicy L323; fail-closed isDestructive default-true L340-341; fromApprovedToolsPolicy L390-408; dispatchWithTierGate L507-517; withEnabledWhenApprovedTool L540-549)
symbols: TierGate, TierGateShape, TierGatePolicy, TierGateAuditRecord, TierGateVerdict, TierGateDispatchResult, fromApprovedToolsPolicy, dispatchWithTierGate, withEnabledWhenApprovedTool

The repo's existing default-deny fragment: module docs (L4-18) prove McpSchema.EnabledWhen filters tools/list only and tools/call dispatch never re-checks it, so this dispatch wrapper is the real security boundary. Unannotated tools are treated destructive (Context.getOrElse default true); pass requires explicit Readonly+non-Destructive OR explicit name in approvedTools. Every gated call — approved or refused — produces a sanitized JSON-serializable TierGateAuditRecord shaped for UsageRecord.metadata jsonb. Refusal is a value (ClaimGate pattern), error channel never. A sandbox's named-authority-grant evaluator should extend TierGateShape (grant identity, scope, expiry) and reuse dispatchWithTierGate as the wrap point.

*caveats:* Policy is a flat tool-name allowlist — no principal binding, no scoping, no expiry. Audit persistence is explicitly consumer-side (docs L13-15) and today NO consumer persists it: OntologyToolHandlers.gatedMutation drops the approved-path audit (L87 `Dispatched: ({ value }) => Effect.succeed(value)`) and folds only refusal reason into guidance.

### [3] Credential-gated toolkit mounting (none/soft/hard) + call-time degradation
pkg: @beep/mcp-kit
path: packages/foundation/capability/mcp-kit/src/SourceAuth.ts (SourceAuthGate L50; SourceAuthRegistration L93; resolveSourceCredential L141-144; decideSourceAuthMount L217-229); ToolkitComposition.ts (GatedLayer L51; gatedLayer L86; composeGatedLayers L124); ApiKeyRequired.ts (ApiKeyRequiredFailure L67; apiKeyRequiredFailure L122)
symbols: SourceAuthGate, SourceAuthRegistration, resolveSourceCredential, SourceAuthDecision, decideSourceAuthMount, gatedLayer, composeGatedLayers, ApiKeyRequiredFailure

Composition-time capability gating keyed on credentials: `hard`-gated tool layers vanish entirely from the server when the env credential is absent (capability does not exist rather than erroring); `soft` mounts and degrades at call time via the api_key_required return envelope. Credential resolution is the Config.redacted(envVar).pipe(Config.option) idiom. For the sandbox: this is the existing model for capability presence being a function of grants — extend the registration to name authorities instead of env vars.

*caveats:* Grants are env-var presence, not principal-scoped authority; decision is made once at layer composition, not re-evaluated per call (except soft-gate call-time checks in handlers).

### [4] Sanitized MCP dispatch + request-local caller identity injection
pkg: @beep/mcp-kit
path: packages/foundation/capability/mcp-kit/src/SanitizedSpan.ts (per-dispatch CurrentMcpCaller injection L253-259; sanitizedToolkit L343; registration loop L217-294); McpCaller.ts (McpCallerIdentity L27; CurrentMcpCaller Context.Reference default-none L44)
symbols: sanitizedToolkit, withSanitizedToolSpan, sanitizeTracerAttributes, McpCallerIdentity, CurrentMcpCaller

Drop-in replacement for McpServer.toolkit that (a) suppresses raw tool parameters from span attributes (secret/PII hygiene for telemetry) and (b) injects the transport-assigned client identity into request context as CurrentMcpCaller for every tools/call, absent outside real dispatch. This is the seam where a sandbox would thread execution-context (principal, grant set, budget accounting handle) into every tool invocation — it exists precisely because upstream effect McpServer has no dispatch-wrapping hook.

*caveats:* Identity is just a transport clientId integer; no cryptographic binding, no session claims.

### [5] Response-size ceilings and oversized-payload handles
pkg: @beep/mcp-kit
path: packages/foundation/capability/mcp-kit/src/FieldTier.ts (FieldTierName L46; defineFieldTiers L123; projectWithinBudget L406; FetchableHandle L277; ColumnarEnvelope L441); also OntologySparqlSafeguards in packages/ontology/use-cases/src/aggregates/Session/Session.sparql.ts (L82-88; limit injection/truncation L591-610)
symbols: defineFieldTiers, projectWithinBudget, FetchableHandle, OversizedFieldProjection, OntologySparqlSafeguards

Byte-budgeted output projection: minimal/balanced/complete field tiers, projectWithinBudget degrades tier-by-tier and mints a FetchableHandle instead of inlining oversized payloads; SPARQL safeguards inject a server default LIMIT and truncate over maxResultCount with a `truncated` flag. Composable as the sandbox's output-channel resource ceiling (bounded data returned to the model).

*caveats:* Budgets are JSON-string-length estimates, not memory accounting.

### [6] Authenticated MCP transport: origin allowlist + per-launch bearer token + feature-gated mutation mount (reference wiring)
pkg: apps/professional-desktop
path: apps/professional-desktop/server/OntologyMcpTransport.ts (allowed origins L23-31; origin middleware+metric L41-66; makeOntologyMcpTransportLayer L98-121); apps/professional-desktop/server/RpcSessionAuth.ts (DesktopRpcSessionToken L29; requireRpcSessionToken L75-96; RpcSessionAuthLayer L104-107); apps/professional-desktop/server/main.ts (mutation env gate + approved tools L54-59; token-gated full RPC group comment L71-77)
symbols: makeOntologyMcpTransportLayer, requireRpcSessionToken, DesktopRpcSessionToken, rpcSessionAuthorizationHeader, ONTOLOGY_MCP_MUTATIONS_ENABLED

The deployed composition: 403 typed origin refusal with metrics, 401 on missing per-launch BEEP_DESKTOP_RPC_SESSION_TOKEN bearer, read-only toolkit always mounted, mutation toolkit mounted only when ONTOLOGY_MCP_MUTATIONS_ENABLED and still TierGate-wrapped per dispatch, TierGate policy provided from approvedMutationTools at layer build. Sandbox packets get a working template for transport-level default-deny plus decision metrics (desktop_ontology_mcp_origin_decisions_total, desktop_rpc_auth_decisions_total).

*caveats:* Single shared token per launch, no per-principal tokens; origin allowlist is inbound policy only.

### [7] Integration proof of the whole gate stack (the known-idiom test)
pkg: apps/professional-desktop
path: apps/professional-desktop/test/integration/ontology-mcp-http.test.ts (list-filtering L215-220; 403/401 L245-260; TierGate fail-closed refusal L262-284; caller attribution in PROV sidecar + budget/CAS typed errors L286-347)
symbols: transportServer, makeMcpClient, openThroughMcp

End-to-end proof over real streamable-HTTP MCP: mutations absent from tools/list when disabled; calling a mutation with mutationsEnabled but empty approvedMutationTools yields isError:true with structured `OntologyTierGateRefusal`; approved mutation writes PROV-O provenance containing `urn:beep:desktop-rpc-session:mcp-client:<id>` + prov:wasAssociatedWith (caller attribution on disk); 257-op batch yields OntologyBudgetRefusal; stale fingerprint yields OntologyCasConflict. This is the acceptance-test shape a sandbox packet should replicate for its own boundary.

*caveats:* Tests the ontology slice only; TierGate audit records themselves are not asserted or persisted anywhere in the test.

### [8] Actor identity resolution → typed identity refusal (mutation attribution)
pkg: @beep/ontology-server
path: packages/ontology/server/src/tools/OntologyToolHandlers.ts (authenticatedMcpActor L66-79; gatedMutation L81-96; read-only vs mutation handler layers L107-150; missingActor default handlers L45-57)
symbols: OntologyMcpReadOnlyToolsLive, OntologyMcpMutationToolsLive, authenticatedMcpActor, gatedMutation

CurrentMcpCaller Option is matched: none → OntologyActorIdentityRefusal (recoverable, with guidance); some → OntologyChangeActor URN minted from clientId and stamped onto every ChangeOperation (flows into PROV export). The non-MCP toolkit variant hard-wires mutations to missingActor so unauthenticated paths cannot mutate. Pattern for sandbox: identity is resolved fail-closed at the handler seam and threaded into the execution record.

*caveats:* Approved-path TierGateAuditRecord discarded here (L87) — audit generation exists, audit retention does not.

### [9] LLM provider dispatch layers (Anthropic + compat providers)
pkg: @beep/anthropic, @beep/openai-compat, @beep/venice-ai, @beep/xai
path: packages/drivers/anthropic/src/Anthropic.service.ts (AnthropicLive L44; makeAnthropicLanguageModelLayer L76; AnthropicTurnPlan L139-161); Anthropic.config.ts (AI_ANTHROPIC_API_KEY env L39; retry/price defaults L129-205); packages/drivers/openai-compat/src/OpenAiCompatLanguageModel.service.ts; packages/drivers/xai/src/XAiLanguageModel.service.ts; packages/drivers/venice-ai/src/VeniceAiLanguageModel.service.ts
symbols: AnthropicLive, AnthropicLanguageModelLive, AnthropicTurnPlan, ANTHROPIC_API_KEY_ENV, AnthropicApproximatePrice

Provider clients are Config-driven Layers with Redacted keys, bounded retry plans, and approximate-price constants for cost attribution. Model-call dispatch for the desktop chat goes through AgentTurnKernel (packages/agents/use-cases/src/processes/AssistantTurn/AssistantTurn.kernel.ts L40-73, streamTurn interface) implemented by @beep/agents-server AnthropicTurnKernel, selected by CHAT_AGENT=anthropic|fixture in apps/professional-desktop/src/runtime/Layer.ts (L139-176). Sandbox composition: provider dispatch is already a swappable service boundary where per-execution model/credential grants could be enforced.

*caveats:* No central provider registry or spend ceiling; each app wires providers directly; keys resolved from process env at layer build.

### [10] Usage/cost ledger row with actor + credential reference (metadata sink for gate audits)
pkg: @beep/epistemic-domain
path: packages/epistemic/domain/src/entities/UsageRecord/UsageRecord.model.ts (UsageRecord L71; actor jsonb, credentialReference, metadata jsonb, token/cost/latency columns L80-121; appendTurnFinalizationUsageRecord L225); sink impls apps/professional-desktop/src/chat/UsageRecordSink.ts (UsageRecordSink L63; UsageRecordSinkInMemory L119; UsageRecordSinkDrizzle L188)
symbols: UsageRecord, UsageRecordSink, UsageRecordSinkDrizzle, appendTurnFinalizationUsageRecord

The closest thing to an execution ledger: per-turn persisted rows carrying actor (Principal jsonb), provider/model, tokens, approximate cost micros, latency, credentialReference, and a metadata jsonb column that TierGate docs explicitly designate as the audit-record sink. A sandbox's immutable execution record could extend this table family or mirror its shape (BaseEntity + persist descriptors).

*caveats:* Rows are ordinary mutable BaseEntity rows (rowVersion, updatedBy) — no append-only constraint, no hash chaining, no bitemporal columns in production; the epistemic Activity entity (packages/epistemic/domain/src/entities/Activity/Activity.model.ts L47) is a runtime-proof fixture snapshot, and bitemporal storage exists only as P0 spike tests under packages/drivers/pglite (commit 57c475f724) plus goals/epistemic-bitemporal-edge-core notes — not a production API.

### [11] Refusal-as-value total-engine gate pattern (precedent TierGate cites)
pkg: @beep/epistemic-use-cases
path: packages/epistemic/use-cases/src/ClaimGate/ClaimGate.ports.ts (ClaimGateShape L42-47; ClaimGate L78; ClaimGateLayer L98)
symbols: ClaimGate, ClaimGateShape, ClaimGateResult

The repo-blessed shape for any authority gate: evaluate(...) => Effect<Verdict> with error channel never; rejection is a typed verdict value. TierGate copies it; a sandbox authority service should be a third instance of the same shape.

*caveats:* Domain-specific to claim admission; nothing generic exported.

### [12] Outbound HTTP transport policy: auth injection + native rate limiting + retry (shared wrapper)
pkg: @beep/api-transport (packages/foundation/capability/api-transport)
path: packages/foundation/capability/api-transport/src/Transport.ts (ApiAuth L56-76; RateLimitSnapshot L136-162; makeApiTransport L261-292)
symbols: ApiAuth, RateLimitSnapshot, ApiTransportOptions, ApiTransport, makeApiTransport

The single shared egress wrapper: composes ApiAuth (query-param / token-header / api-key-header / none, Redacted keys) → HttpClient.withRateLimiter keyed per source (effect/unstable/persistence RateLimiter, parses X-RateLimit-* and retries 429) → jittered exponential retryTransient → observable RateLimitSnapshot. Sandbox composition: destination-aware egress policy would slot in as one more transformClient stage here — every keyed driver already routes through this seam.

*caveats:* No destination/host filtering, no deny-by-default egress, no per-principal buckets; RateLimiterError is converted to a defect; keyless drivers can still use FetchHttpClient directly.

### [13] Child-process execution abstraction + repo law banning raw process APIs
pkg: effect/unstable/process consumers + @beep/repo-cli laws
path: Spawner service: effect/unstable/process ChildProcessSpawner with Bun/Node layers wired in packages/tooling/tool/cli/src/bin-main.ts (L193-238) and packages/tooling/tool/docgen/src/bin.ts (L19); driver consumers packages/drivers/{tailscale/src/Tailscale.service.ts L149-218, libpff/src/Libpff.pffexport.ts L219-221, ai-provider-cli/src/AiProviderCli.service.ts L285-320, acp/src/AcpClient.service.ts L684-691, ffmpeg/src/FFmpeg.service.ts}; ban law packages/tooling/tool/cli/src/commands/Laws/NoNativeRuntime.ts (NODE_RUNTIME_IMPORTS incl. node:child_process L75)
symbols: ChildProcessSpawner, ChildProcessHandle, BunChildProcessSpawner.layer, NodeChildProcessSpawner.layer, NoNativeRuntime

All agent-adjacent spawning already flows through one injectable service (ChildProcessSpawner) and a lint law bans direct node:child_process imports — the ideal choke point for a default-deny exec authority: replace/wrap the spawner layer with a policy-checking implementation and the whole repo inherits it.

*caveats:* The spawner itself imposes no policy: no argv/binary allowlist, no cgroup/rlimit ceilings, no env filtering at spawn time. Bun.spawnSync escapes remain in tooling bootstrap (packages/tooling/tool/cli/src/bin.ts L19, bin-main.ts L47, AIMetrics Programs.ts L2340, Graphiti ProxyDependencyHealth.ts L47).

### [14] Agent Client Protocol driver: permission-request RPC + terminal lifecycle control
pkg: @beep/acp (packages/drivers/acp)
path: packages/drivers/acp/src/AcpRpc.models.ts (RequestPermissionRpc L307; CreateTerminalRpc L347; TerminalOutputRpc L367; ReleaseTerminalRpc L387; WaitForTerminalExitRpc L407; KillTerminalRpc L414+); AcpClient.service.ts (handleRequestPermission seam L552-555, L210-213; layerChildProcess over ChildProcessHandle L684-691); AcpAgent.service.ts (client.requestPermission L66-68, L503); AcpTerminal.models.ts (AcpTerminal L26; MakeTerminalOptions L61)
symbols: RequestPermissionRpc, CreateTerminalRpc, KillTerminalRpc, AcpClient, AcpAgent, layerChildProcess, handleRequestPermission

A full typed implementation of the Agent Client Protocol: the agent must round-trip session/request_permission to the client before privileged actions, and terminals the agent runs are client-owned resources with create/output/wait/kill/release lifecycle. This is the cross-tool agent-run surface the sandbox packet must govern — the handleRequestPermission handler registration is exactly where a named-authority-grant evaluator plugs in, and terminal RPCs are where resource ceilings on agent-spawned processes would attach.

*caveats:* Protocol plumbing only — the repo ships no default permission policy handler; whoever registers handleRequestPermission decides, and nothing records decisions durably.

### [15] Provider-CLI isolation fragments: token-safe env records + isolated agent HOME dirs + redacted auth probes
pkg: @beep/agents-domain + @beep/ai-provider-cli
path: packages/agents/domain/src/entities/ProviderInstance/ProviderInstance.values.ts (EnvVarName token-safe filter L203-240; EnvVars record that fails decode on credential-bearing names L242-294; TokenSource L309; ProviderKind L43; BinaryPath L119; HomePath L159); packages/drivers/ai-provider-cli/src/AiProviderCliHome.service.ts (AiProviderCliHome L452; makeClaudeEnv/makeCodexEnv/shadow-home shape L45-60); AiProviderCli.service.ts (AiProviderCli L291; redaction-by-construction probe docs L248-258)
symbols: EnvVarName, EnvVars, AiProviderCliHome, AiProviderCli, ProviderKind, AuthSnapshot

Existing spawn-time hygiene for running claude/codex CLI agents: env-var records persisted on a ProviderInstance reject any credential-shaped name (*_TOKEN, *_SECRET, *_KEY, AI_*_API_KEY) at schema decode, so credential smuggling can never reach beep-owned storage; per-instance HOME/shadow-HOME layouts isolate agent config/state; auth probes never surface raw stdout/tokens. These are direct building blocks for the sandbox's env/filesystem authority story.

*caveats:* Denylist-by-pattern on env names, not allowlist; HOME isolation is convention (directory layout), not enforced by the OS; no network or fs confinement of the spawned CLI.

### [16] Principal model incl. AgentPrincipal with on-behalf-of chain
pkg: @beep/shared-domain
path: packages/shared/domain/src/entity/Principal.ts (UserPrincipal L75; ServiceAccountPrincipal L104; AgentPrincipal L143 — agentId+agentVersionId+required onBehalfOfUserId+optional onBehalfOfTeamId; ConnectorAccountPrincipal L180; SystemPrincipal L215; Principal tagged union L244-254)
symbols: Principal, AgentPrincipal, ServiceAccountPrincipal, SystemPrincipal, UserPrincipal, ConnectorAccountPrincipal

Shared-kernel actor vocabulary used by every BaseEntity created/updated-by field: agents are first-class principals versioned (agentVersionId) and always attributed to a human (onBehalfOfUserId required on AgentPrincipal). A sandbox's named authority grants should be keyed to this union rather than inventing a new principal type.

*caveats:* Pure schema — no session issuance, no scopes/permissions attached to principals, no verification. The @beep/identity package (packages/foundation/modeling/identity) is schema-naming identity composers ($I), not IAM.

### [17] Secret redaction + telemetry hygiene
pkg: @beep/observability (packages/foundation/capability/observability)
path: packages/foundation/capability/observability/src/CauseRedaction.ts (REDACTION_PLACEHOLDER L63; RedactionChannel client/diagnostic L121; sanitizeSensitiveText L190; redactString L212; RedactedCause L239; redactCause L401)
symbols: redactCause, sanitizeSensitiveText, RedactionChannel, RedactedCause, redactCauseSummary

Channel-aware cause/error redaction (client vs diagnostic) with message/detail truncation limits — pairs with mcp-kit SanitizedSpan and the ~20 drivers using Config.redacted for secrets. Sandbox execution records should route failure causes through redactCause before persisting.

*caveats:* Pattern-based text sanitization; no structured secret registry.

### [18] Filesystem authority fragment: traversal-safe workspace-rooted file store
pkg: @beep/ontology-server
path: packages/ontology/server/src/aggregates/Session/Session.file-store.ts (segment checks rejecting '.'/'..'/empty L33-56; read/write path refusals L97-111; realPath canonical root L118, L227-228)
symbols: OntologyFileStore (live), resolveOntologyWorkspaceRoot

Concrete default-deny file authority for one capability: only root-relative, traversal-safe, .ttl-suffixed paths under a canonicalized ONTOLOGY_WORKSPACE_ROOT are readable/writable; refusals are typed values. Template for the sandbox's host-filesystem grant checker.

*caveats:* Ontology-slice-specific; not a reusable path-authority service.

### [19] IPC channel isolation for the sidecar (stdout framing guard)
pkg: apps/professional-desktop
path: apps/professional-desktop/server/IpcStdoutGuard.ts (IpcStdioLive L21-32; SidecarStdioLive L44) + IpcStdoutGuard.prelude.ts (pre-module-load stdout patch)
symbols: SidecarStdioLive, ipcTransport, protocolStdout

Guards the process stdout so only the RPC protocol sink writes frames; console and stray writes divert to stderr — a small but real example of channel-level flow control between an agent process and its host, patched before any module can initialize.

*caveats:* Protects framing integrity, not confidentiality/authority.

### [20] MCP host composition examples (stdio drivers) using the full kit
pkg: @beep/uspto-mcp, @beep/nlp-mcp, @beep/m365-mcp
path: packages/drivers/uspto-mcp/src/Server.ts (makeServerLayer: composeGatedLayers+gatedLayer+sanitizedToolkit over McpServer.layerStdio L84-96; UsptoSourceAuth.ts soft-gate registration); packages/drivers/nlp-mcp/src/Server.ts (Layer.mergeAll seam L101-107); packages/drivers/m365-mcp/src/Server.ts
symbols: makeServerLayer, UsptoSourceAuthRegistration, UsptoDocumentTiers

Three additional MCP hosts already standardized on the mcp-kit stack (credential gates, sanitized dispatch, field tiers) — the population of servers a repo-wide sandbox boundary would need to wrap, all sharing the same composition seam.

*caveats:* stdio transport hosts have no transport auth (unlike the desktop HTTP mount) and no TierGate wired — gating there is credential-mount + api_key_required only.

### [21] Inbound network policy + tailnet exposure control (adjacent to egress work)
pkg: apps/professional-desktop + @beep/tailscale
path: apps/professional-desktop/server/OntologyMcpTransport.ts (origin allowlist L23-31, CORS L72-79); packages/drivers/tailscale/src/Tailscale.service.ts (readTailscaleStatus L147; ensureTailscaleServe L288; probeTailscaleHttpsEndpoint L336; resolveTailscaleHttpsBaseUrl L399)
symbols: ontologyMcpAllowedOrigins, ensureTailscaleServe, probeTailscaleHttpsEndpoint

What network policy exists today: static inbound origin allowlists with decision metrics, and a Tailscale CLI driver that can scope service exposure to a tailnet. Neither is outbound/destination-aware, but the tailscale driver shows the repo's pattern for wrapping network-control CLIs behind typed Effect services.

*caveats:* No outbound policy anywhere; tailscale driver is topology management, not per-request egress control.


## gaps (NOT FOUND)

- **Default-deny host authority service / named authority grants (principal-scoped, expiring, auditable grants governing what executed code may touch)**
  - searched: rg -lni 'default-deny|defaultDeny|hostAuthority|AuthorityGrant|ExecutionSandbox|sandbox' over packages/**/src and apps/**/src — only unrelated hits (Next ImageConfig schema, iana media types, editor embeds, CSP schema, lint tooling). Closest fragments are TierGate's flat approvedTools name list and SourceAuth hard gates; neither binds to Principal, carries scope/expiry, or covers non-MCP execution.

- **Destination-aware egress policy for outbound HTTP/fetch (host allowlists, deny-by-default network)**
  - searched: rg -ln 'egress|allowlist|allowList|denylist' over packages/apps src — hits are inbound origin allowlists (OntologyMcpTransport), eslint law allowlists, and unrelated files. Inspected the single shared wrapper packages/foundation/capability/api-transport/src/Transport.ts end-to-end: composes auth+rate-limit+retry only, no destination filtering; drivers may also use FetchHttpClient directly (e.g. test layers, oip-web), bypassing even that.

- **Resource ceilings on execution (CPU, memory, wall-clock, process count) for model-generated code or spawned agent processes**
  - searched: rg -lni 'ResourceCeiling|ResourceLimit|cpuLimit|memoryLimit' packages apps src — only Next ExperimentalConfig schema. Existing ceilings are all count/byte-shaped: ontologyToolBudgets (op/result counts), OntologySparqlSafeguards (row truncation), FieldTier projectWithinBudget (JSON bytes), api-transport RateLimiter (request rate), Semaphore(1) (concurrency). ChildProcessSpawner consumers (tailscale, libpff, ai-provider-cli, acp, ffmpeg) impose no rlimits/timeouts at the spawner seam.

- **OS/process/VM isolation primitives (seccomp, landlock, bubblewrap, nsjail, isolated-vm, vm2, ShadowRealm, worker-based security isolation)**
  - searched: rg -lni 'seccomp|landlock|firejail|bubblewrap|nsjail|worker_threads|isolated-vm|vm2|ShadowRealm' packages apps src — zero hits. Web workers exist only for compute offload (packages/ontology/use-cases/src/aggregates/Session/Session.worker-protocol.ts, packages/ontology/client/src/aggregates/Session/Session.visualizer.worker.ts), not as a security boundary.

- **Cross-tool flow control / taint tracking (labeling data returned by one tool to constrain what later tools/egress may do with it)**
  - searched: rg -lni 'flow.control|crossTool|cross-tool|taint' packages src — no relevant hits (Chat.atoms, CitationBase, repo-utils JSDoc models are incidental matches). No provenance-label propagation exists outside PROV-O sidecar export for ontology mutations.

- **Immutable execution ledger (append-only, tamper-evident record of every execution/tool call)**
  - searched: rg -ln 'ExecutionRecord|ExecutionLedger|AuditLog|audit_log|auditTrail|append-only' packages apps src — zero hits. TierGateAuditRecord is generated per gated call but its designated sink (UsageRecord.metadata jsonb) is never wired: OntologyToolHandlers.ts L87 discards the approved-path audit, and UsageRecord rows are mutable BaseEntity rows. Bitemporal/append-only storage exists only as spike tests in packages/drivers/pglite (commit 57c475f724, goals/epistemic-bitemporal-edge-core) — not a production package.

- **Sessions/scopes/OAuth-style IAM (auth sessions, permission scopes, token issuance/verification)**
  - searched: rg -lni 'better-auth|jwt' packages src — only iana-media-types data, CauseRedaction text, generated Box models. Package-name scan for iam/auth/identity found only @beep/identity (schema identity composers, not IAM). Only auth mechanisms in repo: per-launch bearer token (apps/professional-desktop/server/RpcSessionAuth.ts) and env-var API keys; Principal (shared-domain) is attribution vocabulary with no enforcement.

- **Centralized env schema / config-contract package (typed catalog of all env vars an execution may read)**
  - searched: Listed packages/shared (only domain+tables; shared/CLAUDE.md marks @beep/shared-config as reserved, not created). rg -ln 'Config.redacted' shows ~25 independent per-driver/per-app read sites (drivers/*, apps/*/runtime, tooling cli EnvConfig) with no shared env manifest; agents-domain EnvVars is the only env-name policy schema and covers only provider-instance child env.
