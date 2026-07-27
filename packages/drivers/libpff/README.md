# @beep/libpff

libpff driver for product-neutral PST archive export

## Installation

```bash
bun add @beep/libpff
```

## Usage

```ts
import { makePffexportFileProcessingEngine, PffexportEngineConfig } from "@beep/libpff"
import { Effect } from "effect"

const engine = Effect.gen(function* () {
  return yield* makePffexportFileProcessingEngine(
    PffexportEngineConfig.make({ exportRoot: "/tmp/pst-out" })
  )
})
```

The pffexport engine discovers the executable through typed config or PATH,
probes `pffexport -V` once to report the engine version, walks every
mode-derived target tree (`.export` / `.orphans` / `.recovered`), assembles a
deterministic `Message.eml` child artifact per exported mail item, and writes
`<source-artifact-id>.messages.jsonl` records that preserve
folder/message/body/attachment relationships through `@beep/file-processing`
artifact schemas. All failures stay typed: `LibpffError` inside the driver,
`FileProcessingOperationError` at the engine boundary.

The live integration lane is opt-in: point `BEEP_TEST_LIBPFF_PST` at a real
PST (for example an EDRM Enron sample) and run `bun run test:integration`. No
PST binary is committed to this repository.

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

Unit tests stay outside `test/integration`; package integration tests live under `test/integration` and use `bun run test:integration`. Tests and dtslint files import package source through `@beep/libpff` or other `@beep/*` aliases. Use relative imports only for local helpers, fixtures, and snapshots.

## License

MIT
