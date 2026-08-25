# @beep/codegen-kit

Shared OpenAPI/JSON Schema codegen kit: fetch, patch, generate via @effect/openapi-generator, post-process, format, drift-check

## Installation

```bash
bun add @beep/codegen-kit
```

## Usage

```ts
import { VERSION } from "@beep/codegen-kit"
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

Unit tests stay outside `test/integration`; package integration tests live under `test/integration` and use `bun run test:integration`. Tests import package source through `@beep/codegen-kit` or other `@beep/*` aliases. Use relative imports only for local helpers, fixtures, and snapshots.

## License

MIT
