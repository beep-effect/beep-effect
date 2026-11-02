# @beep/party-domain

Party slice domain: deterministic PartyKey v1 and graduated identifier normalizers.

## Installation

```bash
bun add @beep/party-domain
```

## Usage

```ts
import { emailAddress } from "@beep/party-domain/Identifier"
import { partyKeyOf } from "@beep/party-domain/PartyKey"
import * as Effect from "effect/Effect"

const key = Effect.runSync(Effect.flatMap(emailAddress("Dana Example <Dana@EXAMPLE.test>"), partyKeyOf))
// pk:v1:<64 lowercase hex digits>, the same key as " dana@example.test "
```

- `@beep/party-domain/Identifier`: graduated identifier schemas, the
  shared normalizers and the graduating constructors.
- `@beep/party-domain/PartyKey`: PartyKey v1 bases, canonical bytes and
  keys.

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

Unit tests stay outside `test/integration`; package integration tests live under `test/integration` and use `bun run test:integration`. Tests import package source through `@beep/party-domain` or other `@beep/*` aliases. Use relative imports only for local helpers, fixtures, and snapshots.

## License

MIT
