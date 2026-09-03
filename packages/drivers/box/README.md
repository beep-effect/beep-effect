# @beep/box

Box driver package

## Installation

```bash
bun add @beep/box
```

## Usage

```ts
import { VERSION } from "@beep/box"
```

## Generated Surface

`@beep/box` wraps a **demand-scoped** slice of the Box SDK, not the full
86-manager installed `BoxClient` surface. Whole managers and individually
admitted operations are listed in
[`scripts/box.surface.ts`](./scripts/box.surface.ts), and `src/_generated/`
holds only those operations plus the model schemas transitively reachable from
them.

This is deliberate. Generating the full SDK surface cost ~4.8M TypeScript type
instantiations in `Box.models.gen.ts` alone (~7.5M package-wide) for a repo that
calls a small subset — mass that kept exposing the no-location TS2589
native-compiler flake in full proofs. The current 19-manager provisioning
surface measures 2,914,305 package-wide instantiations and 623,119 marginal
instantiations in `Box.models.gen.ts`. See
`goals/box-typecheck-cost/` for the decision record and measurements.

A method outside both manifest lists has no generated operation, so calling it
is a **compile error**, never a runtime failure.

### Adding demand

1. Add a `BoxClient` property name to `GENERATED_MANAGERS` when the whole
   manager is needed, or add a `manager.method` entry to
   `GENERATED_OPERATIONS` when the demand is narrower. Keep the selected list
   sorted by manager and note the demand.
2. Regenerate:

   ```bash
   bun run generate
   ```

3. **Re-measure and record the numbers in the PR.** Budget is ≤750K *marginal*
   instantiations for any single generated file (total minus the schema-import
   floor, currently 1,667,162 under tsgo 7.0.2+effect-tsgo.0.39.1) and ≤3M
   absolute package-wide. The exact recipe,
   the floor probe, and every prior measurement live in
   `goals/box-typecheck-cost/research/measurements.md`.

Re-measurement is a review obligation on manifest edits rather than a CI gate:
the two manifest lists are the only route through which generated mass can
grow.

The generator also skips `@deprecated` SDK methods and byte/event operations —
the latter are hand-written in `Box.streaming.ts` — and logs every dropped
manager, model, and method, so nothing is silently capped.

## Streaming Payload Schemas

Hand-written byte and event stream adapters export their payload contracts as
Effect Schema classes such as `BoxUploadFilePayload`,
`BoxCreateUserAvatarPayload`, and `BoxPartAccumulator`. These exports are both
runtime schema values and TypeScript types, so callers can decode unknown input,
derive tests, or keep using them as structural payload types.

Multipart upload request bodies mirror the generated Box SDK body shapes while
replacing raw byte fields with `BoxByteInput`, which accepts `Uint8Array`, Node
`Readable`, or Effect byte streams.

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

Unit tests stay outside `test/integration`; package integration tests live under `test/integration` and use `bun run test:integration`. Tests import package source through `@beep/box` or other `@beep/*` aliases. Use relative imports only for local helpers, fixtures, and snapshots.

## License

MIT
