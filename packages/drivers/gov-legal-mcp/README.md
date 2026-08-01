# @beep/gov-legal-mcp

Thin Effect-native MCP stdio host for the public `@beep/govinfo` and
`@beep/ecfr` drivers. The package is an `@beep/mcp-kit` consumer: transport,
authentication, retries, caching, and rate limiting stay in the drivers while
the host only declares tools, delegates handlers, applies source gates, and
serves MCP over stdio.

## Tools

| Tool | Upstream operation | Gate |
| --- | --- | --- |
| `govinfo_search` | GovInfo `search` | hard: `GOVINFO_API_KEY` |
| `ecfr_list_titles` | eCFR `listTitles` | none |
| `ecfr_search_results` | eCFR `searchResults` | none |
| `ecfr_get_structure` | eCFR `getStructure` | none |

All four tools explicitly advertise read-only, non-destructive, idempotent,
open-world hints. eCFR always mounts; GovInfo vanishes from tool discovery when
`GOVINFO_API_KEY` is absent.

## Collision contract

Tool wire names are normalized deterministically from each driver prefix and
upstream operation id. Names longer than 64 characters receive a SHA-256
prefix digest suffix. Duplicate normalized names or duplicate final wire names
fail closed before tool registration; registration order never resolves a
collision.

The checked-in report is generated offline and contains no timestamps or host
state:

```bash
bun run --cwd packages/drivers/gov-legal-mcp generate
```

## Installation

```bash
bun add @beep/gov-legal-mcp
```

## Usage

```ts
import { SERVER_CONFIG } from "@beep/gov-legal-mcp/bin"

console.log(SERVER_CONFIG.name)
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

Unit tests stay outside `test/integration`; package integration tests live under `test/integration` and use `bun run test:integration`. Tests and dtslint files import package source through `@beep/gov-legal-mcp` or other `@beep/*` aliases. Use relative imports only for local helpers, fixtures, and snapshots.

## License

MIT
