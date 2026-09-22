# Impact matrix — hosts × change items

Revised after Gate C (`reviews/gate-c-doctrine.md`). Decision names (D-posture, D-run-key, D-cli-contract,
D-client-home, D-conformance, D-projection, D-origin, D-pin-sha) are defined in `RESEARCH.md` §5.
D-pin-sha was withdrawn on 2026-09-21: rc.117 carries the adapter and is on `main` (#1173), so
"at the snapshot" below now reads "at rc.117" (`a7a71921de` is an ancestor of the rc.117 tag).

Tags: **forced** (breaks at the snapshot or on the protocol flip; must change), **natural** (the
protocol makes it the obvious shape; G5 says wire it here), **optional** (no pull; record and
defer), **n/a**. Rows cite the owning lane; evidence is in `research/<lane>.md`. "Drivers" =
nlp, m365, uspto, gov-legal; practice-kg is listed separately because it has its own host app.
"Clients" = in-repo wire clients and harnesses (sidecar HTTP harness, `live-mcp-client.ts`,
m365 stdio test, `.mcp.json` `nlp` entry).

## A. Snapshot pin (before any protocol flip) — landed 2026-09-21 by #1173

Rows marked **done** shipped in #1173 (catalog to rc.117, patch re-key, harness SSE unwrap,
hosted-green). The two sql-pg audits are the only open items and fold into S1.

| Change item | Lane | mcp-kit | Drivers | practice-kg | Sidecar | Clients | Repo-wide |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `Effect.isEffect` guard narrowing (`EffectSchema.ts`) | 25-r4 | n/a | n/a | n/a | n/a | n/a | done (#1173) |
| `Stream.scan` LazyArg (ai-metrics) | 23-r4, 25-r4 | n/a | n/a | n/a | n/a | n/a | done (#1173) |
| 16 catalog entries move together | 23-r4 | done | done | done | done | done | done (#1173, rc.117) |
| platform-node-shared patch re-key + verify | 23-r4 | n/a | n/a | n/a | n/a | n/a | done (#1173 re-keyed to rc.117, hosted-green) |
| sql-pg `Date` timestamp decode | 23-r4 | n/a | n/a | n/a | optional (PGlite) | n/a | **forced audit** of native `PgClient` users |
| sql-pg unknown OID → UTF-8 text | 23-r4 | n/a | n/a | n/a | optional (PGlite) | n/a | **forced audit** (enum arrays) |
| SSE framing of multi-message HTTP responses | 25-r4, 11-u2 | n/a | n/a | n/a | natural (server side, automatic) | done for the sidecar harness (#1173 SSE unwrap); `live-mcp-client.ts` still open, S1b | n/a |
| POSIX process-group cleanup on success | 23-r4 | n/a | n/a | n/a | n/a | n/a | optional (spawner users; live test exists); nothing surfaced in #1173's proof |
| `Effect.orElseSucceed` receives the error | 23-r4 | n/a | n/a | n/a | n/a | n/a | optional (369 zero-arity thunks, neutral) |

## B. Kit and handler API (compile-level at the snapshot, all hosts through the kit)

| Change item | Lane | mcp-kit | Drivers | practice-kg | Sidecar | Clients |
| --- | --- | --- | --- | --- | --- | --- |
| `Exclude` target `McpServerClient` → `McpRequestContext` | 10-u1, 20-r1 | **forced** | natural (inherit) | natural | natural | n/a |
| Dual-read `McpServerClient` or `McpRequestContext` as transport caller facts (`clientId`, `clientInfo`) so a 2026 dispatch is not `None` | 20-r1, 22-r3 | **forced** (else no caller identity on 2026) | natural | natural | natural (transport facts only; never the gate run key) | n/a |
| `McpCallerIdentity.sessionId` retirement and `GovernedTierGate` run key | 20-r1, 22-r3 | **forced decision** (D-run-key; kit stops minting `sessionId` only once a server-minted, request-stable replacement exists, owned in `epistemic/server`) | n/a | n/a | **forced decision** (D-run-key) | n/a |
| `outputSchema` on every wire tool | 20-r1 | natural (kit gap) | natural | natural | natural | n/a |
| `Tool.Strict` decode options + JSON Schema flag | 10-u1, 20-r1 | natural | optional (annotate per tool) | optional | optional | n/a |
| `isError` from `result.isFailure`; `structuredContent` dropped on failure | 10-u1, 20-r1 | **forced decision** (D-projection: `api_key_required` envelope as a named translator at the kit protocol adapter, architecture 09) | natural | natural | natural | n/a |
| Invalid arguments: canned `CallToolResult` vs `InvalidParams` | 20-r1 | **forced decision** (D-projection) | natural | natural | natural | n/a |
| `FailureOrigin` classification / `INTERNAL_TOOL_ERROR_MESSAGE` | 20-r1 | natural (replace `tapCause`) | natural | natural | natural | n/a |
| `omitRequestServices` mirror | 20-r1 | natural | n/a | n/a | n/a | n/a |
| `Stream.runLast` | 20-r1 | optional | n/a | n/a | n/a | n/a |
| `withTopLevelObjectInputSchema` retention | 20-r1 | optional (UNVERIFIED redundancy) | n/a | n/a | n/a | n/a |
| Test seam that speaks 2026 (not `server.callTool` + stateful stub) | 20-r1 | **forced** | **forced** (host proofs stub the client) | forced | forced | n/a |
| README protocol pin, `TierGate` stale `filterByClient` comments | 20-r1, 21-r2 | **forced** (docs) | natural | natural | natural | n/a |

## C. Protocol flip (`McpProtocol` list per the G4 outcome)

| Change item | Lane | mcp-kit | Drivers | practice-kg | Sidecar | Clients |
| --- | --- | --- | --- | --- | --- | --- |
| Protocol pin change on `layerStdio` / `layerHttp` | 21-r2 | n/a | **forced** | **forced** | **forced** | n/a |
| `initialize` rejection (2026-only) | 11-u2, 21-r2 | n/a | forced consequence | forced consequence | forced consequence | **forced** rewrite (or mixed list) |
| `server/discover` + `MCP-Protocol-Version`, `Mcp-Method`, `Mcp-Name`, `_meta` on every request | 11-u2, 13-s1 | n/a | natural (automatic) | natural | natural | **forced** (no public Effect 2026 client group) |
| Stdio wire canary for the `.mcp.json` host | 21-r2 | n/a | **forced** (nlp-mcp has none) | optional | n/a | n/a |
| Operator notes for agent CLIs (`MCP_PROTOCOL_NEGOTIATION=auto`, Codex flag, grok unsupported) and the live first-message capture (Gate A 25) | 14-s2 | n/a | **forced decision** (D-cli-contract: notes only per G6, or an entrance criterion for the proving host) | n/a | n/a | natural (docs) |
| `instructions`, `websiteUrl`, `icons`, prompt titles | 10-u1, 12-u3 | n/a | natural (`instructions`) | natural | natural | n/a |
| `structuredContent` for non-object success | 11-u2, 21-r2 | natural | **forced** for `uspto_search_applications` (array) | n/a | n/a | n/a |
| MRTR `InputRequired` (elicitation replacement) | 11-u2, 12-u3 | optional (no reverse-client use today) | optional | optional | optional (mutation approval candidate) | n/a |
| `subscriptions/listen` | 11-u2 | optional | optional | optional | optional (ontology file changes candidate) | n/a |
| Loss of `ping`, `logging/setLevel`, `resources/subscribe`, batches | 11-u2 | n/a | optional (unused) | optional | optional | forced if a client probes `ping` |
| HTTP cancellation of another POST's in-flight call (Effect gap) | 11-u2 | n/a | n/a | n/a | accepted gap (recorded on the sidecar host page; stdio unaffected) | n/a |
| `initialize` rejection shape: 404/`-32601` and `supported: ["2026-07-28"]` vs Effect's 400/`-32020` and bare `-32022` | 13-s1, 14-s2 | n/a | **forced decision** (D-conformance) | forced decision | forced decision | n/a |
| Conformance referee (`--requirements 2026-07-28`, Inspector `--protocol-era`) | 14-s2 | n/a | **forced decision** (D-conformance; needs an HTTP shim for stdio) | forced decision | natural | n/a |

## D. HTTP sidecar security, identity, observability

| Change item | Lane | Sidecar | mcp-kit | Clients |
| --- | --- | --- | --- | --- |
| CORS `allowedHeaders` gain `mcp-method`, `mcp-name` | 21-r2, 24-r5 | **forced** for any browser-origin client; natural otherwise | n/a | forced for browser harnesses |
| Origin middleware: keep (typed 403 + metric) vs Effect `allowedOrigins` only; the 403 becomes a schema-declared error crossing the boundary (architecture 09) | 24-r5 | **forced decision** (D-origin) | n/a | n/a |
| Attacker-Origin `OPTIONS` 204-no-ACAO vs 403 | 24-r5 | optional (spec-strict) | n/a | n/a |
| Origin-less POST denied vs allowed | 24-r5 | **forced decision** | n/a | n/a |
| Origin allow-list home: `OntologyMcpServerConfig` field in `@beep/ontology-config`, app-local literal with a written exception, or Effect `allowedOrigins` only | 24-r5 | **forced decision** (D-origin) | n/a | n/a |
| `GovernedTierGate` run key without `mcp-session-id` (grant freeze, hash chain, TTL), owned in `epistemic/server`; lands in the same PR as the sidecar pin | 22-r3 | **forced decision** (D-run-key) | forced once decided (stop reading `mcp-session-id` only when the replacement exists) | n/a |
| `OntologyChangeActor` provenance key aligned with ledger run key | 22-r3 | **forced** (same PR as the run key) | n/a | n/a |
| Grant-expired permanence test; never-evict enforcement | 22-r3 | **forced** (exit criterion of the identity change) | n/a | n/a |
| `GovernedEgress` session seam | 22-r3 | optional | n/a | n/a |
| Correlation attribute on the gate span (renamed from the codepath name `Epistemic.GovernedTierGate.evaluate` to an architectural action); kit `mcp.tool.call.*` spans stay technical (architecture 12) | 24-r5 | natural | n/a (no product identity on kit spans) | n/a |
| Body-size cap, rate limit keyed on `Mcp-Method`/`Mcp-Name`, nonce | 13-s1, 24-r5 | optional (loopback + bearer today) | n/a | n/a |
| `requestState` integrity (HMAC/AEAD) if used as identity | 13-s1, 22-r3 | forced only if that anchor is chosen | forced only if chosen | n/a |

## E. Documentation

| Change item | Lane | Where | Tag |
| --- | --- | --- | --- |
| mcp-kit README protocol pin and `foundation/capability` consumer table (architecture 07; no shared-kernel promotion record) | 20-r1 | `packages/foundation/capability/mcp-kit/README.md` | forced |
| Identity invariant wording ("a run is an MCP session", decision 10) | 22-r3 | `goals/agent-execution-authority/SPEC.md` and epistemic package docs; a dated `standards/architecture/DECISIONS.md` entry only if it becomes architecture-wide | forced when the anchor changes |
| Host JSDoc naming `2025-06-18` | 21-r2 | driver `Server.ts` files | natural |
| Upstream `MCP.md` refresh via the fork (G8) | 12-u3 | `beep-effect/effect` | optional, non-blocking |
