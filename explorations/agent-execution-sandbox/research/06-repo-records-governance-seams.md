# In-repo inventory — records, approval, and governance seams

> Research-stage artifact of `explorations/agent-execution-sandbox`, produced
> 2026-07-25 by the `agent-sandbox-research` workflow (repo-records sweep agent; structured
> output, verbatim). URLs were retrieved or seen in search results by the
> agent under a no-fabrication rule; license fields reflect what the agent
> verified (see per-source notes; unverified licenses are marked
> reference-only). Synthesis and caveats: [`../RESEARCH.md`](../RESEARCH.md);
> provenance ledger: [`SOURCES.md`](./SOURCES.md).
## findings

### [0] Fail-closed prompt admission (safeForPrompt) — ownership claim + explicit egress deferral
pkg: goals/ingestion-secret-scrub (spec only; target @beep/files domain at packages/foundation/capability/file-processing)
path: goals/ingestion-secret-scrub/SPEC.md (lines 5-17 objective, 19-28 non-goals, 88-97 failure posture, 129 block 9)
symbols: safeForPrompt, TextAnchor.quote, AiMetricsRedactionResult

safeForPrompt is a narrow scrub-result capability enforced at ONE real prompt boundary: unresolved matches / unknown coverage / residue block the prompt leg (ratified block 8, verbatim at SPEC lines 88-97). Non-goals (lines 19-28) explicitly leave to later increments: injection findings, HTML sanitization, guarded remote fetch / DNS-rebinding proof, secret resolver, credential vault. Ratified block 9 'Operational egress default-deny' exists only as a policy pointer (line 129) into explorations/ingestion-security-secret-governance/BRIEF.md — the operational egress boundary is deliberately NOT this goal. Sandbox composition point (stated verbatim in explorations/agent-execution-sandbox/CAPTURE.md:99-103): sandbox must consume safeForPrompt without treating it as action authorization.

*caveats:* NOT IMPLEMENTED: rg -n 'safeForPrompt' across packages/ and apps/ returns zero hits; goal lifecycle is 'active'. The two pattern banks it will consolidate DO exist: packages/tooling/library/ai-metrics/src/privacy.ts and packages/foundation/capability/observability/src/CauseRedaction.ts.

### [1] Approval / disposition model (human-in-the-loop candidate lifecycle)
pkg: goals/agentic-professional-runtime (doc) + @beep/workspace-domain + @beep/agents-use-cases (code skeleton)
path: goals/agentic-professional-runtime/docs/approval-and-autonomy-policy.md (lines 21-51 lifecycle+verdicts, 42-52 gate record fields, 65-67 autonomy scoping)
symbols: candidate|accepted|rejected|revision_requested|superseded, seven typed verdicts: shape validity, anchor fidelity, semantic stance, source authority/currentness, human disposition, action authorization, release

Defines candidate→accepted disposition as a scoped human verdict that does NOT make the proposition true and does NOT imply any other verdict — 'action authorization' is named as an independent typed verdict axis (lines 36-40). Approval gates must record: requested actions, reviewer principal, candidate item refs, evidence refs, policy basis, decision state, decision timestamp (lines 42-51). Later autonomy is policy-scoped by organization, workspace, role, and action type (lines 65-67). Rejected work must remain in audit/activity history, never silently deleted (lines 81-88). Sandbox composition: 'approval' in the sandbox = recorded scoped human disposition; the action-authorization verdict is the sandbox's natural admission input, and it currently has NO code owner.

*caveats:* Code vocabulary is deliberately minimal v1: ApprovalDecision = LiteralKit(['pending']) (packages/workspace/domain/src/values/ApprovalDecision/ApprovalDecision.model.ts:25), CandidateLifecycle = LiteralKit(['candidate']) (packages/workspace/domain/src/values/CandidateLifecycle/CandidateLifecycle.model.ts:25), RuntimeApprovalDecision/RuntimeCandidateLifecycle same (packages/agents/use-cases/src/processes/ProfessionalRuntime/ProfessionalRuntime.values.ts:65,139). accepted/rejected/revision_requested/superseded exist only in prose.

### [2] Persisted approval gate + professional-runtime candidate contracts
pkg: @beep/workspace-domain, @beep/agents-use-cases
path: packages/workspace/domain/src/entities/ApprovalGate/ApprovalGate.model.ts:30 (ApprovalGate entity: decision, fixtureKey, lifecycle, snapshot jsonb); packages/agents/use-cases/src/processes/ProfessionalRuntime/ProfessionalRuntime.contracts.ts:473 RuntimeApprovalGate, :608 RuntimeActivity, :645 RuntimeUsageRecord, :731 SdkContextPacket, :810 CandidateOutputSet
symbols: ApprovalGate, RuntimeApprovalGate, RuntimeCandidateClaim, RuntimeCandidateDraft, CandidateOutputSet, SdkContextPacket

The persisted ApprovalGate entity and the full runtime fixture loop (candidate claims/tasks/drafts → approval gate → activity → usage record) already exist schema-first. A sandbox execution-request → gate → record pipeline can extend RuntimeApprovalGate's 'requested actions' shape rather than inventing a new approval surface.

*caveats:* Fixture-service proof only (ProfessionalRuntime.fixture-service.ts); gates are permanently 'pending' in v1; no enforcement wiring to any execution path.

### [3] Bitemporal immutability / lineage / supersession — ratified design + spike evidence (commit 57c475f724)
pkg: @beep/pglite (spike only) + goals/epistemic-bitemporal-edge-core
path: goals/epistemic-bitemporal-edge-core/SPEC.md (lines 47-67 verbatim invariants contract); goals/epistemic-bitemporal-edge-core/ops/handoffs/p0-to-p1-handoff.md (lines 9-55 ratified enforcement design, 57-119 P1 decisions); packages/drivers/pglite/test/integration/fixtures/epistemic-bitemporal-spike/20260725000000_epistemic_bitemporal_spike/migration.sql (spike_edge_version: half-open axes, EXCLUDE no-overlap, supersedes_id lineage FK, unique open-head index; spike_claim_disposition CHECK active|rejected|superseded); packages/drivers/pglite/test/integration/spike/{EpistemicBitemporalSpike.pglite.test.ts,EpistemicBitemporalSpike.pg.test.ts,EpistemicBitemporalIdentity.test.ts}
symbols: logical_key (sha256 canonical identity), supersedes_id, int8range '[)' EXCLUDE USING gist, asOf(validAt, knownAt), ClaimDisposition, SupersessionConflict

Immutable fact payloads, correction-by-supersession (close-and-insert in ONE transaction, SELECT FOR UPDATE + expectedVersion → typed SupersessionConflict), lineage via self-FK, two-axis history with canonical asOf predicate — all P0-proven with concurrency tests. This is the repo's canonical 'immutable record with alternate-history proof' substrate. Sandbox composition (per its own CAPTURE and align decision 3): execution records may later feed belief views, but execution events must not become beliefs merely because immutable; the sandbox's immutable-execution-ledger design should reuse the half-open-interval + supersession-lineage idiom rather than invent a second immutability model.

*caveats:* P1 NOT LANDED: packages/epistemic/{domain,tables,use-cases,server} contain the claim-gate/usage slice, not the edge tables; the spike suites and fixture DDL are scheduled for DELETION in the P1 PR (handoff item 9) — cite the handoff, not the spike code, as durable design. Rejected gate verdict is still a no-op at packages/epistemic/use-cases/src/ClaimLifecycle/ClaimLifecycle.service.ts:114-116 (rejected: () => Effect.succeed(claim)) until ClaimDisposition lands.

### [4] Governance protocol seam — role authority, gated lifecycles, blockers, exceptions
pkg: explorations/agent-governance-control-plane
path: explorations/agent-governance-control-plane/CAPTURE.md (lines 20-27 role authority, 29-33 gated lifecycle, 26-28 structured blockers, 39-41 expiring exceptions); ops/manifest.json openQuestion
symbols: orchestrator/worker/adversarial-auditor/drift-auditor roles, Research→Plan→Implement→Refine→Validate gates, exception ledger

Owns the WIDER governance protocol: explicit authority by role (workers cannot overrule auditors; auditors cannot widen scope; overlapping ownership is a defect), universal gated lifecycle with entry/exit criteria, structured blocker records, expiring exceptions. The sandbox packet's CAPTURE (lines 110-115) proposes the seam: sandbox owns concrete execution isolation + authority boundary; control-plane owns governance protocol — and states verbatim 'the seam is not settled'. Control-plane's own sole open question is whether it should even be a shaped capability vs repo-wide law + operator skills.

*caveats:* CONTESTED SEAM (explicitly). Capture-stage only, no code; its design corpus lives only in git history (pre-deletion goals/agent-governance-control-plane/design/). Nothing in it addresses host isolation, network policy, or resource ceilings — those are unclaimed by it.

### [5] Sandbox packet self-claims and declared seams
pkg: explorations/agent-execution-sandbox
path: explorations/agent-execution-sandbox/CAPTURE.md (lines 97-132 repo composition map, 134-175 boundary sketch incl. execution-record field list at 160-164 and storage-class/immutability tension at 166-175, 177-207 open tensions); ops/manifest.json (4 openQuestions incl. master align Q10 and the five-way ownership split: policy decision / host isolation / credential brokering / execution logging / certification)
symbols: default-deny grants naming principal, purpose, resource, operation, sink, budget, policy revision, expiry

The packet already records its own seam map: consume safeForPrompt (not authorization), consume approval-as-human-disposition, reuse bitemporal immutability without conflating execution events with beliefs, defer governance protocol to control-plane, and reuse the OntologyToolkit budget/refusal idiom. Its capture states 'I did not find a repo-wide sandbox that already combines default-deny host authority, network policy, resource ceilings, cross-tool flow control, and an immutable execution ledger' (lines 130-132) — this inventory confirms that claim.

*caveats:* Capture stage; the five-way ownership split (line 205-207) is the packet's own unresolved monolith worry.

### [6] Secret governance / SSRF / egress gated candidates (adjacent ownership)
pkg: explorations/ingestion-security-secret-governance
path: explorations/ingestion-security-secret-governance/README.md (lines 19-26 five gated candidates); goals/ingestion-secret-scrub/SPEC.md:115 (Q8: split pure host classification from pinned connect-time SSRF enforcement)
symbols: ingestion-injection-findings, safe-html-sanitization, guarded-remote-fetch, secret-resolution-contract, per-user-credential-vault

This exploration owns network-fetch hardening (guarded-remote-fetch behind a DNS-rebinding harness) and credential brokering (secret-resolution-contract + per-user-credential-vault, ownership model ratified, gated behind threat-model spike). manifest openQuestions: []. Overlap with sandbox: 'destination-aware egress' vs guarded-remote-fetch/Q8 SSRF split is ADJACENT-CONTESTED — that packet owns ingress-side fetch of untrusted content; nobody owns agent-initiated outbound sinks (the read-plus-egress disclosure composition named in the sandbox capture).

*caveats:* All five candidates are unbuilt and gated. Credential brokering is claimed by this packet's vault candidate — the sandbox should broker THROUGH it, not own custody.

### [7] MCP write wall — action-authorization proof candidate (overlapping ownership)
pkg: explorations/mcp-auth-gated-registration
path: explorations/mcp-auth-gated-registration/README.md (lines 21-27); ops/manifest.json openQuestion: 'a named MCP host exposes a genuinely write-capable operation requiring candidate→approved enforcement and end-to-end UsageRecord.metadata audit'
symbols: mcp-write-wall

The sole remaining candidate is exactly one of the sandbox's Q10 fork options in miniature: a write-capable MCP tool behind candidate→approved enforcement with full audit. CONTESTED/OVERLAPPING: if the sandbox picks an MCP tool as its first action-authorization fixture, it collides with (or should absorb/satisfy) mcp-write-wall. Shipped goals mcp-kit / uspto-mcp / mcp-host-retrofit are completed-retained.

*caveats:* The write wall requires a REAL write-capable host; ODP's read-only soft gate explicitly does not clear the trigger (Trail 2026-07-14).

### [8] Model/artifact admission dispositions (upstream input, explicitly not authorization)
pkg: explorations/model-artifact-admission
path: explorations/model-artifact-admission/README.md; ops/manifest.json openQuestions (3): hosted-mutable-model identity without artifact digest; requalification vs bounded delta suite; typed admission dispositions 'without collapsing them into a scalar trust score or action authorization'
symbols: 

Owns binding qualification to the exact executable model arrangement (model, adapter, modality, prompt, wrapper, decoding config, artifact digest). Its third open question draws the seam itself: admission dispositions must NOT become action authorization — so the sandbox consumes admission verdicts as one more independent input, mirroring safeForPrompt.

*caveats:* Capture stage, same 2026-07-25 dispatch cohort as the sandbox; no code.

### [9] LLM dispatch composition boundary (where spend/token ceilings would attach)
pkg: explorations/multi-provider-llm-dispatch-fallback
path: explorations/multi-provider-llm-dispatch-fallback/README.md (graduated; demand-gated llm-runtime-dispatch candidate at the agents server composition boundary; candidate consumer: AnthropicTurnKernel successor); ops/manifest.json openQuestions: []
symbols: llm-runtime-dispatch, ExecutionPlan

Names the agents-server composition boundary as the future home of ordered dispatch policy — the natural attachment point for the sandbox's token/spend/retry ceilings on model calls. No governance claims; graduated on the subscription-auth leg (goals/llm-provider-subscription-auth stores no tokens).

*caveats:* Dispatch remainder is unscaffolded until a real consumer needs two credential-resolvable runtime targets.

### [10] Append-only usage/audit ledger (implemented)
pkg: @beep/epistemic-domain, @beep/epistemic-tables, @beep/_internal/db-admin
path: packages/epistemic/domain/src/entities/UsageRecord/UsageRecord.model.ts:71 UsageRecord, :172 TurnFinalizationUsageAppend, :225 appendTurnFinalizationUsageRecord; packages/epistemic/tables/src/entities/UsageRecord/UsageRecord.table.ts; db-admin migration target 'epistemic-usage' (packages/_internal/db-admin/src/targets.ts)
symbols: UsageRecord, TurnFinalizationUsageAppend, activityId, actor: Principal, credentialReference: OnePasswordReference, metadata jsonb

'Append-only usage attribution record linked to an epistemic Activity' — already carries actor Principal, model/provider, tokens, latency, approximate spend micros, credential REFERENCE (never the secret), and open jsonb metadata (the mcp-write-wall audit channel). Closest existing thing to an execution record row; the sandbox's ledger can extend this Activity→UsageRecord shape with grant/policy-revision/sink/budget fields.

*caveats:* Append-only by convention/description, not by DB enforcement — no immutability trigger, no hash chaining, no supersession lineage (that idiom lives in the bitemporal P1 design).

### [11] Provenance activity + principal identity vocabulary (implemented)
pkg: @beep/epistemic-domain, @beep/shared-domain
path: packages/epistemic/domain/src/entities/Activity/Activity.model.ts:47 Activity (fixtureKey + snapshot jsonb); packages/shared/domain/src/entity/Principal.ts:244 Principal tagged union — :75 UserPrincipal, :104 ServiceAccountPrincipal, :143 AgentPrincipal, :180 ConnectorAccountPrincipal, :215 SystemPrincipal, :14 SystemComponent LiteralKit(['Runtime','Sync','Migration','Policy','Generator'])
symbols: Activity, Principal, AgentPrincipal, SystemPrincipal

Principal is the ready-made 'named principal' half of a named authority grant (grants name principal+purpose+resource+operation+sink+budget+revision+expiry per the sandbox capture); AgentPrincipal already distinguishes agent actors from users/services. Activity is the causal-parent anchor UsageRecord rows FK into (activityId). Provenance-shared-claim-kernel goal (owner of this promotion) is completed-retained.

*caveats:* No purpose/resource/sink/expiry grant object exists anywhere — Principal is identity only. PROV-O vocabulary also available at packages/foundation/modeling/rdf/src/Prov.ts for semantic lineage if needed.

### [12] Typed verdict gate mechanism (implemented) — refusal-as-value, fail-closed
pkg: @beep/epistemic-domain, @beep/epistemic-use-cases, @beep/shared-domain
path: packages/epistemic/domain/src/values/ClaimGate/ClaimGateResult.model.ts:90 ClaimGateVerdict LiteralKit(['admitted','rejected']), :124 ClaimGateResult tagged union, :78 ClaimGateViolation; packages/epistemic/use-cases/src/ClaimGate/ClaimGate.service.ts:132 makeClaimGate (SHACL→verdict); packages/shared/domain/src/values/ClaimLifecycle/ClaimLifecycle.model.ts:18 LiteralKit(['candidate','shape_valid','consistency_checked','admitted']), :93 ClaimLifecycleTransition ('records a transition, does not authorize one')
symbols: ClaimGateResult, ClaimGateViolation, ClaimLifecycle, ClaimLifecycleTransition, makeClaimTransition

The repo's canonical typed-verdict gate pattern the sandbox admission decision should copy: LiteralKit verdict → toTaggedUnion with violation payloads, error channel never, fail closed. Shared vocabulary lives in shared-domain so other verticals type against it without importing the epistemic slice — the same promotion path a shared 'execution grant/verdict' vocabulary would take.

*caveats:* epistemic-claim-lifecycle-gate goal completed-retained; the rejected branch persists nothing until bitemporal P1 ClaimDisposition (see ClaimLifecycle.service.ts:114-116 no-op).

### [13] Default-deny gated tool composition + per-call sanitized audit (implemented — strongest sandbox precedent)
pkg: @beep/mcp-kit (packages/foundation/capability/mcp-kit)
path: packages/foundation/capability/mcp-kit/src/TierGate.ts:37 TierGateOutcomeTag LiteralKit(['approved','refused']), :107 TierGateAuditRecord (written for EVERY gated call, approved and refused, per Q7), :166 TierGateVerdict; ToolkitComposition.ts:124 composeGatedLayers (hard-gated layers VANISH at composition when credential absent), :51 GatedLayer; SourceAuth.ts:50 SourceAuthGate LiteralKit(['none','soft','hard']), :189 SourceAuthDecision, :217 decideSourceAuthMount; ApiKeyRequired.ts:67 ApiKeyRequiredFailure; McpCaller.ts:27 McpCallerIdentity, :44 CurrentMcpCaller Context.Reference
symbols: TierGateVerdict, TierGateAuditRecord, composeGatedLayers, SourceAuthGate, CurrentMcpCaller

Already implements three sandbox primitives at the MCP tool boundary: (1) credential-keyed default-deny — ungranted capability does not exist at composition time rather than erroring at call time; (2) fail-closed dispatch verdict with refusal-as-value; (3) mandatory sanitized audit record per call with request-local caller identity. The sandbox packet can generalize this from 'credential present?' to 'named authority grant present?' and from tool mount to resource/sink/budget dimensions.

*caveats:* Tool-registration granularity only — no resource ceilings, no network/destination policy, no delegation chains; audit persistence is consumer-side (schema only).

### [14] Server-owned resource ceilings + typed budget refusal (implemented precedent)
pkg: @beep/ontology-use-cases
path: packages/ontology/use-cases/src/tools/OntologyToolkit.ts:72 OntologyToolBudgets, :92 ontologyToolBudgets (immutable defaults), :109 OntologyBudgetKind LiteralKit; exercised with caller provenance + budget failures in apps/professional-desktop/test/integration/ontology-mcp-http.test.ts
symbols: OntologyToolBudgets, ontologyToolBudgets, OntologyBudgetKind

The repo's only enforced resource-ceiling precedent: server-owned static ceilings (never client-supplied), typed refusal naming the exhausted budget family. The sandbox capture itself names this as 'a reusable boundary idiom, not a general execution sandbox'. Pattern to lift for tokens/tool-calls/retries/time/spend profiles.

*caveats:* Static per-request ceilings only — no cumulative/run-level budget, no CPU/memory/process/filesystem/output-size limits anywhere in the repo.

### [15] Append-only turn/tool-call event store (implemented)
pkg: @beep/workspace-domain, @beep/workspace-server
path: packages/workspace/domain/src/entities/Turn/Turn.model.ts:165 TurnItemTag LiteralKit(['message','tool_call','tool_result','artifact_ref','activity']), :187 TurnItem union, :282 Turn entity; packages/workspace/server/src/aggregates/Thread/ThreadStore.repo.ts:308 appendTurn (in-memory), :488 drizzleAppendTurn; db-admin migration target 'workspace-thread'
symbols: Turn, TurnItem, ToolCallItem, ToolResultItem, ThreadStore.appendTurn

Already records tool calls and tool results as append-only turn items inside threads — the conversational execution trace the sandbox's execution ledger must correlate with (causal parents). UsageRecord.metadata currently carries turnId as the join key.

*caveats:* Append-only by repository surface, not DB-enforced; no supersession/immutability proof; workspace-thread-domain goal owns it.

### [16] Durable execution / workflow engine (NOT implemented — spike goal only)
pkg: goals/effect-v4-workflow-engine-spike
path: goals/effect-v4-workflow-engine-spike/README.md + ops/manifest.json (active; 'P0 must select the proof store and map all 14 durability constraints before adapter implementation')
symbols: WorkflowEngine.makeUnsafe (Effect v4, planned)

The only durable-execution workstream: prove a persistence-backed Effect v4 WorkflowEngine adapter survives process kill/restart, contract handed to law docketing. Relevant to sandbox 'reliable interruption / incident replay' controls; if the sandbox needs durable run state it should consume this contract, not build an engine.

*caveats:* Zero package code: rg '@effect/workflow|WorkflowEngine|durable execution' over packages+apps returns no runtime hits. P0 not started at HEAD.

### [17] Secret-redaction pattern banks (implemented, pre-consolidation)
pkg: @beep/ai-metrics (tooling/library), @beep/observability (foundation/capability)
path: packages/tooling/library/ai-metrics/src/privacy.ts (AiMetricsRedactionResult counted-proof precedent); packages/foundation/capability/observability/src/CauseRedaction.ts (broader observability bank)
symbols: AiMetricsRedactionResult, CauseRedaction

The two live redaction banks the scrub goal will consolidate into one versioned bank. Directly relevant to the sandbox's storage-class problem: 'immutable cannot mean store every secret-bearing byte forever' — execution records need the same masked-evidence/keyed-digest discipline the scrub SPEC ratifies (blocks 4-6, retention clocks 7d/30d/12mo).

*caveats:* Divergent today; ingestion-secret-scrub P0 owns the consolidation. Do not add a third bank for sandbox records.

### [18] SEAM MAP (synthesis of ownership claims found)
pkg: cross-packet
path: explorations/agent-execution-sandbox/CAPTURE.md:97-132 is the packet's own map; this entry records the verified state
symbols: 

OWNED ELSEWHERE (consume, don't rebuild): prompt admission → ingestion-secret-scrub (safeForPrompt, fail-closed); human disposition + gate record shape → agentic-professional-runtime policy + workspace ApprovalGate; immutability/lineage/supersession substrate → epistemic-bitemporal-edge-core (P1 pending, design ratified in p0-to-p1-handoff.md); governance protocol (roles, gated lifecycles, blockers, exceptions) → agent-governance-control-plane; credential custody/brokering → ingestion-security-secret-governance vault candidates; model qualification → model-artifact-admission; MCP tool-mount default-deny + per-call audit → @beep/mcp-kit (shipped). CONTESTED/UNSETTLED: sandbox-vs-control-plane execution-isolation seam ('seam is not settled', CAPTURE:110-115); sandbox-vs-mcp-write-wall first action-authorization fixture; agent-initiated outbound egress sits between the sandbox's 'destination-aware egress' and ingestion-security's ingress-focused guarded-remote-fetch/Q8 — neither owns outbound sinks today. UNCLAIMED (no owner, no code): named authority-grant object (principal+purpose+resource+operation+sink+budget+policyRevision+expiry), grant revocation, host/process isolation, CPU/memory/fs/output ceilings, cumulative run budgets, delegation-chain authority, tamper-evident execution ledger, the 'action authorization' and 'release' verdicts of the seven-verdict model.

*caveats:* Contested seams should be resolved in the sandbox's align stage; the packet's manifest already carries the ownership-seam question verbatim.


## gaps (NOT FOUND)

- **safeForPrompt implementation / any enforced prompt-admission capability in code**
  - searched: rg -n 'safeForPrompt' packages apps --glob '**/*.{ts,tsx}' — zero hits; goals/ingestion-secret-scrub/ops/manifest.json lifecycle=active (spec-only)

- **Destination-aware egress / network policy / SSRF enforcement at runtime**
  - searched: rg -ln 'egress|ssrf|rebinding|allowlist' packages --glob '**/src/**/*.{ts,tsx}' -i — only tooling/lint allowlist snapshots and Yeet publish-scope internals; guarded-remote-fetch and the Q8 host-classification/connect-time split are unbuilt gated candidates in explorations/ingestion-security-secret-governance

- **Hash-chain / tamper-evident / merkle append-only ledger (proof against deletion, truncation, replay, alternate histories)**
  - searched: rg -ln 'append-only|appendOnly|hash chain|hashChain|merkle' packages -i — only prose 'append-only' in UsageRecord/Graphiti CLI/Corpus internals; rg 'sha256|digest|checksum|contentHash' — content digests exist (semantic-web canonicalization.ts, docgen ProofManifest.ts, document intake) but no chained/tamper-evident record store

- **Workflow engine / durable execution runtime in packages**
  - searched: rg -ln '@effect/workflow|ClusterWorkflow|DurableExecution|durable execution' packages apps (ts/tsx/json, -i) — zero runtime hits; only goals/effect-v4-workflow-engine-spike (active, P0 unstarted) and DurableLocator (law-practice citation value object, unrelated)

- **Named authority-grant / capability-token object (principal, purpose, resource, operation, sink, budget, policy revision, expiry) and any revocation model**
  - searched: rg 'grant|Grant|revocation|revoke' sampling across packages src; Principal.ts (identity only), SourceAuth.ts (credential presence only), OnePasswordReference (secret reference only) — no grant schema anywhere; also absent from all five exploration captures as code

- **Host/process isolation or resource-ceiling enforcement beyond static per-request tool budgets (CPU, memory, process, filesystem, output-size, cumulative run budgets)**
  - searched: rg -ln 'sandbox|isolate|isolation|resource limit|ceiling|ulimit|cgroup' packages --glob '**/src/**/*.{ts,tsx}' -i (spot-checked hits: OntologyToolkit budgets only); sandbox CAPTURE.md:130-132 independently records the same negative finding

- **Code vocabulary for accepted/rejected/revision_requested/superseded approval decisions and for the 'action authorization' + 'release' typed verdicts**
  - searched: Read ApprovalDecision.model.ts (LiteralKit(['pending']) only), CandidateLifecycle.model.ts (['candidate'] only), ProfessionalRuntime.values.ts (same); rg 'action authorization|release' packages src — verdict axes exist only in goals/agentic-professional-runtime/docs/approval-and-autonomy-policy.md prose and the epistemic typed-verdict docs commit 27ade66e3f

- **Landed packages/epistemic bitemporal edge tables (the p0 commit's production surface)**
  - searched: git show --stat 57c475f724 (spike tests + fixture DDL under packages/drivers/pglite only); find packages/epistemic/*/src — edge/disposition tables absent; P1 vertical slice defined in goals/epistemic-bitemporal-edge-core/ops/handoffs/p0-to-p1-handoff.md but unimplemented at HEAD
