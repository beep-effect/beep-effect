# @beep/uspto-mcp

Thin MCP host wiring `@beep/uspto` through `@beep/mcp-kit`: credential-keyed
composition, the `api_key_required` envelope, and progressive field-tier
projection against USPTO's `documentBag`-shaped file-wrapper responses. One of
the two real `@beep/mcp-kit` consumers discharging the kit's
`foundation/capability` ≥2-consumer gate (alongside the
`mcp-host-retrofit`-landed `packages/drivers/nlp-mcp` and
`packages/drivers/m365-mcp`).

Exposes two stdio MCP tools:

- `uspto_search_applications` — searches USPTO patent applications by an Open
  Data Portal query expression; returns the kit's `api_key_required` envelope
  when `USPTO_API_KEY` is absent (the credential is `soft`-gated — the tool
  stays registered and degrades at call time rather than vanishing).
- `uspto_get_documents` — lists an application's file-wrapper documents,
  reshaped to the most complete named field tier (`minimal`/`balanced`/
  `complete`) that fits a configurable byte budget.

## Installation

```bash
bun add @beep/uspto-mcp
```

## Usage

Register the stdio entrypoint with an MCP client, pointing it at `bin.ts` via
`bun run`:

```ts
import { Layer } from "effect"
import { makeServerLayer, UsptoMcpServerConfig } from "@beep/uspto-mcp/Server"
import * as NodeStdio from "@effect/platform-node/NodeStdio"

const server = makeServerLayer(UsptoMcpServerConfig.make({ name: "beep-uspto", version: "0.0.0" })).pipe(
  Layer.provide(NodeStdio.layer)
)

void Layer.launch(server)
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

Unit tests stay outside `test/integration`; package integration tests live under `test/integration` and use `bun run test:integration`. Tests and dtslint files import package source through `@beep/uspto-mcp` or other `@beep/*` aliases. Use relative imports only for local helpers, fixtures, and snapshots.

## License

MIT
