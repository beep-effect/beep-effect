# @beep/pretext

Driver-level text measurement and layout backed by
[@chenglou/pretext](https://github.com/chenglou/pretext): text measurement as
a typed, schema-first capability.

Two entrypoints map the purity boundary:

- **`@beep/pretext` (root, browser-safe pure surface):** versioned
  `FontMetricsSnapshotV1` contracts, codecs, pure greedy layout helpers over
  decoded snapshots (`naturalWidth`, `lineCount`, `textHeight`), the
  `PretextCapture` service contract, and fixture-backed test layers. No
  canvas, no DOM, no pretext import.
- **`@beep/pretext/browser` (impure capture):** the live `PretextCapture`
  layer measuring through pretext (`Intl.Segmenter` + Canvas 2D required;
  absence is a typed error), engine-profile detection, and a re-export of the
  root surface for client code.

Snapshots are per-engine values by design — never cross-machine
deterministic. Greedy first-fit semantics only. `system-ui` is rejected with
a typed error (upstream documents canvas/DOM divergence for it).

## Installation

```bash
bun add @beep/pretext
```

## Usage

Consumers test DOM-free against the fixture layer:

```ts
import { chromeLinuxArial16, lineCount, naturalWidth } from "@beep/pretext"
import * as Effect from "effect/Effect"
import * as O from "effect/Option"

const metrics = Effect.runSync(chromeLinuxArial16).metrics
const width = naturalWidth(metrics, "the dragon")                        // Option<number>
const lines = lineCount(metrics, { text: "the dragon", maxWidth: 320 }) // Option<number>
console.log(O.isSome(width), O.isSome(lines))
```

Browser code captures live metrics through the `/browser` entrypoint:

```ts
import { PretextCapture, PretextCaptureLive, PretextCaptureRequest } from "@beep/pretext/browser"
import * as Effect from "effect/Effect"

const capture = Effect.gen(function* () {
  const service = yield* PretextCapture
  return yield* service.captureFontMetrics(
    PretextCaptureRequest.make({ font: "16px Arial", lineHeight: 20, words: ["the", "dragon"] })
  )
})

const snapshot = capture.pipe(Effect.provide(PretextCaptureLive))
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

Unit tests stay outside `test/integration`; package integration tests live under `test/integration` and use `bun run test:integration`. Tests and dtslint files import package source through `@beep/pretext` or other `@beep/*` aliases. Use relative imports only for local helpers, fixtures, and snapshots.

## License

MIT
