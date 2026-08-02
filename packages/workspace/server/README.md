# @beep/workspace-server

Workspace server adapter package for workspace repositories, handlers, and Layers.

## Source-text provider

`@beep/workspace-server/SourceText` implements the product-neutral
`@beep/file-processing/SourceText` resolver over `WorkspaceVaultStore`. The
provider interprets opaque scope references as `workspace:<id>`, pins the
configured vault root for each request, rejects absolute and symlink-escaping
locators, and verifies source, extractor, and canonical-text versions before
returning complete text. `@beep/epistemic-server` is the initial consumer; the
professional desktop runtime is the application binding site for the provider,
file-processing service, workspace vault store, and platform Layers.

## Installation

```bash
bun add @beep/workspace-server
```

## Usage

```ts
import { VERSION } from "@beep/workspace-server"
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

Unit tests stay outside `test/integration`; package integration tests live under `test/integration` and use `bun run test:integration`. Tests and dtslint files import package source through `@beep/workspace-server` or other `@beep/*` aliases. Use relative imports only for local helpers, fixtures, and snapshots.

## License

MIT
