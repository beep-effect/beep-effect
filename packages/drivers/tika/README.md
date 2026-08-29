# @beep/tika

Apache Tika driver for product-neutral file detection, text extraction, and metadata extraction

## Installation

```bash
bun add @beep/tika
```

## Usage

```ts
import { makeTikaServerFileProcessingEngine, TikaServerEngineConfig } from "@beep/tika"
import { Effect } from "effect"

const program = Effect.gen(function* () {
  const engine = yield* makeTikaServerFileProcessingEngine(TikaServerEngineConfig.make({}))
  return engine.descriptor.version
})
```

The driver does not provide an `HttpClient` or `FileSystem` layer of its own —
live transport composition belongs to the consuming CLI, tooling, or server
package.

## Engine lanes

| Engine | Constructor | Transport | Notes |
| --- | --- | --- | --- |
| Tika Server | `makeTikaServerFileProcessingEngine` / `...FromEnv` | `PUT {baseUrl}/rmeta/text` over HTTP | Default V1 runner. Reports the runtime version probed from `GET /version`. |
| tika-app | `makeTikaAppFileProcessingEngine` | `java -jar tika-app.jar -J -t` subprocess | Alternate lane behind explicit config; reports no version. |
| P1 scaffold | `makeTikaFileProcessingEngine` | none (pass-through) | Retained for existing consumers; defers real extraction. |

All three translate failures through `tikaOperationError`, so no HTTP, process,
filesystem, or Tika error escapes as itself across the operation contract.

`docm`, `xls`, and `xlsx` are classified deterministically but intentionally
refuse extraction with a typed `unsupported-file-format` error in V1.

## Environment

| Variable | Purpose | Default |
| --- | --- | --- |
| `BEEP_TIKA_BASE_URL` | Tika Server base URL — http(s) only; trailing slashes stripped, query/fragment rejected | `http://localhost:9998` |
| `BEEP_TIKA_TIMEOUT_MILLIS` | Per-file extraction timeout | `120000` |
| `BEEP_TIKA_MAX_OUTPUT_BYTES` | Ceiling on the whole response body, metadata included | unbounded |
| `BEEP_TEST_TIKA_URL` | Opt-in live test lane target | unset (lane skips) |

Only `makeTikaServerFileProcessingEngineFromEnv` reads the `BEEP_TIKA_*` keys;
`BEEP_TEST_TIKA_URL` is read solely by `test/integration`, which logs a skip and
no-ops when it is unset.

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

Unit tests stay outside `test/integration`; package integration tests live under `test/integration` and use `bun run test:integration`. Tests import package source through `@beep/tika` or other `@beep/*` aliases. Use relative imports only for local helpers, fixtures, and snapshots.

## License

MIT
