# @beep/agents-server

Server adapter package for the agents slice. It hosts assistant-turn streaming
primitives — starting with the incremental block extractor (`scanChunk`) that
turns provider structured-output JSON deltas into completed block slices — and
the Layers that will wrap them.

## Surface

- `@beep/agents-server` exposes the `AssistantTurn` namespace for streaming
  helpers.
- `@beep/agents-server/AssistantTurn` exposes `ScanState`, `initialScanState`,
  and `scanChunk` directly.
- `@beep/agents-server/test` exposes deterministic test seeds.

## Usage

```ts
import { initialScanState, scanChunk } from "@beep/agents-server/AssistantTurn"

const envelope = JSON.stringify({ blocks: [{ type: "paragraph" }] })
const [, completed] = scanChunk(initialScanState, envelope)

console.log(completed)
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
bun run lint
```

Unit tests stay outside `test/integration`; package integration tests live under `test/integration` and use `bun run test:integration`. Tests import package source through `@beep/agents-server` or other `@beep/*` aliases. Use relative imports only for local helpers, fixtures, and snapshots.

The `scanChunk` extractor is property-test-proven: its slices are exactly the
envelope's elements regardless of how the structured-output text is chunked.

## License

MIT
