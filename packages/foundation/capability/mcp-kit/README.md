# @beep/mcp-kit

Reusable MCP host-construction kit: credential-keyed toolkit composition, the
`api_key_required` envelope, tier-gate dispatch, progressive field-tier
projection, span hygiene, and the in-repo MCP `2026-07-28` client — built
natively on `effect/unstable/ai` (`Tool`, `Toolkit`, `McpServer`, `McpSchema`)
at `effect@4.0.0-rc.117`. The kit pins one protocol revision, the stateless
`2026-07-28` adapter (`statelessMcpProtocols`); hosts move to it one at a time
(`goals/mcp-stateless-kit-and-drivers`).

## Consumers (`foundation/capability` ≥2-consumer gate)

Per `standards/architecture/07-non-slice-families.md`, `foundation/capability`
requires ≥2 named consumers. Every importer today, with what it uses and the
protocol its host serves (`rg -n '"@beep/mcp-kit' --glob package.json`):

| Consumer | Uses it for | Protocol state |
| --- | --- | --- |
| `packages/drivers/m365-mcp` | `sanitizedToolkit` (`Server.ts`), `annotateFourHints` (`M365Tools.ts`); stdio conversation test | `v2025_06_18` (flips in PR 2 of the goal) |
| `packages/drivers/uspto-mcp` | `SourceAuth` registry, `composeGatedLayers`, `api_key_required` envelope, `FieldTier` document tiers, `sanitizedToolkit` | `v2025_06_18` (flips in PR 2) |
| `packages/drivers/gov-legal-mcp` | `SourceAuth`, `composeGatedLayers`, `annotateFourHints`, `sanitizedToolkit` | `v2025_06_18` (flips in PR 3) |
| `packages/law-practice/server` (+ `apps/practice-kg-mcp`) | `composeGatedLayers`, `SourceAuthRegistration`, `sanitizedToolkit`, `CurrentMcpCaller` in tool handlers | `v2025_06_18` (flips in PR 3) |
| `packages/law-practice/use-cases` | `annotateFourHints` on the practice-kg toolkit | n/a (toolkit definitions) |
| `packages/drivers/nlp-mcp` | `sanitizedToolkit`, `annotateFourHints` | `v2025_06_18` (held behind the D-cli-contract capture, PR 4) |
| `packages/ontology/use-cases` | `annotateFourHints` on the ontology toolkit | n/a (toolkit definitions) |
| `packages/ontology/server` | `TierGate`, `dispatchWithTierGate`, `CurrentMcpCaller` in tool handlers | served by the desktop sidecar |
| `packages/epistemic/server` | implements `TierGateShape` (`GovernedTierGate`), reads `CurrentMcpCaller` and, after the sibling goal, the dispatch anchor | served by the desktop sidecar |
| `apps/professional-desktop` | `sanitizedToolkit` in `server/OntologyMcpTransport.ts`; integration harness | `v2025_06_18` (`goals/ontology-sidecar-stateless-identity`) |

Foundation-mediated port inversion: `ontology/server` consumes `TierGate`,
`epistemic/server` implements it, and neither names the other; the binding
happens at `apps/professional-desktop/server/OntologyMcpTransport.ts`. The
dispatch anchor (`CurrentMcpDispatchAnchor`) follows the same pattern: app
composition provides it, `epistemic/server` and `ontology/server` read it, the
kit never interprets it.

## Deliverables

1. **`SourceAuth`** — schema-first per-source credential-gate registry
   (`{name, envVar, gate, signupUrl}`), plus `Config.redacted(envVar).pipe(Config.option)`
   resolution and mount/vanish decisions.
2. **`ToolkitComposition`** — folds credential-gated layers; `hard`-gated
   sources vanish at composition when their key is absent, `none`/`soft`
   sources always mount.
3. **`ApiKeyRequired`** — the typed `failureMode: "return"` envelope for
   `soft`/`none`-gated tools whose credential is absent at call time, and
   `translateApiKeyRequired`, the named error translator that keeps it a
   non-error `CallToolResult` at the kit protocol adapter. Every other
   failure follows rc.117 upstream: declared failures are tool errors,
   invalid arguments are JSON-RPC `InvalidParams`.
4. **`TierGate`** — the fail-closed, refusal-as-value `tools/call` dispatch
   wrapper (the real security boundary), its sanitized audit record schema,
   the `recordOutcome` settlement hook (a bounded `TierGateSettlement`
   literal, never an `Exit`, reported by `dispatchWithTierGate` once an
   approved dispatch settles), and the `EnabledWhen` list-filter helper
   (list-visibility only).
5. **`FieldTier`** — named `minimal`/`balanced`/`complete` Schema projection
   tiers, null-stripping, columnar reshaping, and fetchable handles for
   oversized payloads.
6. **`SanitizedSpan`** — suppresses raw tool `parameters` from span
   attributes; `sanitizedToolkit` mirrors rc.117 `McpServer.registerToolkit`
   (strict decode, `inputSchema`/`outputSchema`, upstream failure
   classification) with dispatch wrapped in `withSanitizedToolSpan`, the
   caller dual-read below, and the `api_key_required` translation.
7. **`McpCaller`** — `McpCallerIdentity` (transport facts: the per-exchange
   `clientId`, an optional `mcp-session-id` echoed only by stateful
   transports) on `CurrentMcpCaller`, dual-read from `McpRequestContext`
   (every rc.117 dispatch) or `McpServerClient` (initialized legacy
   sessions); on a stateless dispatch the identity is `clientId` plus
   `sessionId: None`. `CurrentMcpDispatchAnchor` is the product-neutral,
   absent-by-default dispatch anchor app composition may provide.
8. **`ToolAnnotations`** — the four-hint (`readOnly`/`destructive`/
   `idempotent`/`openWorld`) annotation helper.
9. **`Version`** — `VERSION`, `MCP_PROTOCOL_VERSION` (`2026-07-28`) and
   `statelessMcpProtocols`, the one protocol list every kit host passes to
   `McpServer.layerStdio` / `McpServer.layerHttp`.
10. **`@beep/mcp-kit/client`** — the kit-owned `2026-07-28` client:
    `McpClientRpcs` (`server/discover`, `tools/list`, `tools/call`,
    `prompts/list`, `prompts/get`, `resources/read`), the `_meta` keys and
    `MCP-Protocol-Version` / `Mcp-Method` / `Mcp-Name` injector, the
    `text/event-stream` unwrap, `layerProtocolHttp`, `layerProtocolNdjson`
    and `connect` (sends `server/discover` first). `@beep/mcp-kit/client.node`
    binds the NDJSON protocol to a spawned host process.
11. **`@beep/mcp-kit/test/Conformance`** (test-only) — `conformance2026(host)`,
    the port of Effect's `2026-07-28` conformance arms a host is responsible
    for, run over HTTP and stdio through the kit client; plus the raw
    `ConformanceHttp` / `withStdioHost` harnesses.

## Installation

```bash
bun add @beep/mcp-kit
```

## Usage

```ts
import { Effect, Layer } from "effect"
import * as O from "effect/Option"
import * as S from "effect/Schema"
import { Tool, Toolkit } from "effect/unstable/ai"
import * as McpServer from "effect/unstable/ai/McpServer"
import { composeGatedLayers, gatedLayer, sanitizedToolkit, SourceAuthRegistration, statelessMcpProtocols } from "@beep/mcp-kit"

const registration = SourceAuthRegistration.make({
  name: "Example Source",
  envVar: "EXAMPLE_API_KEY",
  gate: "hard",
  signupUrl: O.none()
})

const ExampleTool = Tool.make("example_tool", { success: S.String })
const ExampleToolkit = Toolkit.make(ExampleTool)
const exampleHandlers = ExampleToolkit.toLayer({ example_tool: () => Effect.succeed("ok") })
const exampleSourceLayer = sanitizedToolkit(ExampleToolkit).pipe(Layer.provide(exampleHandlers))

// Vanishes entirely when EXAMPLE_API_KEY is unset; mounts when present.
const registrations = composeGatedLayers(gatedLayer(registration, exampleSourceLayer))

// One protocol list for every kit host: the stateless 2026-07-28 adapter.
const hostLayer = registrations.pipe(
  Layer.provide(McpServer.layerStdio({ name: "example", version: "0.0.0", protocols: statelessMcpProtocols }))
)

void hostLayer
```

Proving a host from a test:

```ts
import { conformance2026 } from "@beep/mcp-kit/test/Conformance"

conformance2026({
  name: "example",
  version: "0.0.0",
  registrations,
  tool: { name: "example_tool", arguments: {}, invalidArguments: { extra: 1 } }
})
```

## Development

```bash
# Build
bun run build

# Type check
bun run check

# Test
bun run test

# Integration test
bun run test:integration

# Lint
bun run lint:fix
```

Unit tests stay outside `test/integration`; package integration tests live under `test/integration` and use `bun run test:integration`. Tests import package source through `@beep/mcp-kit` or other `@beep/*` aliases. Use relative imports only for local helpers, fixtures, and snapshots.

## License

MIT
