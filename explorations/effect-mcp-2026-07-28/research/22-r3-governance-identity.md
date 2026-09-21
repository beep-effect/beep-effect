# Lane 22-r3 — Session-keyed governance under a stateless protocol

Lane: `22-r3-governance-identity`. Packet: `effect-mcp-2026-07-28`. Date: 2026-09-16.

**Question:** What in beep-effect assumes an MCP session exists (especially `GovernedTierGate` grant freezing, write-ahead decisions, and hash chains), and what identity anchors could replace `mcp-session-id`?

**Working assumptions challenged here:** G4 (`McpProtocol.v2026_07_28` only on every in-repo server). Effect `McpRequestContext` field population and `clientId` stability belong to lane 11-u2; cited briefly, not re-derived.

**Scope note.** Driver MCP servers (`packages/drivers/{nlp,m365,uspto,gov-legal}-mcp`, `packages/law-practice/server`, `apps/practice-kg-mcp`) have **no** `GovernedTierGate` / `CurrentMcpCaller` / grant-freeze. Session-keyed governance is ontology sidecar + `@beep/mcp-kit` + `epistemic/server` only. Out of this inventory: OpenClaw `--session-key` CLI flags, Box `DMS_BOX_CLIENT_ID`, chat-atom idle TTLs, and the desktop ontology *orchestrator* RPC `sessionId` (a different session object).

---

## 1. Session dependency inventory

### 1.1 The identity type (`@beep/mcp-kit`)

`McpCallerIdentity` is the only request-local identity the governed gate reads. Two fields:

- `clientId: NonNegativeInt` — “one **protocol exchange**, not one session”; HTTP mints it per request (`RpcServer.ts` `clientId++` inside the per-request effect).
- `sessionId: Option<NonEmptyString>` — “the transport-assigned session identifier — the `mcp-session-id` header minted at `initialize` — and is the only stable per-session key available to a dispatch.” `None` for transports that do not issue one (stdio), “where the connection itself is the session.”

Evidence: `repo:packages/foundation/capability/mcp-kit/src/McpCaller.ts:21-28`, `repo:packages/foundation/capability/mcp-kit/src/McpCaller.ts:42-55`.

`CurrentMcpCaller` is a `Context.Reference` defaulting to `O.none` — “absent outside a real tool dispatch” (`repo:packages/foundation/capability/mcp-kit/src/McpCaller.ts:71-73`).

beep-effect does **not** currently read Effect's `McpRequestContext` anywhere under `packages/` or `apps/` (graft grep: no hits). Identity is `McpServerClient.clientId` plus the HTTP header.

### 1.2 How `sessionId` is populated (HTTP header, not Effect service)

`sanitizedToolkit` reads `mcp-session-id` from `HttpServerRequest` at the toolkit dispatch boundary, *before* `provideContext` replaces the fiber context. Empty headers are filtered (`Str.isNonEmpty`). `clientId` is taken from `McpServerClient` via `Effect.serviceOption`. Together they become `CurrentMcpCaller`.

Evidence: `repo:packages/foundation/capability/mcp-kit/src/SanitizedSpan.ts:199-202`, `repo:packages/foundation/capability/mcp-kit/src/SanitizedSpan.ts:304-322`.

The toolkit's layer type still excludes `McpServerClient` from handler services (`repo:packages/foundation/capability/mcp-kit/src/SanitizedSpan.ts:410-413`), so dispatch identity is a kit fact, not something each tool rediscovers.

Tests that pin this:

| Test | File | Invariant |
| --- | --- | --- |
| `"reports no session id when the dispatch carries no HTTP request"` | `repo:packages/foundation/capability/mcp-kit/test/SanitizedToolkit.test.ts:218-232` | Direct `callTool` / stdio: `session=none`; caller still exists via `clientId`. |
| `"surfaces the mcp-session-id header to the handler as the caller's session id"` | `repo:packages/foundation/capability/mcp-kit/test/SanitizedToolkit.test.ts:235-250` | Header `"session-under-test"` → `session=session-under-test`; `clientId` independent. |
| `"treats an empty mcp-session-id header as absent"` | `repo:packages/foundation/capability/mcp-kit/test/SanitizedToolkit.test.ts:253-265` | Empty header is not a session; “keying run state on `""` would merge every such caller into one shared run.” |

### 1.3 `GovernedTierGate.runIdOf` — the load-bearing key

```
runIdOf(caller) =
  Some(sessionId) → "session:${sessionId}"
  None            → "client:${clientId}"
```

Evidence: `repo:packages/epistemic/server/src/GovernedTierGate/GovernedTierGate.gate.ts:188-197`.

Comment on that function: “A run is the MCP session. `clientId` cannot key it: the HTTP protocol mints a fresh one per request, so keying on it would open a new run per dispatch and reduce every chain to a single genesis row. `sessionId` is the transport's session identifier; transports that issue none (stdio) fall back to the client id, where the connection is the session.”

`evaluate` refuses with `no-grant-in-scope` (reason-free to the agent) when `CurrentMcpCaller` is `None` — “No MCP session means no run, hence no chain to append to” (`repo:packages/epistemic/server/src/GovernedTierGate/GovernedTierGate.gate.ts:345-348`). `recordOutcome` drops a caller-less settlement (`repo:packages/epistemic/server/src/GovernedTierGate/GovernedTierGate.gate.ts:473-478`).

### 1.4 Invariants keyed by that run id

| Invariant | How `sessionId` / `clientId` protects it | Tests |
| --- | --- | --- |
| **Grant-set freeze on first dispatch** | `resolveRun` freeze-creates a `RunState` on first `runId` miss; later dispatches reuse the same frozen `GrantSet`. Freeze inputs are session-static (composition-root options + `EpistemicConfig`), never tool output. Runs are never evicted. `repo:packages/epistemic/server/src/GovernedTierGate/GovernedTierGate.gate.ts:17-23`, `250-278`, `280-295`. Domain freeze: `repo:packages/epistemic/domain/src/values/GrantSet/GrantSet.model.ts:13-16`. | Distinct sessions → distinct runs: `"freezes distinct runs for distinct clients"` `repo:packages/epistemic/server/test/GovernedTierGate.test.ts:247-258`. Same session + drifting `clientId` → one run: `"keys the run on the session, not on the per-request client id"` `repo:packages/epistemic/server/test/GovernedTierGate.test.ts:320-335`. Domain freeze digest: `repo:packages/epistemic/domain/test/ExecutionAuthority.test.ts:261-267`. |
| **Write-ahead ledger decision** | Every `evaluate` seals an `ExecutionDecisionRecord` with `runKey` / `seq` / `prevHash` from that run and appends it *before* returning the verdict. Failed append refuses (`ledger-unavailable`); run state does not advance. `repo:packages/epistemic/server/src/GovernedTierGate/GovernedTierGate.gate.ts:12-16`, `384-411`. | `"writes the allowed decision ahead of the effect and settles it after"` `repo:packages/epistemic/server/test/GovernedTierGate.test.ts:129-158`. `"refuses fail-closed when the write-ahead decision cannot be written"` `repo:packages/epistemic/server/test/GovernedTierGate.test.ts:200-210`. PGlite: `"an allowed dispatch writes its decision ahead of the effect and exactly two rows in total"` `repo:packages/epistemic/server/test/integration/GovernedTierGate.pglite.test.ts:123-156`. Real driver failure: `"a real decision-write failure refuses the dispatch and the effect does not run"` `repo:packages/epistemic/server/test/integration/GovernedTierGate.pglite.test.ts:219-235`. |
| **Hash-chain continuity** | `RunState.lastHash` / `nextSeq` live in an in-memory `HashMap` keyed by `runId`. Consecutive decisions of one session form one verified chain; distinct sessions get distinct `runKey`s (digest of `epistemic-run/${runId}/${freezeEpochMillis}`). `repo:packages/epistemic/server/src/GovernedTierGate/GovernedTierGate.gate.ts:265-276`, `297-312`. Domain: decisions carry the chain (`seq`, `prevHash`, `hash`) `repo:packages/epistemic/domain/src/values/ExecutionRecord/ExecutionRecord.model.ts:12-13`. | `"chains consecutive decisions of one session into one verified run"` `repo:packages/epistemic/server/test/GovernedTierGate.test.ts:161-180`. PGlite mixed dispatches: `"a session's mixed dispatches chain into one verified run against the real constraints"` `repo:packages/epistemic/server/test/integration/GovernedTierGate.pglite.test.ts:188-212`. Overlapping same-tool dispatches bind by **fiber**, not session: `"binds each settlement to its own dispatch when same-tool dispatches overlap"` `repo:packages/epistemic/server/test/GovernedTierGate.test.ts:275-317`. HTTP live proof: two mutations, one `runKey`, `seq [0, 1]` `repo:apps/professional-desktop/test/integration/ontology-mcp-http.test.ts:278-293`. Acceptance: session chain of three allowed publication decisions `repo:apps/professional-desktop/test/integration/execution-authority.pglite.test.ts:277-287`. |
| **Grant TTL / `grant-expired` permanence** | TTL is measured from freeze (`grantTtl` on `GovernedTierGateOptions`). Runs are **never evicted**: “Evicting an expired run would let the next dispatch of that same session freeze fresh grants, so the grant TTL would bound nothing.” Growth is “one small entry per MCP session”; sessions “exist only after an `initialize` that already cleared the origin allowlist and the per-launch bearer token.” `repo:packages/epistemic/server/src/GovernedTierGate/GovernedTierGate.gate.ts:31-38`, `280-285`. Desktop composition-root TTL is 12 hours: `repo:apps/professional-desktop/server/OntologyMcpTransport.ts:132-134`. Domain evaluator returns `grant-expired` after `expiresAt`: `repo:packages/epistemic/domain/src/values/GrantSet/GrantSet.model.ts:523-525`. | Domain unit: `repo:packages/epistemic/domain/test/ExecutionAuthority.test.ts:206`. **NOT FOUND:** no `GovernedTierGate` test advances the clock past `grantTtl` and asserts `grant-expired` *and* that a subsequent dispatch of the same session cannot re-freeze. The permanence claim is comment + `resolveRun` never-evict, not a gate-level test. |
| **Audit attribution (ledger)** | Agent-facing `TierGateAuditRecord` carries tool / outcome / constant reason / destructiveness / optional `toolCallId` / timestamp — **not** `sessionId` or `clientId`. Bounded denial reason goes to the ledger row and server log. Every refusal the agent sees is `refusalGuidance` = `"This action is not authorized for this session."` `repo:packages/epistemic/server/src/GovernedTierGate/GovernedTierGate.gate.ts:161-181`, `314-327`, `329-340`. Ledger rows attribute via `runKey` + `grantSetDigest` + `principal`. The grant principal is `SystemPrincipal.make({ component: "Runtime", kind: "System" })` (`repo:packages/epistemic/server/src/GovernedTierGate/GovernedTierGate.gate.ts:183`) — **not** the MCP caller. | `"never returns a differential refusal reason to the caller"` `repo:packages/epistemic/server/test/GovernedTierGate.test.ts:338-360`. `"refuses a caller-less dispatch without touching the ledger"` `repo:packages/epistemic/server/test/GovernedTierGate.test.ts:213-226`. |
| **Audit attribution (ontology change actor)** | Mutation handlers mint `OntologyChangeActor` from **`clientId`**, not `sessionId`: ``urn:beep:desktop-rpc-session:mcp-client:${identity.clientId}``. Absence of caller → `OntologyActorIdentityRefusal`. `repo:packages/ontology/server/src/tools/OntologyToolHandlers.ts:80-92`, used at `162-168`. | HTTP test only asserts the URN *prefix* is present in provenance, not that two mutations in one session share one actor: `repo:apps/professional-desktop/test/integration/ontology-mcp-http.test.ts:521`. **Gap:** actor identity is already per-request on HTTP, even while the grant *run* is per-session. |
| **CORS / Origin allowlist of the session header** | Ontology sidecar CORS `allowedHeaders` and `exposedHeaders` include `mcp-session-id`. Protocol list is currently **stateful only**: `protocols: [McpProtocol.v2025_06_18]`. `repo:apps/professional-desktop/server/OntologyMcpTransport.ts:95-106`, `176-180`. | Harness captures and replays the header: `repo:apps/professional-desktop/test/integration/support/ontology-mcp-harness.ts:145-177`. In-repo live client does the same (`Mcp-Session-Id`): `repo:goals/ontology-agent-surface/ops/live-mcp-client.ts:24-39`. Host-socket history: missing replay produced Effect's empty 404 (`repo:goals/ontology-agent-surface/history/2026-07-11-p2-transport.md:34-42`). |

**Semantic note on freeze contents.** Grant *contents* are identical for every session (same operations, same `SystemPrincipal`, same TTL clock starting at first dispatch). The session key partitions the **store** (which freeze, which chain, which expiry). A client that can obtain a new session identifier gets a fresh freeze of the same grant set and a reset TTL. Today's stateful `initialize` already allows that (new UUID after origin + bearer). The freeze's security claim is “cannot widen *this conversation* after first dispatch,” not “this principal has unique grants.”

### 1.5 Bearer token is *not* a session key

`requireRpcSessionToken` is a per-launch bearer check on the HTTP route, combined with the origin allowlist. It authenticates the sidecar process (`BEEP_DESKTOP_RPC_SESSION_TOKEN`); it does not identify a run. The gate still keys on `mcp-session-id` after the token has already passed.

Evidence: `repo:apps/professional-desktop/server/OntologyMcpTransport.ts:95-97`; `repo:apps/professional-desktop/server/RpcSessionAuth.ts:23-28`, `44`, `88-119`. OPTIONS is exempt so browsers can preflight (`repo:apps/professional-desktop/server/RpcSessionAuth.ts:60-73`).

### 1.6 `GovernedEgress` is process-scoped, not session-scoped

`GovernedEgress` also freezes a grant set with `grantTtl`, but the freeze happens once per **process/layer**, not per MCP session. `Fetch` is a promise-returning function with no fiber, so it cannot read `CurrentMcpCaller`. Decisions chain into their own run; an auditor joins them to session rows by time.

Evidence: `repo:packages/epistemic/server/src/GovernedEgress/GovernedEgress.fetch.ts:23-31`; layer wiring `repo:apps/professional-desktop/server/OntologyMcpTransport.ts:223-234`. Acceptance test asserts two independent chains correlated by timestamp: `repo:apps/professional-desktop/test/integration/execution-authority.pglite.test.ts:313-317`. Closeout reflection still wants a kit seam to name the session from a non-fiber boundary: `repo:goals/agent-execution-authority/history/reflections/2026-07-28-claude.md:42-52`.

A session-identity replacement does **not** retarget egress unless the operator also wants per-session egress grants.

### 1.7 Other `sessionId` / `clientId` reads (not governance)

| Location | What it is | Governance? |
| --- | --- | --- |
| `repo:apps/professional-desktop/src/ontology/OntologyOrchestrator.ts:179` | Desktop RPC payload `sessionId` into ontology handlers | No — different session object. |
| `repo:apps/professional-desktop/test/ontology-sidecar-registration.test.ts:26` | `SessionId` schema for RPC validation | No. |
| `repo:apps/professional-desktop/src/runtime/Layer.ts:262` | `DMS_BOX_CLIENT_ID` | No. |
| `repo:apps/professional-desktop/src/spikes/CosmosSpike.worker.ts:72` | Spike hardcodes `"cosmos-spike"` | No. |

**NOT FOUND** in driver MCP servers named by G9: no `GovernedTierGate` / `CurrentMcpCaller` / `mcp-session-id` grant freeze.

---

## 2. Existing decisions that assumed sessions

Minimal quotes. The exploration packet's DECISIONS.md still records the *original* (wrong) key; the goal packet's SPEC/PLAN record the PR 5 correction. Both assumed an MCP session exists.

### 2.1 Shape decision 10 — a run is an MCP session (2026-07-25)

> “One MCP session. The grant set is frozen once, on the session's first dispatch, and reused for every subsequent `tools/call` on that session. The run store is keyed by the `clientId` that arrives per request via `CurrentMcpCaller`.”

> Rejected: *Run = one `tools/call`* (“the grant set would be computed *after* the poisoned content returned”); *An explicit `ontology_open_run` tool* (“adds a protocol concept every agent must know”).

> Consequence: “Run lifetime is bounded by the client session, so the store needs eviction tied to the client's lifecycle.”

Evidence: `repo:explorations/agent-execution-sandbox/DECISIONS.md:454-497`.

That `clientId` rationale cited then-current `McpServer.ts:1516-1521` (`clientSessions` / `initializedClients`). PR 5 found HTTP `clientId` is per request. **The exploration DECISIONS.md was not rewritten**; the correction lives in the graduated goal packet.

### 2.2 SPEC decision 10, corrected in PR 5

> “A run is an MCP session, keyed by the transport's session id (see note)”

> “Decision 10's key was corrected in PR 5. The decision named `clientId`, but `RpcServer`'s HTTP protocol mints that per request, so it identifies one protocol exchange rather than one session; keying a run on it opens a new run per dispatch. The run keys on the transport's session identifier — the `mcp-session-id` header, surfaced as `McpCallerIdentity.sessionId` — falling back to `clientId` on transports that issue none (stdio), where the connection is the session. The decision's substance is unchanged: a run is an MCP session.”

Evidence: `repo:goals/agent-execution-authority/SPEC.md:217`, `228-234`.

### 2.3 PLAN PR 5 corrections — session key and never-evict

> “The run keys on the transport's session identifier instead — `mcp-session-id`, surfaced through a new `McpCallerIdentity.sessionId` read in `sanitizedToolkit` before the handler context is replaced.”

> “`Wire eviction to the client lifecycle` — no such seam exists, and the expiry-based sweep written first was worse than none: evicting an expired run let that same session re-freeze fresh grants on its next dispatch, so the TTL bounded nothing. Runs are now never evicted… Growth is one small entry per MCP session. A lifecycle-bound release stays a candidate… and needs new `mcp-kit` surface.”

Evidence: `repo:goals/agent-execution-authority/PLAN.md:43-59`.

### 2.4 README PR 5 defect write-up (the test that would fail under `clientId` keying)

> “`clientId` is not a session. The HTTP protocol mints it per request… `McpCallerIdentity` gained `sessionId` (the `mcp-session-id` header…) and the run keys on that. The app test now runs two mutations on one MCP session and asserts one `runKey` with `seq [0, 1]` — which fails under `clientId` keying.”

Evidence: `repo:goals/agent-execution-authority/README.md:274-282`.

### 2.5 Foundation-mediated port inversion (doctrine)

> “`ontology/server` consumes `@beep/mcp-kit`'s `TierGate`, `epistemic/server` implements it, and the desktop entrypoint binds them.”

Evidence: `repo:standards/architecture/DECISIONS.md:1137-1140`. Session identity is a kit-shaped fact (`McpCallerIdentity`) that the implementing slice reads; replacing the anchor is a kit + gate change, not an ontology/epistemic cross-import.

### 2.6 Architecture 03 / 09 / 12 — session language

**NOT FOUND.** `standards/architecture/03-driver-boundaries.md`, `09-errors-across-boundaries.md`, and `12-observability.md` do not mention `mcp-session-id`, `GovernedTierGate`, or session-keyed grants.

Closest doctrine touch points if an identity replacement lands:

- **03:** driver MCP servers are technical wrappers; they do not own this policy. The governed surface is an app composition root (`OntologyMcpTransport.ts`).
- **09:** bounded denial reasons stay inside the ledger/log; the agent sees a public refusal envelope (`OntologyTierGateRefusal`). Identity replacement must not leak a new differential reason.
- **12:** `sanitizedToolkit` already treats the request boundary as the place to read identity (`SanitizedSpan.ts:304-312`). A new anchor should be read there, not rediscovered in handlers. Span attributes today do not carry `sessionId`.

### 2.7 Transport history assumed session replay

The ontology-agent-surface P2 transport note: the generic RPC HTTP client “does not retain MCP's response-issued `mcp-session-id`; subsequent requests reached MCP without a session and received its intentionally empty 404.” Evidence: `repo:goals/ontology-agent-surface/history/2026-07-11-p2-transport.md:34-42`.

---

## 3. What a 2026-07-28 request carries that could anchor identity

Lane 11-u2 owns field population. This section classifies **forgeability** for beep-effect's grant key, citing Effect source.

### 3.1 `McpRequestContext` has no session field

```
clientId, protocolVersion, clientCapabilities,
clientInfo?, requestMetadata?, inputResponses?, requestState?
```

Evidence: `effect:packages/effect/src/unstable/ai/McpSchema.ts:2814-2835`. Docs: “Unlike `McpServerClient`, this service does not imply an initialized session or support for server-initiated requests.”

`McpServerClient` (legacy, initialized sessions only) also has no `sessionId`; it has `clientId`, `protocolVersion`, `clientCapabilities`, `clientInfo`, `initializePayload`, `requestMetadata`, `getClient` (`effect:packages/effect/src/unstable/ai/McpSchema.ts:2838-2860`).

### 3.2 Field-by-field: client-controlled vs server-minted / server-verified

| Field | Where it comes from on 2026-07-28 | Forgeable? | Fit as grant-run key |
| --- | --- | --- | --- |
| **`mcp-session-id` header** | Stateful HTTP `initialize` mints `crypto.randomUUID()` and sets the response header (`effect:packages/effect/src/unstable/ai/internal/mcpRuntime.ts:502-508`). Unknown id → HTTP 404 (`effect:packages/effect/src/unstable/ai/internal/mcpRuntime.ts:282-284`). Stateless admission **does not consult** the header (stateless branch returns `Accepted` at line 280 before the session lookup). File comment: stateful storage is “for MCP revisions before v2026-07-28” (`effect:packages/effect/src/unstable/ai/internal/mcpStatefulRuntime.ts:1-3`). | **Today (stateful):** server-minted, server-validated; client can only replay a UUID the server issued. **Under G4:** Effect neither mints nor validates it. If beep-effect still reads the header, it is a client-supplied string. | Today's only stable HTTP key. Under G4, using it without a beep-effect validator is a client-controlled identity. |
| **`clientId`** | `RpcServer` HTTP protocol: `let clientId = 0` then `const id = clientId++` per request (`effect:packages/effect/src/unstable/rpc/RpcServer.ts:1074`, `1097`). Copied into `McpRequestContext` (`effect:packages/effect/src/unstable/ai/internal/mcpRuntime.ts:355-356`). | Server-minted, not client-set. **Unstable** across HTTP requests. Stdio connection may be stable (11-u2). | Already proven unusable as HTTP run key (`repo:packages/epistemic/server/test/GovernedTierGate.test.ts:320-335`). |
| **Authenticated bearer principal** | Desktop sidecar compares `Authorization` to `Bearer ${per-launch token}` (`repo:apps/professional-desktop/server/RpcSessionAuth.ts:44-57`). Same token for every client of that process. | Server-verified. Not per-conversation. A leaked token is process-wide. | Coarse: one run per sidecar launch. Stronger TTL (cannot reset by new conversation). Weaker isolation if two conversations share the sidecar. |
| **`clientInfo`** | Optional `_meta["io.modelcontextprotocol/clientInfo"]` (`effect:packages/effect/src/unstable/ai/internal/mcpSchema/v2026_07_28.ts:66-75`; copied in `effect:packages/effect/src/unstable/ai/internal/mcpProtocol/v2026_07_28.ts:79-86`). | **Client-controlled.** Optional. | Unfit. An agent names itself. |
| **`clientCapabilities`** | Required `_meta["io.modelcontextprotocol/clientCapabilities"]`. Stateless admission rejects if missing (`effect:packages/effect/src/unstable/ai/internal/mcpRuntime.ts:244-252`). | **Client-controlled** (must be present and well-typed; content is the client's claim). | Unfit as identity. |
| **`protocolVersion` in `_meta` + header** | Required; header must match `_meta` (`effect:packages/effect/src/unstable/ai/internal/mcpRuntime.ts:228-243`). | Consistency is server-verified; the value is still the client's protocol claim. Shared by every 2026-07-28 client. | Unfit as identity. |
| **`requestMetadata` / `_meta` remainder** | `RequestMetaObject` is a struct-with-rest JSON object (`effect:packages/effect/src/unstable/ai/internal/mcpSchema/v2026_07_28.ts:66-75`). Extra keys are client JSON. | **Client-controlled**, except keys Effect itself writes on *responses* (`io.modelcontextprotocol/serverInfo` on results, `effect:packages/effect/src/unstable/ai/internal/mcpProtocol/v2026_07_28.ts:89-97`). | A beep-effect-minted signed cookie *could* live here on later requests, but only if the server issued it and verifies a MAC. Untyped extra keys are forgeable. |
| **`requestState`** | Optional string on `tools/call`; server returns it unchanged on `input_required` (`effect:packages/effect/src/unstable/ai/McpSchema.ts:2691-2692`; payload `effect:packages/effect/src/unstable/ai/internal/mcpSchema/v2026_07_28.ts:347`; copied into context `effect:packages/effect/src/unstable/ai/internal/mcpProtocol/v2026_07_28.ts:333-345`). | **Client-echoed.** Effect source searched for HMAC / verify of `requestState`: **NOT FOUND**. Absent on ordinary first `tools/call`. | Wrong primitive (MRTR continuation, not a conversation). Forgeable unless beep-effect signs it. |
| **`inputResponses`** | Client answers to prior `inputRequests` (`effect:packages/effect/src/unstable/ai/McpSchema.ts:2674-2679`; `effect:packages/effect/src/unstable/ai/internal/mcpProtocol/v2026_07_28.ts:337-340`). | **Client-controlled** (the answers). | Unfit as identity. |
| **Origin allowlist** | Browser `Origin` checked by sidecar middleware and by `layerHttp` `allowedOrigins` (`repo:apps/professional-desktop/server/OntologyMcpTransport.ts:65-66`, `181-185`). | Server-verified against a static list. Shared by every allowed origin. | Unfit as a run key; remains an admission control. |

### 3.3 Stateless admission vs `initialize`

With a protocol list of only `v2026_07_28`, `selectStatefulProtocol` considers only stateful adapters (`effect:packages/effect/src/unstable/ai/internal/mcpRuntime.ts:182-187`) and `initialize` fails with “initialize is not supported by the configured MCP protocols” (`effect:packages/effect/src/unstable/ai/internal/mcpRuntime.ts:319-326`). Mixed lists are legal with at most one stateless adapter (`effect:packages/effect/src/unstable/ai/internal/mcpRuntime.ts:193-209`). (Plan-review verified premise; cited here because G4 removes the minting event the gate comments assume.)

### 3.4 `McpServerClient` is a legacy session service — G4 consequence for current kit

Handler docs: request handlers receive `McpRequestContext`; “initialized **legacy** requests additionally receive `McpServerClient`” (`effect:packages/effect/src/unstable/ai/McpServer.ts:1344-1347`, `1419-1421`).

`McpServerClientMiddleware` **dies** if the selected protocol version is `2026-07-28` (`effect:packages/effect/src/unstable/ai/McpServer.ts:891-892`).

`sanitizedToolkit` currently builds `CurrentMcpCaller` from `Effect.serviceOption(McpServerClient)` (`repo:packages/foundation/capability/mcp-kit/src/SanitizedSpan.ts:303-322`). If that service is absent, `CurrentMcpCaller` is `None`, and `GovernedTierGate.evaluate` refuses every dispatch (`repo:packages/epistemic/server/src/GovernedTierGate/GovernedTierGate.gate.ts:345-348`). `authenticatedMcpActor` independently fails (`repo:packages/ontology/server/src/tools/OntologyToolHandlers.ts:82-88`).

**Decision-challenge against G4 (implementation, not taste):** a `v2026_07_28`-only ontology sidecar with today's kit is fail-closed: governed mutations never run. That is safe and also a dead mutation surface. Field-population details stay with 11-u2; the beep-effect invariant is: no `McpServerClient` ⇒ no `CurrentMcpCaller` ⇒ no run.

---

## 4. Option table (no decision)

How grants, hash chains, TTL, and audit would work; security; tests that change; doctrine. Options **A** and **B** are labeled as contradicting working assumption G4.

| # | Option | Grants / freeze | Hash chain | TTL | Audit | Security | Tests that change | Doctrine |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| **A** | **Keep a stateful protocol on the ontology sidecar** (`v2025_06_18` or later stateful). Other G9 servers may flip. **Contradicts G4.** | Unchanged: `mcp-session-id` remains server-minted. | Unchanged. | Unchanged; still per conversation; `initialize` still resets. | Unchanged. Actor URN still per-`clientId` unless also fixed. | Strongest continuity with today's threat model. Unknown session still 404. Split-brain: two protocol generations in-repo. | Ontology transport protocol list; harness/live-client session replay stay. Kit header tests stay. Driver servers out of this table. | SPEC decision 10 stands as written. G4's “every in-repo server” is the cost. |
| **B** | **Mixed protocol list** on the ontology sidecar: stateful + `v2026_07_28`. Effect allows at most one stateless adapter. **Contradicts G4.** | Stateful clients keep today's key. Stateless clients still have no session — they need a nested choice from C–J for *their* dispatches. | Two populations of runs. | Stateful: per session. Stateless: whatever nested option says. | Must not mix chains across protocols for one conversation. | Upstream-supported (`mcpRuntime.ts:193-209`). A 2026-07-28 client can skip `initialize` and never get a session id; the gate must not treat that as stdio `clientId` fallback on HTTP. | Transport `protocols` array; admission tests per protocol; session-keying HTTP test must pin which protocol the client spoke. | Decision 10 becomes “a run is an MCP session **when the client spoke a stateful revision**.” |
| **C** | **Server-minted signed run token** (beep-effect MAC in `_meta` or a response header), verified on later `tools/call`. Compatible with G4. | First authenticated dispatch (or first `tools/list`) mints the token; freeze keys on the verified token, not the client's raw string. | Continuity = client echoing a server-issued token. Lost token ⇒ new freeze (same as lost `mcp-session-id` today). | Permanence still requires never-evict keyed by the token. Clock-reset requires minting a new token (server-controlled). | Ledger `runKey` digests the token id (not the MAC secret). Actor URN should use the same id, not `clientId`. | Closest semantic replacement for `mcp-session-id`. Must not put the MAC key in client-visible `_meta` rest fields without verification. Need a minting event that is **not** `initialize`. | Kit identity type; `SanitizedSpan` read site; all session-keying tests; harness/live-client replay; CORS headers if a new header is used. New tests: forged token refuses; empty token on HTTP refuses or mints (operator choice). | Decision 10 substance (“a run is an MCP conversation”) kept; mechanism changes a second time (after PR 5). PLAN's “needs new mcp-kit surface” applies. |
| **D** | **Key on verified bearer principal** (the per-launch desktop token). Compatible with G4. | One freeze per sidecar launch. Concurrent conversations share grants and chain. | One process-wide chain. Concurrent dispatches already serialize on a global semaphore (`GovernedTierGate.gate.ts:244-247`). | 12h from first dispatch of that process; cannot reset without rotating the token / restarting. Stronger than today's per-`initialize` reset. | Ledger attributes the process, not the conversation. Actor URN should stop using `clientId`. | Server-verified. Coarse. A second agent on the same sidecar is the same principal (already true for origin+bearer admission). Does not help driver MCP servers that have no such token. | Session-keying tests that assert two HTTP posts with different `clientId` **and would today use two session ids** must be rewritten: they would *merge*. `"freezes distinct runs for distinct clients"` would fail if “clients” meant conversations. Egress still separate. | Decision 10 substance **changes**: a run is a sidecar launch, not an MCP session. Explicit SPEC amendment. |
| **E** | **Key on `McpRequestContext.clientId`** (or keep stdio fallback as the HTTP path). Compatible with G4. | Vacuous freeze on HTTP: one genesis row per `tools/call`. | Chains die. | TTL per call = no bound. | Each dispatch is its own run. | Server-minted but unstable. Already rejected by PR 5. | `"keys the run on the session, not on the per-request client id"` and the HTTP `seq [0, 1]` proof **fail**. | Contradicts SPEC decision 10 as corrected. |
| **F** | **Key on `clientInfo` or other client `_meta`.** Compatible with G4. | Agent-chosen freeze key. | Agent can fork or join chains by renaming itself. | Agent can reset TTL. | Attribution is a client-supplied name. | Forgeable. Breaks “grants derive only from session-static inputs… never from tool output” in spirit: the key is untrusted input. | Any uniqueness test becomes a client-cooperation test. | Contradicts GrantSet freeze soundness (`GrantSet.model.ts:13-16`). |
| **G** | **Key on MRTR `requestState`.** Compatible with G4. | Only after an `input_required` round-trip; ordinary first `tools/call` has none. | Continuation-shaped, not conversation-shaped. | N/A for first call. | Wrong object. | Client-echoed; no Effect MAC found. | No current test uses `requestState`. Would need a new MRTR fixture. | Wrong protocol primitive. |
| **H** | **Run = one `tools/call`.** Compatible with G4. | Freeze after poisoned content (vacuous). | One-row chains. | None. | Fine per call, useless for composition. | Explicitly rejected 2026-07-25. | All multi-dispatch chain tests fail. | Decision 10 rejected option. |
| **I** | **Explicit `ontology_open_run` tool.** Compatible with G4. | Agent must open a run; skip ⇒ fail-closed or ungoverned. | Clear lifecycle. | Can bind TTL to the run object. | Self-documenting. | Rejected 2026-07-25 because read-only tools would break if skip ⇒ deny, and ungoverned if skip ⇒ allow. Could be revisited if only *mutations* require a run (read-only already ungated). | New protocol tests; mutation-without-open refuses. | Decision 10 rejected option; narrower revisit is an operator question. |
| **J** | **Keep reading `mcp-session-id` under a G4 server, without Effect validation.** Compatible with G4 *protocol list*, not with Effect's session machine. | Client picks the string. New string ⇒ new freeze. Known string ⇒ join that run. | Client can splice themselves onto another conversation's chain if they learn the id. | Client can reset TTL at will. | Ledger keys a client-supplied id. | **Weaker than today.** Effect's 404-on-unknown is gone. | Header tests still pass (they already inject the header). HTTP session-keying proof still passes *if the test client keeps echoing a stable string* — that is no longer a server-minted proof. | Quietly inverts PR 5's “transport-assigned” claim. |

**Kit rewrite that every G4-compatible option except J still needs:** `sanitizedToolkit` must populate `CurrentMcpCaller` from `McpRequestContext` (or a beep-effect-minted token) because `McpServerClient` is legacy. That rewrite is 20-r1 / 11-u2 adjacent; this lane only notes that without it, options C–I never see a caller.

**Doctrine touch points for whichever option is chosen**

- SPEC decision 10 + PLAN PR 5 corrections (`goals/agent-execution-authority/`).
- GrantSet freeze soundness (`packages/epistemic/domain/src/values/GrantSet/GrantSet.model.ts:13-16`).
- Foundation-mediated inversion (`standards/architecture/DECISIONS.md:1137-1140`): identity stays a kit-shaped value; ontology/epistemic still must not import each other.
- `09-errors-across-boundaries.md`: do not leak a new differential refusal reason while swapping the key.
- `12-observability.md`: read the new anchor at the protocol boundary (`SanitizedSpan`), not inside handlers.
- CORS / `allowedHeaders` (`OntologyMcpTransport.ts:103-104`) — 24-r5 owns HTTP security; dropping `mcp-session-id` is a coordinated change.

---

## 5. Grill questions

Only the operator can answer these. Evidence above does not decide them.

1. **Is “a run is an MCP conversation” still the invariant once the protocol has no conversation?** Decision 10's substance vs its mechanism. If yes, beep-effect must mint the conversation id (option C). If no, what is a run (sidecar launch D, mutation-open I, per-call H)?
2. **Does G4 apply to the ontology sidecar, or only to driver MCP servers?** Options A/B exist specifically because G9 names the sidecar and G4 says every in-repo server. Mixed lists are an Effect feature, not a beep-effect invention (plan-review finding 28).
3. **Who is allowed to reset grant TTL?** Today: any client that can `initialize` (origin + bearer). Under G4+C: whoever can obtain a newly minted token. Under G4+D: only process restart / token rotation. Which threat model is intended?
4. **Must two concurrent conversations on one sidecar have isolated chains?** Today's session key says yes. Bearer-principal (D) says no. The gate's lock is already process-global because “the desktop surface has one interactive caller” (`GovernedTierGate.gate.ts:244-247`).
5. **Should `OntologyChangeActor` stop using `clientId`?** It already attributes per HTTP request, not per session. Any new run key should probably be the actor URN too — or the operator accepts provenance that does not match the ledger run.
6. **Is this the moment to give `GovernedEgress` a session seam?** Recorded gap since PR 6; closeout reflection asked for mcp-kit surface. Independent of G4, but a new identity object is the natural seam. Inventing the session from ambient state is still forbidden.
7. **Are driver MCP servers in G9 expected to grow GovernedTierGate, or is session identity a sidecar-only problem?** Inventory says they have none today. G4 still changes their protocol; it does not by itself create a grant-run.
8. **If option C, what is the minting event without `initialize`?** First `tools/call` (freeze and mint together), first authenticated HTTP request (including `tools/list`), or an explicit tool (I)?
9. **Fail-closed vs dead surface:** today's kit + G4 refuses every governed mutation (no `McpServerClient`). Is “mutations unavailable until identity is replaced” an acceptable ship gate, or must identity land in the same PR as the protocol flip?

---

## Appendix — citation index for sibling lanes

- **11-u2** owns: `McpRequestContext` population, `clientId` stability per transport, whether `McpServerClient` is provided on 2026-07-28, stdio connection-as-session.
- **20-r1** owns: `sanitizedToolkit` rewrite off `McpServerClient`.
- **21-r2** owns: in-repo client handshake (`.mcp.json`, harnesses, `live-mcp-client.ts`).
- **24-r5** owns: CORS `mcp-session-id` header allow/expose, Origin middleware.
- **G4 decision-challenges in this lane:** (1) `v2026_07_28`-only + current kit ⇒ fail-closed dead mutations; (2) `mcp-session-id` under G4 is no longer transport-assigned; (3) mixed list / sidecar-stateful-only are implementable Effect options the operator excluded.

## Gate B verdicts (2026-09-17)

Three grok refuters voted on 8 claims from this lane (7 survive, 1 killed; per-vote detail in `verification/22-r3-governance-identity.verdicts.jsonl`).

Struck claims (2 of 3 refuted):

- ~~`22-r3-governance-identity-19` (decision-challenge): McpServerClient is a legacy initialized-session service; McpServerClientMiddleware dies on protocol version 2026-07-28; sanitizedToolkit therefore yields CurrentMcpCaller None and GovernedTierGate fail-closed-refuses every mutation on a G4-only server.~~
  - Refuters: G4 ClientRequestRpcs has no McpServerClientMiddleware, so tools/call does not Effect.die at McpServer.ts:891. Handlers run with McpRequestContext only; kit serviceOption(McpServerClient) is None and the gate refuses. The cited die is not the G4 mutation path.
