# R4 Spike Census — beep-effect on the upstream Effect main snapshot (2026-09-16)

Orchestrator-run empirical spike. It supplements lane `23-r4-snapshot-blast-radius`, which
analyses the changesets without installing anything.

## Setup

- Disposable worktree `effect-mcp-snapshot-spike` (branch `spike/effect-mcp-snapshot`, never
  committed), created from `main` at `ca7362278c` with `bun run beep worktree new`.
- All 16 effect-family catalog entries in `package.json` rewritten from `4.0.0-rc.115` to
  `https://pkg.pr.new/Effect-TS/effect/<package>@a7a71921de`; pkg.pr.new answered HTTP 200 for every
  one. `bun install` succeeded; the installed `effect` still reports version `4.0.0-rc.115` but
  ships `McpProtocol.v2026_07_28` in `dist/unstable/ai/McpProtocol.d.ts`.
- Hosts were left on `McpProtocol.v2025_06_18`, so every result below measures the snapshot bump
  alone (working assumption G7's first PR), not the protocol flip.
- Every command ran with turbo's remote cache disabled (`--cache=local:rw`).

## Wave 1 — repo-wide type check

`bunx turbo run check --continue --cache=local:rw --output-logs=errors-only`

| Tree | Result |
| --- | --- |
| `main` (baseline) | exit 0 |
| snapshot | exit 2; 124 of 251 tasks failed; 252 unique error rows |

Root causes (all other rows re-report these through project references; 120 packages show only
the first):

| File | Errors | Cause |
| --- | --- | --- |
| `repo:packages/foundation/modeling/schema/src/EffectSchema.ts:88` | TS2322, TS2345, TS377003, TS377004 | `Effect.isEffect` is now typed `(u: unknown) => u is Effect<unknown, unknown, unknown>` (`effect:packages/effect/src/Effect.ts:230`), so passing it directly as the `S.declare` guard for `Effect<Success, Failure, Dependencies>` no longer type-checks. |
| `repo:packages/tooling/library/ai-metrics/src/source-discovery.ts:338-379` | TS2345 ×2, TS2322 | `Stream.scan` now takes its initial value as a `LazyArg` (Effect/Stream API alignment, #8256). |

## Wave 2 — after two minimal fixes

Fixes applied in the spike only: wrap the guard as
`(u): u is Effect.Effect<Success, Failure, Dependencies> => isEffect(u)` and pass
`Stream.scan(() => "", ...)`.

| Tree | Result |
| --- | --- |
| snapshot + 2 fixes | exit 0; 251 of 251 check tasks pass |

## Wave 3 — unit tests of MCP and sql-pg packages

`bunx turbo run test --only --continue` filtered to `@beep/mcp-kit`, `@beep/nlp-mcp`,
`@beep/m365-mcp`, `@beep/uspto-mcp`, `@beep/gov-legal-mcp`, `@beep/law-practice-server`,
`@beep/practice-kg-mcp`, `@beep/epistemic-server`, `@beep/professional-desktop`,
`@beep/effect-drizzle`, `@beep/postgres`, `@beep/pglite`.

| Tree | Result |
| --- | --- |
| `main` | 12 of 12 tasks pass |
| snapshot + 2 fixes | 12 of 12 tasks pass |

Spot counts on the snapshot (direct `bun run beep:test`, which excludes `test/integration/**`):
mcp-kit 43 tests, nlp-mcp 17, professional-desktop 238, epistemic-server 35, all passing.

## Wave 4 — MCP wire integration tests

`bun run beep:test:integration` in each package.

| Package | `main` | snapshot + 2 fixes |
| --- | --- | --- |
| `@beep/professional-desktop` | 30 passed (8 files, 3 skipped) | **8 failed**, 22 passed |
| `@beep/epistemic-server` | 48 passed (6 files, 2 skipped) | 48 passed |
| `@beep/nlp-mcp` | 20 passed | 20 passed |

The 8 failures are every test in `repo:apps/professional-desktop/test/integration/ontology-mcp-http.test.ts`
(6) plus 2 in `repo:apps/professional-desktop/test/integration/execution-authority.pglite.test.ts`,
all with `RpcClientDefect: Error decoding HTTP response` raised from `RpcClient.ts` `protocolDefect`.

Mechanism (orchestrator reading, to be confirmed by Gate B and lane 21-r2):

- The test harness talks to the sidecar through Effect's generic RPC HTTP client with the plain
  JSON-RPC codec: `RpcClient.layerProtocolHttp` plus `RpcSerialization.layerJsonRpc()`
  (`repo:apps/professional-desktop/test/integration/support/ontology-mcp-harness.ts:184-198`),
  sending `accept: application/json, text/event-stream`.
- Since #7265, `McpServer.layerHttp` rewrites a response as Server-Sent Events whenever the request
  is a subscription, the RPC response body is a stream, or the buffered body holds more than one
  newline-separated message (`effect:packages/effect/src/unstable/ai/McpServer.ts:1609-1616`,
  framing in `toServerSentEvents` at `effect:packages/effect/src/unstable/ai/McpServer.ts:1707-1727`).
  The rewrite was introduced by commit `a2c4154cf8` (#7265).
- A JSON-RPC codec cannot decode `data: ...` frames, so the in-repo client fails. This happens on
  the session protocol `v2025_06_18`, before any move to 2026-07-28.

## Consequences for sizing

- The type-level migration for the snapshot PR is two small edits.
- The first runtime break is in-repo MCP HTTP clients (the sidecar integration harness, and by the
  same construction `repo:goals/ontology-agent-surface/ops/live-mcp-client.ts`), which need an
  SSE-aware client transport or a harness rewrite.
- Stdio hosts (`nlp-mcp`) and the epistemic governance integration suite showed no regression at
  the snapshot while still on `v2025_06_18`.
- Not covered by this spike: packages outside the filter above, Testcontainers-backed Postgres
  suites (skipped where Docker gating applies), and any behavior after switching hosts to
  `v2026_07_28`.
