# @beep/freshbooks

Schema-first Effect driver for the FreshBooks API

## Installation

```bash
bun add @beep/freshbooks
```

## Usage

```ts
import { Freshbooks, FreshbooksConfigInput, FreshbooksTokenStore } from "@beep/freshbooks"
import { Effect, Layer, Redacted } from "effect"

// Credentials resolve from the recorded 1Password references at runtime.
const layer = Freshbooks.makeLayer(
  FreshbooksConfigInput.make({
    clientId: "dev-client-id",
    clientSecret: Redacted.make("dev-client-secret"),
    redirectUri: "https://localhost:8443/callback",
  }),
).pipe(Layer.provide(FreshbooksTokenStore.layerMemory()))

const program = Effect.gen(function* () {
  const freshbooks = yield* Freshbooks
  const identity = yield* freshbooks.getIdentity
  return identity.businessMemberships
})
```

The token helper serializes FreshBooks' single-use refresh-token rotation behind one refresh owner. Read verbs cover identity, clients, invoices, and payments across the distinct `account_id` / `business_id` namespaces. Invoice-PDF retrieval is gated on the P0 endpoint-validation spike (see `goals/freshbooks-driver`) and is intentionally absent until its live half is validated.

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

Unit tests stay outside `test/integration`; package integration tests live under `test/integration` and use `bun run test:integration`. Tests import package source through `@beep/freshbooks` or other `@beep/*` aliases. Use relative imports only for local helpers, fixtures, and snapshots.

## License

MIT
