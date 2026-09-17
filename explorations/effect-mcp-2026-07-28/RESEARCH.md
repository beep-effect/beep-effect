# Effect MCP 2026-07-28 Stateless Protocol Adoption — Research

Synthesis of the ten research lanes and the orchestrator spike, written from the claims that
survived Gate B (`research/verification/README.md`: 184 voted claims, 175 survive, 9 struck) and
revised against the three Gate C reviews (`reviews/gate-c-*.md`, 30 findings, all dispositioned).
Every section names the lane that owns the evidence; `file:line` citations live in the lane
reports, which are the source of truth. Working assumptions G1–G9 (`DECISIONS.md`) framed the
research; where the evidence argues against one, the section says so and the align grill decides.

Sources were frozen on 2026-09-16: Effect clone at `a7a71921de` (diff base tag
`effect@4.0.0-rc.115`, 32 commits), MCP specification pages dated `2026-07-28`, and the repo at
`ca7362278c`. Dates below are the dates the facts were read.

## 1. External landscape (2026-09-16)

### 1.1 What the specification changed (lane 13-s1)

- `2026-07-28` is the stateless revision: no `initialize` handshake, no `Mcp-Session-Id`,
  `server/discover` as the capability probe, protocol version and client capabilities carried in
  each request (`MCP-Protocol-Version` header plus `_meta` on HTTP; `_meta` on stdio). SEPs 2567
  (sessionless) and 2575 (stateless) are the design record; the published pages, not the SEP
  bodies, are normative (for example `clientInfo` became SHOULD in PR #3002 and
  `DiscoverResult.serverInfo` was removed).
- New patterns: multi-round-trip tool results (MRTR, SEP 2322: `InputRequired` results resumed
  with `inputResponses`), `subscriptions/listen`, tasks (SEP 1686/2663), TTL on list results
  (SEP 2549), input-validation errors as tool execution errors (SEP 1303).
- Streamable HTTP without sessions: `Mcp-Method` and `Mcp-Name` routing headers, JSON or SSE
  response bodies, GET and DELETE answered 405 by a modern-only server, leftover `Mcp-Session-Id`
  and `Last-Event-ID` ignored. A server MUST validate `Origin` and answer 403 when it is present
  and invalid; localhost binding and authentication are SHOULD.
- Dual-era servers are permitted (MAY), not required. A `2026-07-28`-only server is a hard cut
  for legacy clients: there is no fall-forward from `initialize`. A dual-era client MAY try a
  modern request first and SHOULD inspect a 400 body; a recognised modern error (including
  `UnsupportedProtocolVersionError`) must not trigger `initialize` fallback.
- Deprecations carry a twelve-month floor: roots, sampling, logging, OAuth dynamic client
  registration cannot be removed before the first revision on or after 2027-07-28.
- Application duties the spec assigns and a protocol library leaves to the server: `requestState`
  integrity (it is attacker-controlled), token audience validation (RFC 8707), handle-is-not-auth,
  tool rate limits (no algorithm or error code defined), JSON Schema network `$ref` policy.

### 1.2 Client and tooling reality (lane 14-s2)

- Default stdio behaviour of Claude Code 2.1.273, Codex 0.154.0, and grok 1.0.34 is
  `initialize`. Claude Code opts into modern negotiation with `MCP_PROTOCOL_NEGOTIATION=auto`;
  Codex with `CODEX_MCP_PROTOCOL_VERSION=2026-07-28` plus the `features.mcp_2026_07_28` flag;
  grok has no stdio modern opt-in because of an rmcp late-response hazard. These are documented
  behaviours; a live first-message capture (Gate A finding 25) is still UNVERIFIED.
- The official TypeScript and Python SDK servers ship dual-era by default; their `legacy:
  "reject"` setting is the analogue of G4. The Python client's `negotiate_auto` raises on
  `-32022` only when the error carries a parseable modern-only `supported` list, otherwise it
  falls through to `initialize`.
- Conformance tooling: `modelcontextprotocol/conformance --requirements 2026-07-28` is a
  modern-only referee that expects `initialize` to be HTTP 404 / `-32601`; Effect at the snapshot
  answers HTTP 400 / `-32020` and stdio `-32022`, so the suite fails that check as written, and
  it cannot score stdio hosts without an HTTP shim. Inspector 2.0 has a `--protocol-era` switch
  and still skips `Mcp-Param-*` mirroring in its web build.
- Browser clients (Inspector, TS SDK v2) fail CORS preflight against any host whose allow-list
  omits `mcp-method` and `mcp-name`.
- Struck in verification: the "Laravel MCP 1.0 hard cut" precedent (1.0 still accepts
  `initialize`) and the claim that dual-era clients MUST POST modern first (it is MAY).

## 2. The Effect adapter at `a7a71921de` (2026-09-16)

### 2.1 Public API delta from rc.115 (lane 10-u1)

- Handler requirements moved from `McpServerClient` to `McpSchema.McpRequestContext`;
  `registerToolkit` / `toolkit` / `registerResource` / `registerPrompt` now `Exclude`
  `McpRequestContext`. `McpServerClient` is stateful-only and its `protocolVersion` narrowed to
  `StatefulProtocolVersion`, which excludes `"2026-07-28"`. `McpServer.elicit` still requires
  `McpServerClient`, so reverse elicitation is unavailable on a 2026-only server.
- New server options `instructions`, `websiteUrl`, `icons`; prompt titles; `Tool.Strict` on MCP
  means excess-property rejection only when literally `true` (a strict `Tool.dynamic` with raw
  JSON Schema dies); declared failures come back as `isError: true` with `structuredContent`
  omitted; `structuredContent` may be any JSON value; every wire tool gets an `outputSchema`.
- Removed without alias: `AnyProtocolAdapter.transport` (now `runtime.transport`),
  `ToolJsonSchema`, the elicitation `*Schema` names. The repo has no references to any of them.
- Type-level: the whole family (16 catalog entries) must move together; the migration YAML and
  changesets agree with the code except for two stale sentences (parameter validation "always
  `InvalidParams`", `structuredContent` "always an object") noted in 2.3.

### 2.2 Stateless runtime semantics (lane 11-u2)

- Protocol selection: HTTP requires `MCP-Protocol-Version`, `_meta` protocol version and client
  capabilities, `Mcp-Method` matching the JSON-RPC method, and `Mcp-Name` on `tools/call`.
  `selectStatefulProtocol` considers only stateful adapters, so a list of only
  `v2026_07_28` rejects `initialize`: HTTP 404 / `-32601` with 2026 headers, HTTP 400 /
  `-32020` (header mismatch) on a bare legacy `initialize`, and stdio `-32022` with no
  `data.supported` list (the wrong-version path does attach one). Mixed lists (at most one stateless adapter) are a
  supported runtime feature and keep `initialize` alive through the first stateful adapter: an
  `initialize` that offers `protocolVersion: "2026-07-28"` on a mixed server still returns 200,
  mints `Mcp-Session-Id`, and negotiates the newest *stateful* revision (`ProtocolAdapters.test.ts`
  around line 704). A mixed list therefore never delivers 2026 semantics to an `initialize`
  client; 2026 is reached only by a client that skips `initialize` and sends `server/discover`
  with the headers and `_meta`.
- Identity: HTTP `clientId` is minted per POST and is not stable; no `Mcp-Session-Id` is minted;
  no `McpRequestContext` field is server-minted and stable across HTTP requests. Stdio is
  process-scoped (`client:0`). `requestState` and `inputResponses` are client-supplied.
- Cancellation: HTTP `notifications/cancelled` is acknowledged 202 but does not interrupt another
  POST's in-flight 2026 tool call; interruption is proven on stdio only. This is an Effect gap,
  not a wiring choice, and is recorded as an accepted gap for the HTTP sidecar rather than as
  optional work.
- Gone on 2026: `ping`, `logging/setLevel`, `resources/subscribe`, JSON-RPC batches (404 / 400);
  completions and logging capabilities are still advertised as empty objects, and `server/discover`
  advertises `resources.subscribe` when resources are registered even though
  `resources/subscribe` is absent from the 2026 request set. `resources/read` may return
  `InputRequiredResult` by schema but the handler never does.
- HTTP responses become SSE whenever the request is a subscription, the body is a stream, or the
  buffered body holds more than one message (commit `a2c4154cf8`, #7265). Default
  `allowedOrigins` is empty, so any `Origin` header is 403 unless the host passes an allow-list.
- Conformance evidence: `v2026_07_28.test.ts` is a 2026-only suite (`initialize` 404, stdio
  `server/discover`); `ProtocolAdapters.test.ts` and the MRTR tests cover `InputRequired` and
  `subscriptions/listen`.

### 2.3 Effect guidance and documentation gaps (lane 12-u3; feeds G8)

- `effect:packages/effect/MCP.md` (last typechecked 2026-09-07) still pins `v2025_06_18`, lists three
  protocols, teaches `initialize` and `McpServer.elicit`; nothing from #7265 or #8228 landed in it.
  `McpServer.ts`, `McpSchema.ts`, `McpProtocol.ts` carry no JSDoc `**Example**` blocks; the test
  suite is the executable documentation.
- Contradictions to fix in a docs PR: the migration note's "parameter validation is always
  `InvalidParams`" and the changeset's "`structuredContent` is always a JSON object" are both
  false for 2026-07-28; resource `title` exists on `McpSchema.Resource` but not on the
  `McpServer.resource` option type.
- A fork docs PR must choose its hello-world pin (2026-only, mixed, or keep June with a 2026
  section); the choice tracks the G4 outcome.

## 3. In-repo inventory (2026-09-16, repo at `ca7362278c`)

### 3.1 `@beep/mcp-kit` (lane 20-r1)

- `sanitizedToolkit` / `registerSanitizedToolkit` is a fork of rc.115 `registerToolkit`, kept
  because `Toolkit.handle` annotates raw parameters onto spans and upstream still has no
  dispatch-wrap seam. At the snapshot it has drifted: it excludes `McpServerClient` instead of
  `McpRequestContext`, never sets `outputSchema`, ignores `Tool.Strict` decode options, keeps
  `structuredContent` on failure, maps `api_key_required` to `isError: false`, returns invalid
  arguments as a canned `CallToolResult` rather than `InvalidParams`, uses
  `Stream.run(Sink.last())` where upstream uses `Stream.runLast`, and does not mirror
  `omitRequestServices`.
- Identity: the kit builds `McpCallerIdentity` only when `Effect.serviceOption(McpServerClient)`
  is `Some`, copying `mcp-session-id` from the request. On the 2026-07-28 path
  `invocationFromRequestContext` never provides `McpServerClient`, so no identity is built and
  `CurrentMcpCaller` is `None` on every real dispatch. The refuters confirmed this is a refusal
  path, not a defect: the stateful middleware that would die on `2026-07-28` is never installed
  by the 2026 `ClientRequestRpcs`. The kit never reads `McpRequestContext.clientId`; note that `clientId` is a per-POST transport
  fact and is already forbidden as the gate's run key (`GovernedTierGate.gate.ts` around line 188).
- Tests: every fixture is `McpServerClient.of({ protocolVersion: "2025-06-18" })` with
  `getClient: Effect.die(...)`; `server.callTool` cannot represent a 2026 client, so the
  production path has no kit proof. `SanitizedSpan.ts` is the coverage ratchet's hottest file.
- Kit-only value that upstream still lacks: `TierGate` enforcement on `tools/call` with audit
  and outcome settlement, `SourceAuth` credential-gated composition, `FieldTier` projection,
  `annotateFourHints` presets, and the sanitized-span wrapper itself. Redundant at the snapshot:
  `instructions`, strict validation, failure classification, output schemas, Origin checks.
- README still pins protocol `2025-06-18`; `TierGate` comments cite a removed `filterByClient`.

### 3.2 Hosts (lane 21-r2)

Every host pins only `McpProtocol.v2025_06_18`; none registers prompts, resources, or uses any
reverse-client call; every tool uses `failureMode: "return"`; success schemas are object classes
except `uspto_search_applications` (`S.Array`).

| Host | Transport | Tools | Auth | Wire tests |
| --- | --- | --- | --- | --- |
| `@beep/nlp-mcp` | stdio (the only `.mcp.json` in-repo entry) | 42 (25 + 17 streaming) | none | none on stdio |
| `@beep/m365-mcp` | stdio | 11 | driver credentials | stdio NDJSON test |
| `@beep/uspto-mcp` | stdio | 2 | soft `USPTO_API_KEY` via kit `SourceAuth` | in-process |
| `@beep/gov-legal-mcp` | stdio | 4 (GovInfo toolkit vanishes without its key) | eCFR none | in-process |
| `@beep/law-practice-server` via `apps/practice-kg-mcp` | stdio | 9 | kit `SourceAuth` none | in-process |
| professional-desktop ontology sidecar | HTTP `/mcp` | 6 read-only, +3 mutation, +1 publish (flag-gated) | per-launch bearer + Origin allow-list | HTTP integration harness |

In-repo wire clients all send `initialize` with `protocolVersion: "2025-06-18"`: the sidecar
harness (`RpcClient.make(McpSchema.ClientRpcs)` over `RpcClient.layerProtocolHttp` with the
JSON-RPC codec), `goals/ontology-agent-surface/ops/live-mcp-client.ts`, and the m365 stdio test.
Public `McpSchema.ClientRpcs` still has `Initialize` and no `server/discover`; Effect's 2026
client group is internal, so there is no public client to point harnesses at. The sidecar's CORS
`allowedHeaders` omit `mcp-method` and `mcp-name`.

### 3.3 Governance identity (lane 22-r3)

- `GovernedTierGate` keys grant freeze, hash chains, and `grantTtl` on the transport-assigned
  session id (decision 10 of `goals/agent-execution-authority/SPEC.md`, corrected in its PR 5 from `clientId`
  to the session: "a run is an MCP session"; `goals/ontology-agent-surface` only holds the live
  client).
  `OntologyChangeActor` already attributes HTTP mutations by per-request `clientId`, so
  provenance and ledger keys disagree today. Grant-expired permanence is comment-enforced and
  untested; `GovernedEgress` is process-scoped and time-joined.
- Under a 2026-only sidecar with today's kit, mutations are dead: no identity, gate refuses. If
  the kit kept reading `mcp-session-id` after Effect stops minting it, the run key becomes a
  client-supplied string (freeze and TTL reset on rotation, a leaked id joins another chain).
- Candidate anchors, none decided: the verified per-launch bearer (G4-compatible; changes the
  invariant to "a run is a sidecar launch"), a shell-minted run token (minted at first
  `tools/call`, first authenticated request, or an explicit open-run tool), `requestState` with
  HMAC/AEAD integrity, MRTR per-call approval, OTLP trace correlation, or a stateful adapter on
  the sidecar only (contradicts G4; mixed lists are upstream-supported).

### 3.4 HTTP security and observability (lane 24-r5)

- The sidecar's own Origin middleware duplicates Effect's `allowedOrigins`, is stricter on a
  missing `Origin` (denies; Effect and the spec allow the non-browser path), answers
  attacker-Origin `OPTIONS` with 204 and no ACAO instead of the spec's 403, and emits the typed 403
  plus `ontology.mcp.origin` metric that Effect's check does not.
- Replay and abuse surface after the flip: static per-launch bearer plus Origin, no nonce, no
  body-size cap, no rate limit; a leftover client `Mcp-Session-Id` would silently become the gate
  run key unless the kit stops reading it. `mcp.tool.call.*` spans have no correlation attribute
  that survives the loss of the session id.
- The Origin allow-list is a literal in `OntologyMcpTransport.ts`. `@beep/ontology-config` already
  owns `OntologyMcpServerConfig` (server-only MCP settings) and does not mention origins; the
  configuration-boundaries doctrine (architecture 06) makes that the home if the list is touched.
  The sidecar's 403 is a `Data.TaggedError`, not a schema-declared error crossing the boundary
  (architecture 09).

### 3.5 Snapshot blast radius (lane 23-r4 and the spike, `research/25-r4-spike-census.md`)

- Type level: the whole repo checks green after two edits (`EffectSchema.ts` guard wrapper for
  the narrowed `Effect.isEffect`, `Stream.scan(() => "", …)` in ai-metrics source discovery). The
  second is also a runtime fix: shipped unwrapped, it would call a string as a function, and its
  tests never run that stream.
- Runtime changes typecheck cannot catch: `@effect/sql-pg` `timestamp`/`timestamptz` decode to
  `Date` (was epoch ms; drizzle `mode: "string"` columns may coerce or fail) and unregistered
  OIDs decode as UTF-8 text (enum labels; invalid UTF-8 closes the connection; enum arrays may
  garble). Native `PgClient` users are the postgres driver and the `pg-external` harness path;
  in-process PGlite tests will not see either change. `Effect.orElseSucceed` now passes the error
  (369 call sites, all zero-arity thunks, so behaviour-neutral). `Stream.partition` tuple swap
  and `Stream.mapBoth` key rename: NOT FOUND in the repo. POSIX process-group cleanup after a
  successful leader exit affects `ChildProcessSpawner` users; semantica's reasoning test spawns
  live children, the vault picker's tests mock the spawner.
- Mechanics: catalog entries to `https://pkg.pr.new/Effect-TS/effect/<package>@<sha>` for all 16
  family packages; the `@effect/platform-node-shared` write patch still matches source but is
  keyed to `4.0.0-rc.115`, and its application to the snapshot tarball is UNVERIFIED (a failed
  patch silently restores the write-offset bug). Precedent #1060 re-rolled and re-keyed it.
- Test level at the snapshot with hosts still on `v2025_06_18`: unit suites of all MCP and
  sql-adjacent packages pass; the sidecar HTTP integration harness fails 8 tests because the
  server now emits SSE for multi-message responses and the JSON-RPC codec cannot decode
  `data:` frames. This is the first runtime break and it precedes any protocol flip.

## 4. NOT FOUND and UNVERIFIED

- Live first-message capture of Claude Code, Codex, and grok stdio against a 2026-only nlp-mcp
  (Gate A finding 25). Behaviour above is from documentation and source.
- Application of the platform-node-shared patch to the pkg.pr.new tarball.
- Whether any production path uses native `@effect/sql-pg` against timestamp or enum columns
  (professional-desktop is in-process PGlite; `pg-external` is a harness path).
- Whether the snapshot's `$ref` inliner always yields a top-level `type: "object"` for
  empty-class inputs (decides if the kit's `withTopLevelObjectInputSchema` stays).
- `Stream.partition`, `Stream.mapBoth`, `PgTypes.register` call sites: NOT FOUND in the repo.
- Any in-repo browser-origin client of `/mcp` (Tauri webview, portless Vite, future workbench).

## 5. The G4 question, consolidated

Every lane that touched protocol posture filed a decision-challenge against "2026-07-28 only",
and the refuters upheld the core of each while trimming overstatements:

1. A 2026-only list rejects `initialize` from every in-repo wire client (3.2) and from the
   default stdio of all three agent CLIs (1.2). G6 excludes external clients from gating the
   flip, but `.mcp.json` launches nlp-mcp for those same binaries, and nlp-mcp has no stdio wire
   test, so a flip can stay green while editor sessions break.
2. No server-minted stable identity exists over HTTP (2.2). `GovernedTierGate` as designed has
   nothing to key on (3.3), and the kit's identity path is skipped entirely (3.1). `clientId`
   is not a candidate: it is per-POST and the gate already refuses it as a run key.
3. Mixed lists are upstream-designed (2.2), what the official SDK servers ship by default (1.2),
   and spec-permitted (1.1). But a mixed list is a compatibility posture, not an adoption path:
   `initialize` clients keep getting a minted 2025 session even when they offer 2026-07-28. It
   also keeps the session machine alive inside the kit (the complexity G4 meant to remove), and
   the 2026 conformance referee cannot certify a dual-era server.
4. Effect's 2026-only conformance suite proves the configuration works when clients speak 2026;
   nothing in-repo does yet, and there is no public Effect 2026 client group to build on.
5. Under either answer the proving host needs a real 2026 client: with G4 kept, every in-repo
   client is rewritten first; with mixed lists, the acceptance test is still a client that never
   calls `initialize`, or nothing has been proven about 2026.

The decisions the grill must name (referenced by these names in `research/sizing.md`):

| Decision | Question | Evidence |
| --- | --- | --- |
| **D-posture** | Keep G4 (2026-only everywhere), relax to a mixed list repo-wide, stage mixed then cut over per host, or a G4 exception per transport (2026-only on HTTP, mixed on stdio). The last is a G4 exception, not a G9 change; G9 stays host membership. Any leftover stateful host keeps both identity machines in the kit permanently. | §1.2, §2.2, §3.2, 22-r3, 14-s2 |
| **D-run-key** | What mints the `GovernedTierGate` run key on HTTP once `initialize` and `mcp-session-id` are gone: verified per-launch bearer, shell-minted run token (at first `tools/call`, first authenticated request, or an explicit open-run tool), `requestState` with HMAC/AEAD, MRTR per-call approval, or a stateful adapter on the sidecar only. Owned by `epistemic/server` and app composition, never by a kit schema field. Which existing test ("keys the run on the session, not the per-request client id") is deleted. | 22-r3 Q1/Q2/Q4/Q8/Q9, 24-r5 |
| **D-cli-contract** | Whether G6 stands for the proving host: vendor CLI opt-in flags (`MCP_PROTOCOL_NEGOTIATION=auto`, Codex flag, grok unsupported) are operator notes only, or a live first-message capture (Gate A finding 25) is an entrance criterion before nlp-mcp flips. The doctrine review reads G6 as "notes only"; the pre-mortem reads a proving host nobody's CLI can speak as a failed proof. | 14-s2, 21-r2 |
| **D-client-home** | Where the in-repo 2026 client lives (a `ClientRpcs` group with `server/discover`, HTTP header and `_meta` injection, stdio NDJSON helper, SSE-aware decode), given Effect's 2026 client group is internal. | 21-r2, 25-r4 |
| **D-conformance** | Whether a 2026-only host must pass `conformance --requirements 2026-07-28`; if so, who owns the waiver for the 404/`-32601` expectation or a host-side error-shape change so stdio `-32022` carries `supported: ["2026-07-28"]`. | 14-s2, 11-u2 |
| **D-projection** | The kit's protocol error projection, split from the mechanical rebase: does `api_key_required` stay a non-error `CallToolResult` envelope (kit-only value, a named translator), and do invalid arguments stay a canned result or become `InvalidParams`. Declared as error-translation at the kit protocol adapter (architecture 09), not in host tools. | 20-r1 |
| **D-origin** | Origin allow-list home (`OntologyMcpServerConfig` field, an app-local literal with a written exception, or Effect `allowedOrigins` only), keep or drop the sidecar Origin middleware, 204-without-ACAO vs 403 on attacker `OPTIONS`, Origin-less POST denied vs allowed, and whether any browser-origin `/mcp` client is in scope (decides CORS `mcp-method`/`mcp-name`). | 24-r5 Q1–Q4, Q8 |
| **D-pin-sha** | Which upstream SHA the snapshot PR pins; if newer than `a7a71921de`, the blast-radius census is re-run on it before merge. | 23-r4, 25-r4 |

## 6. Sizing constraints

This is a research-stage packet; the PR train belongs in `MAP.md` after the align grill. What the
evidence fixes now, independent of the decisions above:

- The snapshot pin cannot be a small PR. Type level is two edits, but hosted proof requires the
  sidecar integration harness green (8 tests break on SSE framing at the snapshot alone), the
  platform-node-shared patch applied and asserted rather than silently skipped, a native
  `@effect/sql-pg` timestamp and enum proof (or a call-site census showing no native `PgClient` in
  production), and a docgen run (precedent #1060 hit TS7056).
- The kit rebase is one PR only if identity redesign is kept out of it: it rebases the fork,
  dual-reads `McpServerClient` or `McpRequestContext` so a 2026 dispatch is not `None`, lands the
  D-projection decision as a named translator, keeps the `SanitizedSpan` coverage ratchet, and
  owns the protocol-list helper (otherwise six host literals).
- With G4 kept, a 2026 client kit is a large PR the original draft did not contain; with mixed
  lists it collapses to optional. That fork is the biggest sizing swing: roughly 28–45 agent-days
  under G4 as written against 16–24 under a mixed list.
- The sidecar identity change lands in the same PR as the sidecar protocol pin, after D-run-key,
  with the grant-expired and never-evict tests, `OntologyChangeActor` keyed to the new run id,
  the gate span renamed to an architectural action, and the correlation attribute on that gate
  span, not on the kit's technical `mcp.tool.call.*` spans.
- The RC swap is a second snapshot campaign (patch re-roll, lockstep re-pin), not a closeout
  line; it is off the critical path until a published RC exists.
- Identity language stays in the agent-execution-authority SPEC and the epistemic package docs; a
  change to architecture-wide doctrine goes through `standards/architecture/DECISIONS.md`, not
  edits to the numbered driver, error, or observability files. mcp-kit needs no shared-kernel
  promotion record; its `foundation/capability` consumer table already exists.

The draft train with these constraints applied, sized per decision fork, is in
`research/sizing.md` (pre-align, superseded by `MAP.md`).

## 7. Where the friction went

`research/OPPORTUNITIES.md` holds four receipts: headless grok deep-research interrupted on
exit, Claude Code's built-in deep-research not model-routed, snapshot check reds cascading from
two files, and the per-claim verification workflow stalling at fan-out scale.

## Appendix — Gate B split claims (one refuting vote of three)

Twelve claims survived with one dissent. Where this synthesis uses them, the dissent applies.

| Claim | Used in | Dissent |
| --- | --- | --- |
| `11-u2-…-06` | 2.2 | Missing `_meta` is `-32602` only after the version-header check; with neither, the request is rejected `-32020` first. |
| `11-u2-…-29` | 2.2 | `subscriptions/listen` copies requested resource subscriptions wholesale when resources exist; it does not intersect with registered URIs. |
| `11-u2-…-38` | 3.2 | The cited lines show the default Origin check and 404s, not that in-repo launchers omit `allowedOrigins` (the sidecar sets one). |
| `13-s1-…-24` | 1.1 | `requestState` single-use is a MUST only for servers that need at-most-once; the rest of the claim matches. |
| `14-s2-…-05` | 1.2 | Local Claude Code binary is 2.1.274, not 2.1.273; the version is not on the cited pages. |
| `14-s2-…-16` | 1.2, 5 | Python's server answers both eras but has no `legacy=` option; TS `legacy: "reject"` is the modern-only analogue. |
| `14-s2-…-21` | 1.2 | Python `-32022` without `supported` tries `initialize`, which may succeed; "then raise" is overstated. |
| `20-r1-…-19` | 3.1 | `SanitizedSpan.ts` is not the kit's lowest-coverage file (`SourceAuth`, `ToolAnnotations` are lower); it is the one the rebase moves. |
| `22-r3-…-18` | 2.2, 5 | A 2026-only HTTP server rejects `initialize` as 404 method-not-found (removed from the adapter) or 400 header mismatch, not via the `selectStatefulProtocol` error, which is the stdio path. |
| `23-r4-…-04` | 3.5 | effect-drizzle casts `timestamp: string` columns to `::text` on the wire, so that path sees text, not a `Date`; the mismatch applies to other native readers. |
| `23-r4-…-10` | 3.5 | `Stream.scan` has a second git-tracked call site under `scratchpad/jsonl/Journal.ts` (non-workspace). |
| `24-r5-…-14` | 3.3 | Under 2026 HTTP `runIdOf` is never reached: `CurrentMcpCaller` is `None` and the gate refuses before keying. |
