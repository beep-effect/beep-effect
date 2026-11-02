# @beep/party-domain

Party slice domain: deterministic PartyKey v1 and graduated identifier normalizers.

## Installation

```bash
bun add @beep/party-domain
```

## Usage

```ts
import * as Package from "@beep/party-domain"
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

Unit tests stay outside `test/integration`; package integration tests live under `test/integration` and use `bun run test:integration`. Tests import package source through `@beep/party-domain` or other `@beep/*` aliases. Use relative imports only for local helpers, fixtures, and snapshots.

## License

MIT
