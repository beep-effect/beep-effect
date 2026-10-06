# @beep/pdf-tools

Driver-level wrappers for rsvg-convert and poppler (pdftoppm) plus PDF structure inspection.

## Installation

```bash
bun add @beep/pdf-tools
```

## Usage

```ts
import { VERSION } from "@beep/pdf-tools"
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

Unit tests stay outside `test/integration`; package integration tests live under `test/integration` and use `bun run test:integration`. Tests import package source through `@beep/pdf-tools` or other `@beep/*` aliases. Use relative imports only for local helpers, fixtures, and snapshots.

## License

MIT
