# @beep/party-use-cases



Ports for contact ingestion and append-only party evidence. Implementations are
provided by the party server or the owning source package.

## Public ports

- `@beep/party-use-cases/Ledger` exports `PartyLedger`, `LedgerSnapshot` and
  `LedgerConflict`. The port allocates integer ids and stable source anchors,
  appends observations/assertions/claim versions, and exposes effective snapshots.
  A rejected batch must leave evidence state unchanged.
- `@beep/party-use-cases/ContactSource` exports `ContactSource` and its input
  schemas. Cards retain source namespace/id, raw emails, explicit shared-address
  flags, phone country context and source-owned context roles. Rich sources may
  supply already-graduated identifiers.

```ts
import { ContactSource } from "@beep/party-use-cases/ContactSource"
import * as Layer from "effect/Layer"
import * as Stream from "effect/Stream"

const emptySource = Layer.succeed(
  ContactSource,
  ContactSource.of({ cards: Stream.empty })
)
```

Each source subscription starts a fresh read. Source failures carry log-safe
reasons. The source adapter owns its vocabulary; this package does not interpret
client numbers, matters or legal roles. The law-practice adapter consumes this
public port without importing party domain or server directly.

Anchor allocation is separate from accepted identity. Allocating an integer for
a source key does not establish a `SameParty` or accepted `KeyAssignment` claim.
The supplied memory implementation guarantees anchor stability only within its
ledger instance; durable allocation and storage are outside this slice's scope.

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

Unit tests stay outside `test/integration`; package integration tests live under `test/integration` and use `bun run test:integration`. Tests import package source through `@beep/party-use-cases` or other `@beep/*` aliases. Use relative imports only for local helpers, fixtures, and snapshots.

## License

MIT
