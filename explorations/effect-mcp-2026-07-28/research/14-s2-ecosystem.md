# Lane 14-s2-ecosystem — Clients that reach in-repo servers, and conformance tooling

Research lane for exploration packet `effect-mcp-2026-07-28`. Evidence collected
2026-09-16. Absolute home paths are written as `$HOME/...`.

This lane owns **public** client and conformance evidence. In-repo client code
belongs to 21-r2; cited here only where a launcher’s first message decides
whether G4 (`McpProtocol.v2026_07_28` only) is implementable.

Working assumptions challenged: **G4** (2026-07-28 only on every in-repo
server) and **G6** (external agent binaries do not *gate* the flip; in-repo
launchers that those binaries start **are** in scope). The spec’s own
legacy×modern matrix, plus the three agent CLIs that load `repo:.mcp.json`,
make G4-on-stdio a decision, not a free pin.

Local binaries on this workstation (version strings only — not a handshake
proof; Gate A finding 25): Claude Code `2.1.273`, Codex CLI `0.154.0`, grok
CLI `1.0.34` (`3736acbc8658`).

---

## Shared spec and Effect facts this lane depends on

1. **Current revision is `2026-07-28`.** Every request carries
   `io.modelcontextprotocol/protocolVersion` in `_meta`; Streamable HTTP also
   requires `MCP-Protocol-Version`, `Mcp-Method`, and `Mcp-Name` for named
   methods. `server/discover` is a mandatory **server** RPC and an **optional**
   client probe.
   ([https://modelcontextprotocol.io/docs/2026-07-28/learn/versioning.md](https://modelcontextprotocol.io/docs/2026-07-28/learn/versioning.md),
   [https://modelcontextprotocol.io/specification/2026-07-28/basic/versioning](https://modelcontextprotocol.io/specification/2026-07-28/basic/versioning),
   [https://blog.modelcontextprotocol.io/posts/2026-07-28/](https://blog.modelcontextprotocol.io/posts/2026-07-28/))
2. **Spec compatibility matrix (load-bearing for G4).**
   | Client | Server | Outcome |
   | --- | --- | --- |
   | Legacy (`initialize`) | Modern-only | **Fails.** Stdio: server rejects `initialize`. HTTP: missing modern headers → `400`. Legacy clients have no fall-forward. |
   | Dual-era | Modern-only | Works if the client probes `server/discover` (stdio) or sends a modern request (HTTP) and treats `-32022` / `-32020` as modern, not as “fall back to initialize”. |
   | Dual-era | Dual-era | Works. Mixed lists are the specified interoperability path. |
   Source:
   [https://modelcontextprotocol.io/specification/2026-07-28/basic/versioning#backward-compatibility-with-initialization-based-versions](https://modelcontextprotocol.io/specification/2026-07-28/basic/versioning#backward-compatibility-with-initialization-based-versions).
3. **Stdio probe rule.** Dual-era clients SHOULD send `server/discover` first.
   `DiscoverResult` or a recognized modern error (`UnsupportedProtocolVersionError`
   `-32022`) means modern — **do not** then send `initialize`. Any other error
   or timeout means legacy.
   ([https://modelcontextprotocol.io/specification/2026-07-28/basic/transports/stdio#backward-compatibility](https://modelcontextprotocol.io/specification/2026-07-28/basic/transports/stdio#backward-compatibility))
4. **HTTP probe rule.** Attempt a modern POST first. On `400`, inspect the
   body: recognized modern JSON-RPC error → stay modern; empty / unrecognized
   → fall back to `initialize`.
   ([https://modelcontextprotocol.io/specification/2026-07-28/basic/transports/streamable-http#backward-compatibility](https://modelcontextprotocol.io/specification/2026-07-28/basic/transports/streamable-http#backward-compatibility))
5. **Effect `v2026_07_28`-only rejects `initialize`.**
   `selectStatefulProtocol` keeps only `runtime._tag === "Stateful"` adapters
   (`effect:packages/effect/src/unstable/ai/internal/mcpRuntime.ts:182-187`).
   With no stateful adapter, `prepareRequest` for `initialize` fails with
   `ProtocolError` code `-32022` and message
   `"initialize is not supported by the configured MCP protocols (requested '<offeredVersion>')"`
   **without** `data.supported`
   (`effect:packages/effect/src/unstable/ai/internal/mcpRuntime.ts:33`,
   `effect:packages/effect/src/unstable/ai/internal/mcpRuntime.ts:319-326`).
   The version-mismatch path on an already-stateless request **does** attach
   `data: { supported, requested }`
   (`effect:packages/effect/src/unstable/ai/internal/mcpRuntime.ts:341-346`).
   Stdio uses the same selector
   (`effect:packages/effect/src/unstable/ai/McpServer.ts:1484-1486`).
   Mixed lists are an upstream cap of “at most one stateless adapter”
   (`effect:packages/effect/src/unstable/ai/internal/mcpRuntime.ts:193-209`).
   A 2026 adapter **does** implement `server/discover`
   (`effect:packages/effect/src/unstable/ai/internal/mcpProtocol/v2026_07_28.ts:466-477`,
   `effect:packages/effect/src/unstable/ai/internal/mcpSchema/v2026_07_28.ts:378-382`).
6. **In-repo first messages (21-r2).** Every repo-owned harness sends
   `initialize` with `protocolVersion: "2025-06-18"`. The only `.mcp.json`
   in-repo server is nlp-mcp stdio (`repo:.mcp.json`). Those facts are 21-r2’s;
   this lane asks what the **agent binaries** that spawn that entry send.

---

## 1. Client matrix

Treat a version string as weak. Prefer release notes, source, or documented
behavior. “Against a 2026-07-28-only server” means a server that implements
only the modern era (Effect G4: `McpProtocol.v2026_07_28` alone).

| Client | Version where 2026-07-28 client support landed | Stdio first message (default) | HTTP first request (default) | Behavior against a 2026-07-28-only server | Citation |
| --- | --- | --- | --- | --- | --- |
| **Claude Code** | **v2.1.232** (v2 runtime = MCP TypeScript SDK 2.0). Documented on the MCP page as of 2026-09-15. Local binary: `2.1.273`. | **`initialize` (legacy).** Stdio is probed only if `MCP_PROTOCOL_NEGOTIATION=auto`. Unset = HTTP/connectors probed, stdio as v1. | **Probes whether the server supports 2026-07-28** (v2 runtime, Claude Code ≥ 2.1.232), then uses it with servers that do. Set `legacy` to skip every probe. | **Stdio (default, including `repo:.mcp.json` nlp-mcp): fail** — legacy `initialize` vs modern-only. **HTTP: succeed** if the v2 runtime is active and the probe is not skipped. **Caveat:** feature-flag fetch off (Bedrock / Agent Platform / Foundry / apps gateway / `DISABLE_TELEMETRY` / `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC`) uses the **v1 runtime** unless `MCP_SDK_GENERATION=v2` is set, and skips the probe unless `MCP_PROTOCOL_NEGOTIATION=auto`. | [https://code.claude.com/docs/en/mcp](https://code.claude.com/docs/en/mcp) “MCP client runtimes”; [https://code.claude.com/docs/en/env-vars](https://code.claude.com/docs/en/env-vars) `MCP_PROTOCOL_NEGOTIATION`, `MCP_SDK_GENERATION`, “Features that need feature-flag fetching”. Live handshake of this `2.1.273` binary: **UNVERIFIED** (Gate A 25). |
| **OpenAI Codex CLI** | **Shipped in `rust-v0.147.0` / CLI 0.147.0, published 2026-08-07**, PRs [#35724](https://github.com/openai/codex/pull/35724) (28 Jul 2026) and [#35725](https://github.com/openai/codex/commit/be6e8eac029b183056b7e4402879f15d2c85f61b). Still present in local `0.154.0`. | **`initialize` (legacy) unless opted in.** Stdio modern mode requires `CODEX_MCP_PROTOCOL_VERSION=2026-07-28`. Feature flag `features.mcp_2026_07_28` (boolean in `config.schema.json`) governs “eligible other servers”. | **Legacy lifecycle by default.** When `mcp_2026_07_28` is on: `server/discover` first, fallback “only when a response establishes that the endpoint is legacy-only”. Hosted `codex_apps` has a separate `codex_apps_mcp_2026_07_28` flag, also default-off. | **Stdio default: fail** (same as Claude Code). **Stdio with env pin: succeed** if the server answers `server/discover`. **HTTP default: fail** (legacy). **HTTP with feature flag: succeed** against a modern-only endpoint that answers discover; fallback to `initialize` would then fail, which is correct if the 400/`-32022` is recognized as modern. | [https://github.com/openai/codex/pull/35724](https://github.com/openai/codex/pull/35724); [https://github.com/openai/codex/releases/tag/rust-v0.147.0](https://github.com/openai/codex/releases/tag/rust-v0.147.0); [https://github.com/openai/codex/blob/main/codex-rs/core/config.schema.json](https://github.com/openai/codex/blob/main/codex-rs/core/config.schema.json) (`mcp_2026_07_28`); [https://github.com/openai/codex/tree/main/codex-rs/app-server](https://github.com/openai/codex/tree/main/codex-rs/app-server) (hosted Apps default Legacy). Live handshake of `0.154.0`: **UNVERIFIED**. |
| **xAI grok CLI (Grok Build)** | **Changelog 1.0.29 (2026-09-11):** “MCP server connections no longer fail against modern 2026-07-28 servers.” Local CLI `1.0.34` is after that. Public `grok mcp add` docs still do not name a revision. | **`initialize` only. No `server/discover` probe on stdio.** Source: probing stdio is unsafe (late discover vs `initialize` on the same byte stream; child cannot be rebuilt). **“Modern-only stdio servers stay unsupported until rmcp tolerates late responses to abandoned requests.”** Legacy `initialize` is pinned to `2025-11-25`, never `2026-07-28`. | **`server/discover` first** (`ClientLifecycleMode::Discover` with `V_2026_07_28`), then fall back to `initialize` (`2025-11-25`) on probe error or timeout. Connect-phase failures do **not** fall back. Short startup budgets skip the probe. | **Stdio (nlp-mcp `.mcp.json`): fail**, no documented env to opt stdio into 2026. **HTTP: succeed** if discover returns `2026-07-28` (this is the 1.0.29 fix). | Changelog: [https://github.com/xai-org/grok-build/blob/main/crates/codegen/xai-grok-shell/changelogs/1.0.29.md](https://github.com/xai-org/grok-build/blob/main/crates/codegen/xai-grok-shell/changelogs/1.0.29.md). Source: [https://github.com/xai-org/grok-build/blob/75810042ca2762aa0b0fa17864f3f68823ccbea5/crates/codegen/xai-grok-mcp/src/servers.rs](https://github.com/xai-org/grok-build/blob/75810042ca2762aa0b0fa17864f3f68823ccbea5/crates/codegen/xai-grok-mcp/src/servers.rs) L3801–L3815, L3905–L3980, L4079–L4080. Docs: [https://x.ai/docs/build/features/mcp-servers](https://x.ai/docs/build/features/mcp-servers). |
| **MCP Inspector** | **v2.0.0, released 2026-07-28** (`7aebf16`, 07:18 UTC) — first Inspector line on MCP TS SDK v2. Current npm: **2.7.0**. Node `>=22.19.0`. | **Default `protocolEra`: `legacy`** — plain `initialize`, no probe. Official reason: a debugger must not auto-probe (stalls silent stdio; pollutes the transcript). `auto` = `server/discover` then fall back. `modern` = pin `2026-07-28`, no fallback. | Same `protocolEra` switch (per-server, orthogonal to transport). | **Default (`legacy`): fail** against a 2026-only server. **`auto`: succeed** if Effect answers `server/discover`. **`modern`: succeed** on 2026-only; fail loudly on 2025-only. **Web client gotcha:** `Mcp-Param-*` mirroring is skipped in the browser SDK; CLI/TUI on Node mirror correctly. | [https://github.com/modelcontextprotocol/inspector/releases/tag/2.0.0](https://github.com/modelcontextprotocol/inspector/releases/tag/2.0.0); [https://modelcontextprotocol.io/docs/2026-07-28/tools/inspector/protocol-eras.md](https://modelcontextprotocol.io/docs/2026-07-28/tools/inspector/protocol-eras.md); [https://www.npmjs.com/package/@modelcontextprotocol/inspector](https://www.npmjs.com/package/@modelcontextprotocol/inspector) 2.7.0. |
| **Official TypeScript SDK (`@modelcontextprotocol/client` v2)** | **First beta `2.0.0-beta.1` (2026-06-30); stable `@modelcontextprotocol/client@2.0.0` tagged 2026-07-27**, listed on the spec blog the next day. v1.x remains `@modelcontextprotocol/sdk`. | **Default `versionNegotiation` is `legacy`: `initialize`, no probe.** `mode: 'auto'` probes `server/discover` (on stdio, via a **sibling process**, because some servers including rmcp exit on pre-initialize requests). `mode: { pin: '2026-07-28' }` never falls back. Docs **warn: do not default a spawn-per-invocation CLI to `'auto'`** (full probe timeout + extra process). | Same modes. Default client = `initialize` POST (no `Mcp-Method` / modern `_meta`). `auto` sends `server/discover` with `MCP-Protocol-Version: 2026-07-28`. Opaque CORS `TypeError` during the HTTP probe falls back to legacy (2025 allow-lists that omit 2026 headers). `401`/`403` are auth, never era. HTTP probe **timeout is an outage**, not legacy. | **Default client: fail** (legacy × modern-only). **`auto`: succeed** if Effect’s `server/discover` answers. **Pin: succeed** on 2026-only; fail on 2025-only with `ERA_NEGOTIATION_FAILED`. | [https://github.com/modelcontextprotocol/typescript-sdk/blob/main/docs/protocol-versions.md](https://github.com/modelcontextprotocol/typescript-sdk/blob/main/docs/protocol-versions.md); [https://github.com/modelcontextprotocol/typescript-sdk](https://github.com/modelcontextprotocol/typescript-sdk); [https://blog.modelcontextprotocol.io/posts/2026-07-28/](https://blog.modelcontextprotocol.io/posts/2026-07-28/). Zuplo’s Jul 31 row listing TS SDK 2.0.0 as `2025-11-25` matches the **default mode**, not capability. |
| **Official Python SDK (`mcp`)** | **First full client support `2.0.0b1` (2026-06-30, including stdio auto-mode); GA `mcp 2.0.0` on 2026-07-28.** Current PyPI **2.2.0** (2026-09-07). v1.x still published (`1.30.0`). `pip install mcp` installs 2.x. | **Default `mode="auto"`: first message is `server/discover` at the newest modern version**, then `initialize` if the probe is not positive modern evidence. `mode="legacy"` = `initialize` only. `mode="2026-07-28"` = **no probe, no handshake** (pin; `server_info` is `None` unless `prior_discover=`). | Same `mode=` table. Streamable HTTP. | **Default `auto`: succeed** against Effect 2026-only **if** `server/discover` returns a `DiscoverResult` whose `supportedVersions` includes a modern version (Effect’s 2026 adapter does implement discover). If discover fails with `-32022` whose `data.supported` is modern-only and disjoint, `auto` **raises** (real incompatibility). If discover fails with any other `MCPError`, it falls back to `initialize`, then Effect’s initialize rejection (`-32022` **without** `data.supported`) — Python then raises on the handshake error. **Pin `mode="2026-07-28"`: succeed** with no negotiation. **`legacy`: fail.** | [https://pypi.org/project/mcp/](https://pypi.org/project/mcp/) 2.0.0 / 2.2.0; [https://github.com/modelcontextprotocol/python-sdk/blob/main/docs/protocol-versions.md](https://github.com/modelcontextprotocol/python-sdk/blob/main/docs/protocol-versions.md); [https://github.com/modelcontextprotocol/python-sdk/blob/main/src/mcp/client/_probe.py](https://github.com/modelcontextprotocol/python-sdk/blob/main/src/mcp/client/_probe.py) (`negotiate_auto`, `-32022` denylist). |

**How to read the G4 column for beep-effect launchers**

- **nlp-mcp and the other stdio hosts** are started by Claude Code / Codex / grok from `.mcp.json` / `config.toml`. All three **default stdio to `initialize`**. Grok has **no stdio modern path at all**. G4-only on those hosts breaks default agent use.
- **Ontology `layerHttp` `/mcp`** is the HTTP host. Claude Code v2 (default on `2.1.232+` when flags fetch) and grok HTTP **will probe**. Codex HTTP needs `features.mcp_2026_07_28 = true`. CORS on that host still omits `mcp-method` / `mcp-name` (21-r2) — a browser client on 2026 fails preflight even if the handshake is right.
- **In-repo `RpcClient` harnesses** (21-r2) send `initialize` `2025-06-18` and do not set 2026 headers. G4-only fails those tests regardless of agent binaries.

---

## 2. Interoperability gotchas

### 2.1 Spec: legacy client × modern-only server cannot recover

The 2026-07-28 versioning page states this as a table cell, not a maybe:
legacy clients have no fall-forward; a modern-only server **SHOULD** name
supported versions on any `initialize` error so the human sees *something*.
([https://modelcontextprotocol.io/specification/2026-07-28/basic/versioning](https://modelcontextprotocol.io/specification/2026-07-28/basic/versioning))

**Decision-challenge to G4:** a `v2026_07_28`-only Effect server is exactly
the “Legacy × Modern” failure cell for every default-stdio agent in §1.

### 2.2 Dual-era is the specified server shape, not a beep invention

The spec’s dual-era **server** “selects its behavior from how the client
opens”: modern `_meta` → stateless; `initialize` → legacy session. Effect
already encodes that as a mixed protocol list with at most one stateless
adapter (`effect:packages/effect/src/unstable/ai/internal/mcpRuntime.ts:193-209`).
The official TS server entry `createMcpHandler` / `serveStdio` defaults to
serving **both** eras (`legacy: 'stateless'`), and `legacy: 'reject'` is the
G4 analogue
([https://github.com/modelcontextprotocol/typescript-sdk/blob/main/docs/protocol-versions.md](https://github.com/modelcontextprotocol/typescript-sdk/blob/main/docs/protocol-versions.md)).
Python `MCPServer` “answers `server/discover` on every transport” and still
accepts handshake-era clients unless the operator forces otherwise
([https://github.com/modelcontextprotocol/python-sdk/blob/main/docs/protocol-versions.md](https://github.com/modelcontextprotocol/python-sdk/blob/main/docs/protocol-versions.md)).

**Decision-challenge to G4:** pinning only `v2026_07_28` is the *reject*
setting the reference SDKs expose as a non-default. Mixed list is what they
ship.

### 2.3 Official clients disagree on the default handshake

| Implementation | Default first message | Why it matters |
| --- | --- | --- |
| Python SDK v2 `Client()` | `server/discover` (`mode="auto"`) | A 2026-only Effect server is reachable with no flags. |
| TypeScript SDK v2 `new Client()` | `initialize` (`mode: 'legacy'`) | Same package family as Claude Code’s v2 runtime, but Claude Code **overrides** HTTP toward auto and **keeps** stdio on legacy. |
| C# SDK 2.0 | `server/discover` then fallback (preview notes) | Opposite of TS default. |
| Go SDK | `Client.Connect` calls `server/discover` first, then `initialize` | [https://github.com/modelcontextprotocol/go-sdk/blob/main/docs/protocol.md](https://github.com/modelcontextprotocol/go-sdk/blob/main/docs/protocol.md) |
| Claude Code v2 stdio | `initialize` | nlp-mcp `.mcp.json` |
| Codex default | `initialize`; 2026 is a **feature flag** | Same |
| grok stdio | `initialize` **only**; comment says modern-only stdio is unsupported | Hard G4 blocker for grok-launched stdio hosts |

Zuplo’s compatibility matrix (cells verified **2026-07-31**) listed only
Inspector 2.0.0 and Python SDK 2.0.0 as reaching `2026-07-28`, and Claude
Code as “`initialize` era”
([https://zuplo.com/learn/mcp/compatibility](https://zuplo.com/learn/mcp/compatibility)).
That row is **stale** for Claude Code HTTP (docs now describe a v2 probe from
2.1.232, 2026-09-15) and **still accurate** for Claude Code **stdio default**.

### 2.4 Stdio `server/discover` is load-bearing and easy to get wrong

- TS SDK `auto` on **its** `StdioClientTransport` probes a **sibling process**
  because rmcp-family servers **exit** on a pre-`initialize` request. The
  caller’s child never sees `server/discover`. Subclasses probe in place.
  ([protocol-versions.md](https://github.com/modelcontextprotocol/typescript-sdk/blob/main/docs/protocol-versions.md)
  “Understand the probe”)
- grok **refuses** to probe stdio for the same rmcp reason: a slow server can
  answer the abandoned discover after `initialize` is already on the stream;
  rmcp then rejects the late response as uncorrelated
  ([servers.rs L3801–L3804](https://github.com/xai-org/grok-build/blob/75810042ca2762aa0b0fa17864f3f68823ccbea5/crates/codegen/xai-grok-mcp/src/servers.rs)).
- mcp-z CLI documents a 60s timeout before fallback when a legacy stdio
  server never answers an unknown pre-`initialize` request
  ([https://www.npmjs.com/package/@mcp-z/cli](https://www.npmjs.com/package/@mcp-z/cli)).
- TS SDK explicitly: “Do not default a spawn-per-invocation CLI tool to
  `'auto'`.”

A G4-only stdio Effect server that **does** implement `server/discover` is
still unreachable from grok, from Claude Code without `MCP_PROTOCOL_NEGOTIATION=auto`,
and from Codex without `CODEX_MCP_PROTOCOL_VERSION=2026-07-28`.

### 2.5 Effect’s `initialize` error disagrees with the official conformance suite

Spec versioning page: a modern-only server **SHOULD** name supported
versions on any `initialize` error; the exact JSON-RPC code is
**implementation-defined** (unknown method *and* missing `_meta`).

Official `server-stateless` scenario is stricter: removed RPCs including
`initialize`, `ping`, `logging/setLevel`, `resources/subscribe`,
`resources/unsubscribe` **MUST** yield **HTTP 404** and JSON-RPC
**`-32601` Method not found**
([https://github.com/modelcontextprotocol/conformance/blob/main/src/scenarios/server/stateless.ts](https://github.com/modelcontextprotocol/conformance/blob/main/src/scenarios/server/stateless.ts)
checks `sep-2575-http-server-method-not-found-404-initialize`).

Effect G4:

- **stdio `prepareRequest`:** `-32022` and
  `"initialize is not supported by the configured MCP protocols..."`,
  **no** `data.supported`
  (`effect:packages/effect/src/unstable/ai/internal/mcpRuntime.ts:322-326`).
- **HTTP:** an `initialize` JSON-RPC request with an `id` is classified as
  a *stateless* request; missing `MCP-Protocol-Version` then returns
  **HTTP 400** and `-32020` HeaderMismatch (21-r2 /
  `mcpRuntime.ts:218-230`) — not 404/`-32601`.
- The *other* `-32022` path (wrong `_meta` version on a request that
  already has modern metadata) **does** attach
  `data: { supported, requested }`
  (`effect:packages/effect/src/unstable/ai/internal/mcpRuntime.ts:341-346`).

**Decision-challenge:** a G4 Effect HTTP server will **fail**
`sep-2575-http-server-method-not-found-404-initialize` until initialize
is answered as 404/`-32601` (or the suite is waived). Dual-era mixed list
would answer `initialize` successfully and fail that same check for the
opposite reason (method found). Conformance `--requirements 2026-07-28`
is a **modern-only** referee, not a dual-era referee.

Python `negotiate_auto` treats `-32022` with a **modern-only** `supported`
list as a hard incompatibility, and treats `-32022` **without** parseable
`supported` as “try `initialize`, then raise”
([`_probe.py`](https://github.com/modelcontextprotocol/python-sdk/blob/main/src/mcp/client/_probe.py)).
So a client that never reaches `server/discover` (or whose discover probe is
classified as a generic RPC error) will not learn that `2026-07-28` is
available from that initialize error body.

C# SDK 2.0 preview notes the opposite discipline: `-32022` / `-32021` /
`-32020` are **never** treated as legacy indicators
([https://github.com/modelcontextprotocol/csharp-sdk/releases/tag/v2.0.0-preview.1](https://github.com/modelcontextprotocol/csharp-sdk/releases/tag/v2.0.0-preview.1)).

### 2.6 HTTP 400 is era-ambiguous unless the body is a modern error

Streamable HTTP dual-era clients MUST inspect a `400` body before falling
back. Effect on a stateless-only server classifies an `initialize` JSON-RPC
request **with an `id` as a stateless request**, then returns HTTP 400
`"MCP-Protocol-Version header is required"` with `-32020`
(21-r2 / `mcpRuntime.ts:218-230`). That **is** a recognized modern
`HeaderMismatch` code, so a spec-compliant dual-era HTTP client should
**stay modern** and not send `initialize`. A client that treats any 400 as
legacy will then send `initialize` and fail again.

Claude Code’s HTTP path “asks whether they support the newer revision”
(docs; exact probe method **UNVERIFIED** — likely `server/discover` via the
TS SDK, but this lane did not read Claude Code source).

### 2.7 CORS / headers for 2026 HTTP

2026 Streamable HTTP **requires** `Mcp-Method` and, for `tools/call` /
`resources/read` / `prompts/get`, `Mcp-Name`
([https://modelcontextprotocol.io/specification/2026-07-28/basic/transports/streamable-http](https://modelcontextprotocol.io/specification/2026-07-28/basic/transports/streamable-http)).
TS SDK notes that deployed 2025 servers commonly have CORS allow-lists that
predate those headers, so an opaque CORS `TypeError` during the probe falls
back to legacy. beep-effect ontology CORS currently allows
`mcp-protocol-version` and `mcp-session-id` but **not** `mcp-method` /
`mcp-name` (21-r2). A browser Inspector / TS client on 2026 would fail
preflight against `/mcp` even if G4 were otherwise correct.

### 2.8 Channels, GET SSE, and “v2 means 2026”

Claude Code v2: a channel server that negotiates 2026-07-28 **cannot**
deliver channel messages, so Claude Code **does not register it as a
channel**. Leaving `MCP_PROTOCOL_NEGOTIATION` unset keeps stdio on the
earlier handshake.
([https://code.claude.com/docs/en/mcp](https://code.claude.com/docs/en/mcp))

2026 Streamable HTTP removes the GET notification stream; servers **SHOULD**
answer GET/DELETE with `405`. Effect `layerHttp` does that (11-u2). Clients
that still open GET SSE against a 2026-only server fail at the opening GET.

### 2.9 Community reports (including X)

- **Hard-cut servers + leftover `initialize` clients.**
  [@does_it_code](https://x.com/does_it_code/status/2100123798158655570)
  (2026-09-16) on Laravel MCP 1.0: “Clients still on the old initialize
  handshake get `-32601`; protocol 2026-07-28 expects `server/discover` and
  per-request protocol metadata. Upgrade the client before the server.”
  Effect’s G4 error is `-32022` rather than `-32601`, but the operational
  advice is the same.
- **Laravel MCP 1.0** (2026-09-15/16) advertises 2026-07-28, searchable
  catalogs, cache hints, OAuth CIMD/PKCE
  ([https://laravel-news.com/laravel-mcp-1-0](https://laravel-news.com/laravel-mcp-1-0);
  [@laravelnews](https://x.com/laravelnews/status/2099868483907457383)).
- **Codex stdio 2026 was a filed gap** before the opt-in landed:
  [openai/codex#33952](https://github.com/openai/codex/issues/33952)
  (18 Jul 2026) asked for 2026-only stdio without `initialize`; the 28 Jul
  PR answered with **opt-in**, not default.
- **Inspector pin vs auto**
  ([inspector#1700](https://github.com/modelcontextprotocol/inspector/issues/1700)):
  `versionNegotiation: { mode: { pin: '2026-07-28' } }` throws against a
  legacy test server; `auto` falls back.
- **Inspector `tools/call` omitted `Mcp-Param-*` (SEP-2243)**
  ([inspector#1846](https://github.com/modelcontextprotocol/inspector/issues/1846),
  28 Jul 2026, closed by PR #1847, milestone v2.1.0): GitHub MCP rejected
  with `-32020` `HeaderMismatch` (`missing Mcp-Param-owner`). The
  **web** client still skips mirroring in-browser (protocol-eras docs,
  2026-09-16); CLI/TUI on Node are the strict-server path. Current npm
  2.7.0 is after v2.1.0, so CLI/TUI should include the fix — **UNVERIFIED**
  against a live 2.7.0 process.
- **Windows Codex + Python stdio handshake**
  ([openai/codex#29247](https://github.com/openai/codex/issues/29247), Jun 2026):
  `initialize` response never arrives on Windows pipes — a **2025-era**
  transport bug, still relevant because default Codex stdio is still
  `initialize`.
- **mcp-z `auto` on silent stdio** costs the full 60s request timeout
  ([https://www.npmjs.com/package/@mcp-z/cli](https://www.npmjs.com/package/@mcp-z/cli)).

No X thread found that names beep-effect, Effect `McpServer`, or
`v2026_07_28` specifically. UNVERIFIED: whether Claude Code `2.1.273` on
this machine actually sends `initialize` to nlp-mcp (would require a live
stdio capture).

### 2.10 Official SDK defaults vs “the spec is stateless”

The spec blog presents 2026-07-28 as the current protocol with no handshake.
The **TypeScript** client default is still the 2025 handshake, with an
explicit warning not to flip CLIs to `auto`. The **Python** client default
*is* `auto`. Agent CLIs that wrap rmcp (Codex, grok) kept stdio on
`initialize` because of the late-response / extra-process hazards in §2.4.
“The spec is stateless” is not the same claim as “the clients you launch
`.mcp.json` with will speak it.”

---

## 3. Conformance tooling that could prove a beep-effect server

### 3.1 Official suite: `@modelcontextprotocol/conformance`

Repo: [https://github.com/modelcontextprotocol/conformance](https://github.com/modelcontextprotocol/conformance)
(README fetched 2026-09-16). npm: `npx @modelcontextprotocol/conformance`.

**Tag that freezes 2026-07-28:** `--requirements` and the handshake-less
revision landed in the **`0.2.0-alpha.x` line** (anchor
`@modelcontextprotocol/conformance@0.2.0-alpha.10`, 2026-07-27, per
`requirements/2026-07-28.yaml`). Stable **`0.1.16` only speaks through
`2025-11-25`**. The README still shows GitHub Action
`modelcontextprotocol/conformance@v0.1.11` — **UNVERIFIED** whether that
Action tag accepts `--requirements 2026-07-28`. Prefer the npx CLI from
the 0.2.0-alpha line for a G4 proof.

**What it checks.** Scenario runners plus JSON-Schema wire checks
(`wire-schema-valid` for the implementation under test,
`wire-schema-harness-error` for harness bugs). Dated revisions through
`2025-11-25` use the **stateful** lifecycle; `2026-07-28` uses the
**stateless** lifecycle (per-request `_meta`). A scenario that belongs to
both revisions must be run **twice**. `--requirements 2026-07-28` freezes
the scenario set that revision actually required at release (later-added
scenarios are `not_scored`).

**How to run it against a beep-effect HTTP host (ontology `/mcp`):**

```sh
# list what 2026-07-28 actually requires
npx @modelcontextprotocol/conformance list --requirements 2026-07-28

# server role, frozen 2026-07-28 requirement set
npx @modelcontextprotocol/conformance server \
  --url http://professional-desktop.beep.localhost:1355/mcp \
  --requirements 2026-07-28
```

Default without `--requirements` is “everything today”, which is not a
revision claim. `--suite active` excludes pending/draft. `--expected-failures`
YAML baselines known gaps without hiding new ones (per-check
`<scenario>:<check-id>` is supported; `server-stateless` alone is “over
twenty” checks).

**HTTP-only for the server command.** The documented server invocation is
`--url`. There is **no documented `--stdio` / `--command` server mode** in
the README. Stdio beep-effect hosts (nlp-mcp, m365, uspto, gov-legal,
practice-kg) cannot be scored by `conformance server` unless they are also
mounted on Streamable HTTP (or a tiny HTTP shim). Client testing uses
`--command` and appends a server URL — that tests a **client**, not nlp-mcp.

**Tier check (SDK-shaped, HTTP):**

```sh
npx @modelcontextprotocol/conformance tier-check \
  --repo <unused-for-beep> \
  --conformance-server-url http://127.0.0.1:<port>/mcp \
  --requirements 2025-11-25,2026-07-28
```

SEP-1730 tiering is for **SDKs**. Using it as a beep-effect host gate is
optional; `--requirements 2026-07-28` on `server` is the revision contract.

**Auth / Origin.** Ontology `/mcp` requires Origin allowlist + RPC session
token (21-r2). The vanilla `conformance server --url` will 403 unless the
harness is pointed at a test mount with those checks relaxed or cookies
injected. That is a **run-shape** problem, not a suite gap: expect to need
a dedicated conformance listener (loopback, no Origin, no session token)
or `--expected-failures` for the auth scenarios.

**What `server-stateless` actually asserts on 2026-07-28** (from
[stateless.ts](https://github.com/modelcontextprotocol/conformance/blob/main/src/scenarios/server/stateless.ts)):
`server/discover` MUST exist (`supportedVersions` + `capabilities`);
missing required `_meta` → `-32602` + HTTP 400; unsupported version →
`-32022` with `data.supported` **and** `data.requested` + HTTP 400;
header/body protocol-version mismatch → `-32020` + HTTP 400; removed
methods including **`initialize`** → **HTTP 404 + `-32601`**. Several
checks need diagnostic tools (`test_missing_capability`,
`test_streaming_elicitation`, `test_logging_tool`) that beep-effect
hosts do not register — those checks report `notTestable` rather than
pass. SEP-2243 `http-header-validation` is `not_scored`/`pending` in the
2026 freeze.

A G4 Effect HTTP host will therefore: pass discover if the 2026 adapter
is on; **fail the initialize-removed check** until the wire matches
404/`-32601` (today: 400/`-32020` or stdio `-32022`); skip/fail
diagnostic-tool checks.

### 3.2 Community HTTP probes (not a requirement freeze)

- **`mcp-spec-check`**
  ([https://github.com/Roee-Tsur/mcp-spec-check](https://github.com/Roee-Tsur/mcp-spec-check)):
  `npx mcp-spec-check <url>`. Black-box HTTP. Verdict YES/NO from three
  required checks only: `discover`, `routing-headers`,
  `session-independence`. Warn-only: error codes, cache metadata, MRTR,
  deprecated features, RFC 9728. **No stdio.** Useful as a 30-second
  ontology `/mcp` smoke after CORS/auth are opened for the probe; not a
  substitute for `--requirements 2026-07-28`.
- **`mcp-tester`** (PMCP / `cargo install mcp-tester`): documented
  default is **2025-11-25**; `--dual-run` adds a 2026-07-28 pass and
  diffs eras. Transports include stdio. Exit code follows the v1 suite
  unless `--fail-on-era-findings`. Not a frozen requirement YAML.
- **Not 2026:** `@yawlabs/mcp-compliance` (pinned 2025-11-25,
  initialize handshake); StudioMeyer `mcp-protocol-conformance`
  (explicitly omits 2026-07-28 RC).

### 3.3 Codex’s wrapper of the same suite (client, not beep server)

[https://github.com/openai/codex/tree/main/scripts/mcp_conformance](https://github.com/openai/codex/tree/main/scripts/mcp_conformance)
pins `modelcontextprotocol/conformance@49103de6ed70804e940637bf3e9e29e4a3f54e64`
and runs it **against the Codex executable** (legacy + `2025-11-25` +
`2026-07-28`, HTTP and stdio). That proves Codex-as-client, not
beep-effect-as-server. Useful as a recipe for “how an agent pins the
upstream CLI”, not as a G4 proof.

### 3.4 Inspector as a manual / CI smoke, not a requirement set

```sh
npx @modelcontextprotocol/inspector --cli --protocol-era modern -- <stdio command>
npx @modelcontextprotocol/inspector --cli --protocol-era auto  -- <stdio command>
```

(`--protocol-era` is the TUI/CLI flag; exact CLI spelling should be
re-read from Inspector 2.7.0 `--help` before a gate — **UNVERIFIED** that
the long option is exactly `--protocol-era` on 2.7.0, though source
comments name it.)

`modern` is a **pin**: it will fail a mixed or 2025-only server. `auto`
proves dual-era. For G4, `modern` is the canary; for mixed-list, run both.
Inspector is not the frozen 2026-07-28 requirement YAML.

Python `uv run mcp dev server.py` is Inspector-backed and does not replace
`conformance server`.

### 3.5 Effect’s own tests (11-u2) vs this suite

Effect TestUtils / `McpProtocol.test.ts` / `McpSchema.test.ts` are 11-u2.
This lane did **not** find a named Effect test for the exact string
`"initialize is not supported by the configured MCP protocols"` under
`packages/effect/test/` (21-r2 already noted NOT FOUND). The official
conformance suite is the only frozen, revision-scoped **external** proof
identified here.

### 3.6 What a beep-effect G4 proof would actually run

Minimum that would **fail today** if G4 flipped stdio hosts and the
operator launched them from default Claude Code / Codex / grok:

1. Official `conformance server --requirements 2026-07-28` against an HTTP
   mount of each host (ontology already HTTP; stdio hosts need a shim or
   `layerHttp` twin).
2. Inspector `--protocol-era modern` against each stdio bin (positive
   2026 pin).
3. Inspector `--protocol-era legacy` against the same bin (must **fail**
   under G4; must **pass** under mixed list). That single negative test is
   the G4 decision distilled.
4. A live stdio capture of Claude Code `2.1.273`, Codex `0.154.0`, grok
   `1.0.34` against nlp-mcp (Gate A 25) — **not done in this lane**.

---

## 4. UNVERIFIED items

- Live stdio/HTTP first-message capture of Claude Code `2.1.273`, Codex
  `0.154.0`, grok `1.0.34` against a 2026-only Effect server (Gate A
  finding 25). All §1 “fail/succeed” cells for those three are
  **documented behavior**, not a packet capture.
- Exact JSON-RPC method Claude Code uses for the HTTP “asks whether they
  support the newer revision” probe (docs do not name `server/discover`;
  TS SDK v2 `auto` would).
- Whether Claude Code v2 stdio with `MCP_PROTOCOL_NEGOTIATION=auto` uses
  the TS SDK sibling-process probe or probes the live child (source not
  read).
- Whether Codex `features.mcp_2026_07_28` alone is enough for HTTP, or
  whether `CODEX_MCP_PROTOCOL_VERSION` is also required; PR text ties the
  env var to **stdio**.
- Whether grok CLI `1.0.34` (`3736acbc8658`) contains the
  `75810042` handshake code. Source cited is grok-build `75810042`
  (2026-09-08); the npm package is `1.0.34` (2026-09-16). Match is
  plausible, not proven.
- Python SDK 2.2.0 vs 2.0.0 probe semantics — `_probe.py` was read from
  `main` (2026-09-16), not from the `v2.0.0` tag.
- Inspector 2.7.0 CLI flag spelling and default `protocolEra` in the
  published tarball (TUI source says default `legacy`; npm README does not
  restated the default).
- Official conformance **stdio server** invocation — README documents
  `--url` only. Whether a hidden stdio server mode exists: NOT FOUND.
- Effect initialize-rejection **named test** in `packages/effect/test/`:
  NOT FOUND (string search). Implementation is cited.
- Whether Effect’s `-32022` initialize error is serialized on the wire
  **without** `data` (class field is optional; encode path not traced
  beyond construction).
- Cursor-agent / other G6-out-of-scope binaries: not researched (G6).
- Zuplo matrix rows for Codex (“Not published”) and TS SDK 2.0.0
  (`2025-11-25`): treated as **Jul 31 snapshot**, contradicted for Claude
  Code HTTP by Sep 15 docs.
- Community conformance besides the official repo and Codex’s wrapper:
  mcp-z is a cluster CLI with `--protocol`, not a requirement set.

---

## Options (no decision)

1. **Keep G4 (`v2026_07_28` only).** Spec-legal modern-only server. Breaks
   default stdio of Claude Code, Codex, and grok against every G9 stdio
   host. Grok has no stdio opt-in. Operators would have to set
   `MCP_PROTOCOL_NEGOTIATION=auto` (Claude),
   `CODEX_MCP_PROTOCOL_VERSION=2026-07-28` plus `features.mcp_2026_07_28`
   (Codex), and **stop using grok for those servers** until rmcp stdio
   probe is safe. In-repo harnesses (21-r2) must be rewritten onto
   `server/discover` + 2026 headers. Conformance `--requirements 2026-07-28`
   becomes the HTTP proof; Inspector `modern` is the stdio canary.
2. **Relax G4 to a mixed list (`v2025_06_18` + `v2026_07_28`).** Matches
   Effect’s upstream “at most one stateless adapter”, the spec dual-era
   server, and TS/Python server defaults. Default agent stdio keeps
   working. Dual-era clients (Python `auto`, Claude HTTP, grok HTTP,
   Inspector `auto`) get 2026. Labelled **G4-contradicting**.
3. **Stage:** mixed list in the snapshot PR; G4-only later, gated on
   (a) grok stdio modern support, (b) Claude Code stdio default or a
   repo-owned `.mcp.json`/docs note, (c) Codex feature flag on by
   default or documented in the packet, (d) 21-r2 harness rewrite, (e)
   Gate A 25 live capture.
4. **G4 on HTTP only (ontology), mixed on stdio hosts.** Splits G9.
   Ontology still needs CORS `mcp-method`/`mcp-name` (21-r2) and a
   stable client identity story (22-r3).

## Gate B verdicts (2026-09-17)

Three grok refuters voted on 26 claims from this lane (22 survive, 4 killed; per-vote detail in `verification/14-s2-ecosystem.verdicts.jsonl`).

Struck claims (2 of 3 refuted):

- ~~`14-s2-ecosystem-04` (semantic): Dual-era HTTP clients MUST attempt a modern POST first. On 400 they inspect the body: a recognized modern JSON-RPC error means stay modern; empty or unrecognized means fall back to initialize.~~
  - Refuters: Overstated RFC 2119: Streamable HTTP says a dual-era client MAY detect era by attempting a modern request first, and on 400 SHOULD inspect the body. The claim’s MUST attempt a modern POST first is not what the spec requires.
- ~~`14-s2-ecosystem-14` (semantic): Python negotiate_auto treats -32022 with a modern-only supported list as a hard incompatibility (raises). -32022 without parseable supported is try initialize, then raise. Any other MCPError on discover falls back to initialize. A client that never reaches server/discover, or whose discover probe is classified as a generic RPC error, will not learn that 2026-07-28 is available from an initialize error body that lacks data.supported.~~
  - Refuters: _probe.py: -32022 with a modern-only supported list raises; any other MCPError on discover falls back to initialize. -32022 without parseable supported tries initialize and only raises if that handshake also fails — initialize can succeed. The last sentence (no learning 2026 from an initialize error lacking data.supported) is otherwise right.
- ~~`14-s2-ecosystem-26` (breaking): Community hard-cut pattern: Laravel MCP 1.0 (2026-09-15/16) advertises 2026-07-28; leftover initialize clients get -32601 and must upgrade the client before the server (X @does_it_code, 2026-09-16). Effect G4 initialize error is -32022 rather than -32601, but the operational advice is the same.~~
  - Refuters: Laravel News 1.0: leftover initialize clients still work (2025-11-25 / 2025-06-18). @does_it_code later corrected that the hard-cut/-32601 take was wrong; Laravel maintainer confirmed backward compatibility. Not a hard-cut pattern, and Effect G4 HTTP initialize is -32020 not -32601.
- ~~`14-s2-ecosystem-36` (decision-challenge): The spec blog presents 2026-07-28 as the current protocol with no handshake. The TypeScript client default is still the 2025 handshake, with an explicit warning not to flip CLIs to auto. The Python client default is auto. Agent CLIs that wrap rmcp (Codex, grok) kept stdio on initialize because of the late-response / extra-process hazards. The spec is stateless is not the same claim as the clients that launch .mcp.json will speak it.~~
  - Refuters: Blog/TS/Python defaults are correct, and grok stdio is initialize because of rmcp late-response. Codex default stdio initialize is documented as opt-in, not as a late-response or extra-process hazard (extra-process is the TS SDK sibling probe). Causal claim overreaches for Codex.
