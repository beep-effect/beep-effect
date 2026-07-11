# P2 Transport + Safety Evidence

Date: 2026-07-11
Branch: `feat/ontology-agent-surface-p2-transport`
Status: `defects-repaired-local; host socket and live-client re-verification required`

## Host Live-Proof Findings And Repairs

Host validation launched the real Bun sidecar and exercised `/mcp` with the
packet's typed client. `initialize`, `tools/list` (six read-only tools with the
mutation gate closed), and `ontology_capability_metadata` passed over the real
socket. Origin/auth enforcement, JSON-RPC framing, session-id flow, and the
reported budgets were correct. The transcript is retained at
`history/2026-07-11-p2-live-client.log` and will be overwritten by the host
rerun after these repairs.

The live `ontology_sparql_query` call exposed an Oxigraph adapter defect.
Oxigraph represents a plain literal's absent language as `language: ""`, while
`fromOxigraphObject` treated every defined string as a language tag and passed
the empty string to `Rdf.makeLiteral`. The RDF language schema correctly
rejected it. The adapter now filters empty strings before constructing the
optional language field, matching the established N3 and SHACL adapter
behavior. A Node-backed real-engine regression runs the exact
`SELECT ?s ?p ?o WHERE { ?s ?p ?o }` query through `OntologyToolService`; the
MCP integration query also selects `?o`, so its real-engine tool call crosses
the same plain-literal conversion.

The same hazard was audited across the other read paths. Snapshot and search
consume the N3 adapter, whose literal conversion already filters empty
languages. Validation consumes the SHACL adapter, which also filters them.
Oxigraph SELECT term bindings and CONSTRUCT quad objects share the repaired
`fromOxigraphObject`, so both result profiles receive the fix.

The host socket-mode test failure was a test-client session replay defect, not
a production serialization mismatch. The socket branch relied on the generic
RPC HTTP client, which does not retain MCP's response-issued
`mcp-session-id`; subsequent requests reached MCP without a session and
received its intentionally empty 404 response, surfaced client-side as
`Unexpected end of JSON input`. The in-memory branch had bespoke replay logic,
so it masked the defect. Both branches now use the same Effect `HttpClient`
wrapper: it captures a newly issued session id, retains it across responses
that omit the header, and adds it to later requests. JSON-RPC remains
`RpcSerialization.layerJsonRpc()` on both sides.

The defect-text hardening flag was fixed in `@beep/mcp-kit`. Pre-structured
tool boundary failures no longer return `Cause.pretty` stacks to MCP clients;
they return a stable generic error sentence while the full cause remains in
server-side Effect logging. A dispatch regression proves invalid parameters
cannot expose schema stacks or absolute local paths.

## Mount Design And First-Slice Gate

`apps/professional-desktop/server/OntologyMcpTransport.ts` mounts the Effect
MCP JSON-RPC HTTP protocol at `/mcp` on the same `HttpRouter` and loopback Bun
HTTP server as `/rpc`. No stdio MCP transport, session repository, cache, or
second listener was added.

The route applies three scoped middleware layers:

1. `Origin` must exactly match `http://localhost:1421`,
   `http://127.0.0.1:1421`, `tauri://localhost`, or
   `http://tauri.localhost`; missing or other origins receive a typed
   `OntologyMcpOriginForbidden` JSON response with status 403.
2. `requireRpcSessionToken` reuses the existing `RpcSessionAuth` bearer
   session; missing or incorrect auth receives 401. There is no auth redesign.
3. Route-local CORS repeats only the exact origin allowlist. The existing RPC
   wildcard CORS is now scoped to `/rpc` plus its preflight route and is never
   installed globally over `/mcp`.

`OntologyReadOnlyToolkit` is registered independently and is available when
`ONTOLOGY_MCP_MUTATIONS_ENABLED=false` (the default). The separately composed
`OntologyMutationToolkit` is registered only when that flag is true. The
default-gate test proves `ontology_capability_metadata` and bounded real
Oxigraph `ontology_sparql_query` are callable while
`ontology_propose_change_batch` and `ontology_repair` are absent from
`tools/list`.

## TierGate Precedent

The first production TierGate consumer is deliberately narrow:

- Registration: `makeOntologyMcpTransportLayer` supplies a TierGate from the
  explicit server-owned approved-tool policy only to mutation handlers.
- Dispatch: `OntologyMcpMutationHandlersLive` wraps
  `ontology_propose_change_batch`, `ontology_repair`, and the write-sidecar
  `ontology_export_provenance` call with `dispatchWithTierGate`.
- Enforcement: a `Refused` decision becomes the typed recoverable
  `OntologyTierGateRefusal`; tool hints and `tools/list` visibility are never
  treated as authorization.
- Default: mutation registration is off; when registration is enabled with no
  resolved approvals, calls still fail closed.

The HTTP fallback test initializes a real MCP session, calls a registered
mutation with an empty approved-tools policy, receives `isError: true`, and
decodes `structuredContent` as `OntologyTierGateRefusal`.

## Actor Attribution Path

`sanitizedToolkit` reads Effect's request-local `McpServerClient` after MCP
initialization and installs `CurrentMcpCaller` only for that dispatch. The
authenticated desktop handler converts its connection-local client id into
`urn:beep:desktop-rpc-session:mcp-client:<id>`. This identity is meaningful
only because the entire route is already inside the reused bearer-auth
boundary; direct/in-memory toolkit dispatch leaves the caller absent.

`OntologyMcpMutationHandlersLive` refuses propose/repair when the caller is
absent. Approved calls pass `OntologyChangeActor` into `OntologyToolService`,
which overwrites any caller-supplied operation actor before apply/save. Each
change-log entry therefore carries the authenticated actor. PROV generation
fails with `actorIdentityMissing` if any journal entry lacks an actor; it never
uses the former `agent:workbench` default.

The approved HTTP mutation test reads the fingerprint-addressed `.prov.ttl`
journal written during the mutation and proves the caller URN, `prov:Agent`,
and `prov:wasAssociatedWith` are present.

## Single Write Authority And TOCTOU

The sidecar remains the sole v1 ontology write authority for files exposed by
`/mcp`. `OntologyToolServiceLive` owns one semaphore around each stateless
open/fingerprint/CAS/apply/atomic-save sequence. The load-bearing comment at
that semaphore records that this closes in-process races only and depends on
the sidecar-exclusive write path; no cross-process lock or session repository
was added. Independent host processes must not write the same workspace while
the sidecar is serving it.

## HTTP And Real-Engine Proof

The initial sandbox command attempted an ephemeral HTTP listener and failed
before route startup:

```text
listen EPERM: operation not permitted 127.0.0.1
```

Per the P2 fallback contract, the identical route Layer then ran through
`HttpRouter.toWebHandler` with a real MCP `RpcClient`, real N3/Oxigraph/SHACL/
rdfc-1.0 layers, and the same session-header replay wrapper now used by socket
mode. Post-repair result:

```text
apps/professional-desktop/test/integration/ontology-mcp-http.test.ts
  4 tests passed
```

Covered proofs:

- initialize -> tools/list -> tools/call for capability metadata and bounded
  SPARQL, with mutation tools absent under the default feature gate;
- typed 403 Origin rejection and 401 unauthenticated rejection;
- TierGate refusal on a registered mutation with no resolved approval;
- approved mutation, real saved delta, and caller-specific PROV journal;
- 257-operation budget refusal and stale-fingerprint CAS conflict, both
  returned with MCP `isError: true` and decodable typed structured content.

Related regressions:

```text
@beep/ontology-server OntologyTools.test.ts + SessionServer.test.ts
  2 files passed; 17 tests passed
@beep/mcp-kit SanitizedToolkit.test.ts + TierGate.test.ts
  2 files passed; 10 tests passed
@beep/ontology-use-cases Session.validation.test.ts + WorkerImportGraph.test.ts
  2 files passed; 5 tests passed
```

## Local Quality Gates

Post-repair proof:

```text
Node-backed @beep/ontology-server OntologyTools.test.ts: 5 passed
  (includes exact plain-literal SELECT through OntologyToolService)
Node-backed professional-desktop ontology-mcp-http.test.ts: 4 passed
  (in-memory handler using the shared socket/in-memory session replay layer)
Node-backed @beep/mcp-kit SanitizedToolkit.test.ts: 4 passed
Node-backed @beep/oxigraph suite: 1 passed
affected package check/lint: oxigraph, mcp-kit, ontology-server,
  professional-desktop all passed
affected package docgen: oxigraph, mcp-kit, ontology-server all passed
bun run check: 114/114 package tasks, dtslint, 453 test files, tsgo smoke
bun run lint: all 23 blocking lanes green
bun run beep laws terse-effect --check: blocking_files=0
bun run beep lint schema-first: missing=0, stale=0, advisories=0
git diff --check and git diff --cached --check
```

`docgen:local` requires full docgen because the pre-existing dirty `bun.lock`
is a global Turbo/docgen input. No write/regen command was run; the three
affected source packages passed direct docgen instead.

Passed locally:

```text
package check/lint/docgen: mcp-kit, ontology-domain, ontology-use-cases,
  ontology-server; professional-desktop check/lint
bun run check: 114/114 package tasks, dtslint, 453 test files, tsgo smoke
bun run lint: all blocking lanes green
bun run beep quality jsdoc-inventory: openModules=0, openExports=0
bun run beep quality jsdoc-ratchet: increased=0
bun run beep laws terse-effect --check: blocking_files=0
bun run beep lint schema-first: missing=0, stale=0, advisories=0
bun run beep quality test-tsgo: 453 files across 112 packages
bun run fallow:boundaries:check: generated manifest current and doctrine checks passed
bunx syncpack lint: no issues
BUN_TMPDIR=/tmp bunx sherif@1.10.0 -r non-existent-packages: no issues
bun run beep goals index --check
bun run beep lint reflection-artifacts: blocking_findings=0
jq . goals/ontology-agent-surface/ops/manifest.json
git diff --check and git diff --cached --check
```

The two new workspace dependencies required one generated reference in
`apps/professional-desktop/tsconfig.json`, one in
`packages/ontology/server/tsconfig.json`, and four entries in the generated
fallow boundary manifest. No registry dependency or lockfile change was added;
`@effect/platform-node` was already catalog-pinned and is test-only.

`bun run config-sync:check` now reports only the inherited 106
`package-docgen` changes from P1; the two P2 reference deltas are resolved. The
106-file blanking/churn was not generated or accepted.

`bun run beep yeet verify` stopped at its initial remote-baseline refresh
because sandbox networking cannot fetch `origin/main` (exit 255). No publish,
monitor, commit, or push command was run.

## Exact Host Commands

First rerun the repaired suite over a real node listener bound by
the test's `NodeHttpServer.layer(..., { host: "127.0.0.1", port: 0 })`:

```sh
cd apps/professional-desktop
BEEP_TEST_ONTOLOGY_MCP_SOCKET=1 node ../../node_modules/vitest/vitest.mjs run \
  --config vitest.integration.config.ts \
  test/integration/ontology-mcp-http.test.ts
```

Then prove the launched Bun sidecar with the packet's typed MCP client. In
terminal one:

```sh
cd /home/elpresidank/YeeBois/projects/beep-effect8
export BEEP_DESKTOP_RPC_SESSION_TOKEN="$(openssl rand -hex 32)"
export CHAT_AGENT=fixture
export CHAT_SIDECAR_PORT=3939
export ONTOLOGY_MCP_MUTATIONS_ENABLED=false
mkdir -p .beep/professional-desktop/ontology-workspace
cat > .beep/professional-desktop/ontology-workspace/live-proof.ttl <<'TTL'
@prefix ex: <https://example.test/> .
ex:alice a ex:Person ; ex:name "Alice" .
TTL
bun run --cwd apps/professional-desktop sidecar
```

In terminal two, preserve the exported token from terminal one (or launch both
commands from the same shell/session) and run:

```sh
cd /home/elpresidank/YeeBois/projects/beep-effect8
export ONTOLOGY_MCP_URL=http://127.0.0.1:3939/mcp
export ONTOLOGY_MCP_ORIGIN=http://127.0.0.1:1421
export ONTOLOGY_MCP_ONTOLOGY_PATH=live-proof.ttl
bun run goals/ontology-agent-surface/ops/live-mcp-client.ts 2>&1 | tee \
  goals/ontology-agent-surface/history/2026-07-11-p2-live-client.log
```

The replacement transcript must show, in order, `initialize`, `tools/list`,
`tools/call ontology_capability_metadata`, and
`tools/call ontology_sparql_query`; metadata must report the 200-result query
budget and the SPARQL call must be non-error. Do not commit the generated log
until it has been reviewed for secrets (the client never logs Authorization).

Remaining inherited and repo-quality host commands:

```sh
goals/ontology-agent-surface/ops/validate-robot-interop.sh
bun install
bun run config-sync:check
bun run check
bun run lint
bun run beep yeet verify
```

Do not run Yeet publish or monitor from this P2 lane.

## P3 Risks

- The repaired node-listener session replay and launched-sidecar SPARQL result
  remain unproven in this sandbox; P2 stays host-verification-required until
  both host reruns pass.
- P0 ROBOT interoperability remains an inherited host gate.
- `config-sync:check` retains P1's unrelated 106-file package-docgen regression;
  do not accept or regenerate that churn without an independent fix.
- The single-writer guarantee is operational: another process writing the
  served ontology workspace can reopen the cross-process CAS window.
- MCP caller ids are connection-local within the authenticated desktop session,
  not durable user-account identities; any future multi-user auth design must
  replace the actor IRI contract explicitly rather than silently reattribute.
- Stateless 1k/10k/100k open/parse benchmarks and final reasoner/tool docs
  remain P3 work; no cache was introduced.
