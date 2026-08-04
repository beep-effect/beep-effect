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

## Live pffexport lane

The live integration lane is opt-in. It needs two things:

1. `pffexport` on `PATH` (Arch: `libpff`; Debian/Ubuntu: `libpff-utils`;
   Homebrew: `libpff`). The driver discovers it through typed config or PATH,
   so no test-only binary path is involved.
2. `BEEP_TEST_LIBPFF_PST` set to an absolute path to a PST file. When the
   variable is absent or blank, every test in the lane logs a skip notice and
   no-ops.

```bash
BEEP_TEST_LIBPFF_PST=/absolute/path/to/mailbox.pst bun run test:integration
```

### Canonical public fixture

PST files cannot be generated on Linux — libpff and libpst are read-only, and
authoring a PST requires MAPI — so the fixture for this lane is a public sample
the operator downloads. It is never committed to this repository.

| Field | Value |
| --- | --- |
| File | `testPST.pst` from the Apache Tika test corpus (Apache-2.0) |
| URL | <https://raw.githubusercontent.com/apache/tika/dc571dddba324485fdb6dc1d665163e56267d0fc/tika-parsers/tika-parsers-standard/tika-parsers-standard-modules/tika-parser-microsoft-module/src/test/resources/test-documents/testPST.pst> |
| Size | 2,302,976 bytes |
| SHA-256 | `f2a6b1d2cad00f574e3d1c1211c4b1c854d6526caea77213adc3da92b7813ae3` |

```bash
curl -fsSLo /tmp/testPST.pst \
  https://raw.githubusercontent.com/apache/tika/dc571dddba324485fdb6dc1d665163e56267d0fc/tika-parsers/tika-parsers-standard/tika-parsers-standard-modules/tika-parser-microsoft-module/src/test/resources/test-documents/testPST.pst
sha256sum /tmp/testPST.pst
BEEP_TEST_LIBPFF_PST=/tmp/testPST.pst bun run test:integration
```

The URL is pinned to a commit rather than `main` so the hash stays meaningful.

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

Unit tests stay outside `test/integration`; package integration tests live under `test/integration` and use `bun run test:integration`. Tests import package source through `@beep/libpff` or other `@beep/*` aliases. Use relative imports only for local helpers, fixtures, and snapshots.

## License

MIT
