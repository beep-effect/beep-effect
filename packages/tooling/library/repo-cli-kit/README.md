# @beep/repo-cli-kit

Repo-specific CLI helpers shared by the beep command tools: JSON and text codecs, process steps, artifacts, systemd units, package-script policy and the shared entry path.

## Installation

```bash
bun add @beep/repo-cli-kit
```

## Usage

```ts
import * as Package from "@beep/repo-cli-kit"
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

Unit tests stay outside `test/integration`; package integration tests live under `test/integration` and use `bun run test:integration`. Tests import package source through `@beep/repo-cli-kit` or other `@beep/*` aliases. Use relative imports only for local helpers, fixtures, and snapshots.

## License

MIT
