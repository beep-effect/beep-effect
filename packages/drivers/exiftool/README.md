# @beep/exiftool

Driver-level native ExifTool wrapper for reading and writing image metadata and XMP provenance.

## Installation

```bash
bun add @beep/exiftool
```

## Usage

```ts
import { VERSION } from "@beep/exiftool"
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

Unit tests stay outside `test/integration`; package integration tests live under `test/integration` and use `bun run test:integration`. Tests import package source through `@beep/exiftool` or other `@beep/*` aliases. Use relative imports only for local helpers, fixtures, and snapshots.

## License

MIT
