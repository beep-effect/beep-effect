# @beep/api-transport

Shared hand-authored HTTP transport transformer (auth, rate-limit, retry) for
gov/legal data drivers, built on native `effect/unstable/http` primitives
(`HttpClient.mapRequest`, `HttpClient.withRateLimiter`, `HttpClient.retryTransient`
with a jittered exponential `Schedule`). Codegen never emits transport — value
models + operation descriptors stay in each driver's `src/_generated/*`, and
transport is composed here and applied via `HttpApiClient.make`'s `transformClient`
seam (keyed drivers) or over a raw `HttpClient` (keyless drivers).

## Promotion record

This capability was **incubated** inside `@beep/govinfo` and **promoted** to
`foundation/capability` under the `standards/architecture/07-non-slice-families.md`
gate once a second driver imported it. It passes the negative gate (no product
semantics, no external-engine/SDK wrapping, no tooling purpose, no UI role) and
the ≥2-current-consumers requirement:

| Consumer | Imports | Uses it for |
| --- | --- | --- |
| `@beep/govinfo` | `makeApiTransport`, `ApiAuth`, `RateLimitSnapshot` | Applies the transformer via `HttpApiClient.make`'s `transformClient` for the keyed GovInfo search client (api.data.gov `api_key` query-param auth). |
| `@beep/ecfr` | `makeApiTransport`, `ApiAuth`, `RateLimitSnapshot` | Applies the transformer over a raw `HttpClient` (with `HttpClient.mapRequest` base-URL prefixing) for the keyless eCFR versioner client (`ApiAuth.NoAuth`). |

Both importers are grep-verifiable:
`rg -n "@beep/api-transport" packages/drivers/govinfo/src packages/drivers/ecfr/src`.

## Egress denial vocabulary

`EgressDenied` is a deliberately reason-free tagged error: a governed egress
boundary that refuses a destination tells the caller only THAT it refused —
the bounded denial reason stays with the refusing policy's own record keeping
and the server log, never the agent-facing channel. This package is its home
as shared transport *vocabulary*, not as an enforcement seam.

| Party | Package | Role |
| --- | --- | --- |
| Producer | `packages/epistemic/server` (**landed**, `agent-execution-authority` PR 6) | `GovernedEgressLive` installs a `FetchHttpClient.Fetch` that rejects a non-allowlisted destination with `EgressDenied` after appending its own write-ahead decision row to the execution ledger. |
| Consumer | `packages/ontology/server` (**landed**, `agent-execution-authority` PR 6) | The `ontology_publish_provenance` handler matches `EgressDenied` inside the `TransportError` cause and returns a typed refusal through its existing `failureMode: "return"` envelope — byte-identical to a tier-gate refusal, so a destination denial cannot be told apart from an operation denial. |

Neither side names the other; the binding happens at the app entrypoint
(`apps/professional-desktop/server/OntologyMcpTransport.ts`), which provides
the policy `fetch` via the `FetchHttpClient.Fetch` reference.

## Installation

```bash
bun add @beep/api-transport
```

## Usage

```ts
import { Effect } from "effect"
import * as RateLimiter from "effect/unstable/persistence/RateLimiter"
import { ApiAuth, makeApiTransport } from "@beep/api-transport"

const program = Effect.gen(function* () {
  const transport = yield* makeApiTransport({
    auth: ApiAuth.NoAuth(),
    key: "example",
    rateLimit: { limit: 1000, window: "1 hour" },
  })
  return transport.transformClient
}).pipe(Effect.provide(RateLimiter.layerStoreMemory))

void program
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

Unit tests stay outside `test/integration`; package integration tests live under `test/integration` and use `bun run test:integration`. Tests and dtslint files import package source through `@beep/api-transport` or other `@beep/*` aliases. Use relative imports only for local helpers, fixtures, and snapshots.

## License

MIT
