# Box Driver Plan

This plan records the completed execution of [SPEC.md](./SPEC.md). It finished
the scaffolded flat `drivers` package by building a custom generator over
`box-node-sdk`'s own TypeScript types, generating schema-first models +
per-manager wrappers, hand-writing config/errors/service/streaming, and carrying
the PR through CI, review, Greptile, and readiness.

## P0: Packet Bootstrap

Status: completed by this packet.

Goal: Record package placement, generation strategy, schema-fidelity policy,
service shape, streaming semantics, auth modes, error model, test expectations,
quality lane, and PR closure rules.

Exit Criteria:

- [x] `README.md`, `SPEC.md`, `PLAN.md`, `GOAL.md`,
  `research/box-sdk-inventory.md`, and `ops/manifest.json` exist.
- [x] The packet targets `@beep/box` at `packages/drivers/box` and records that
  it is already scaffolded.
- [x] The packet records the nine locked decisions (generate-from-SDK-types,
  per-manager service, pragmatic fidelity, streaming, auth, exclude-deprecated,
  generated layout, read-only live smokes, closure gate).
- [x] The packet includes the schema-fidelity divergence, quality review, PR
  babysitting, and Greptile `5/5`; the divergence remained a driver-level
  decision rather than an architecture-wide `DECISIONS.md` entry.

Required Checks:

```sh
jq . goals/box-driver/ops/manifest.json
rg -n "@beep/box|packages/drivers/box|box-node-sdk|_generated|runSdkCall|CCG|greptile|5/5" goals/box-driver
git diff --check
```

## P1: Refresh Box SDK Inventory

Status: completed.

Goal: Re-verify the `box-node-sdk` surface before writing the generator.

Result: the shipped generated artifacts contain 85 manager groups, 333 JSON
operations, and 531 model schemas.

Implementation Steps:

1. Load required skills (SPEC "Required Skills").
2. Record `box-node-sdk` installed version (`node_modules/box-node-sdk/package.json`).
3. Re-count manager properties on `BoxClient` (`lib/client.d.ts`), async methods
   across `lib/managers/*.d.ts`, and schema files in `lib/schemas`.
4. Re-confirm `@deprecated` method count and list any found.
5. Re-confirm the non-JSON method return types (`ByteStream`, `EventStream`,
   `undefined`) across `downloads`, `uploads`, `chunkedUploads`, `zipDownloads`,
   `events`.
6. Re-confirm auth classes and the `BoxApiError` field shape vs `BoxError`.
7. Update `research/box-sdk-inventory.md` with current evidence and any drift.

Exit Criteria:

- [x] Inventory records installed version, counts, deprecated list, non-JSON
  methods, auth classes, error-field mapping, open-enum/`rawData` notes, and
  drift.

Stop Conditions:

- SDK `.d.ts` shapes make the method surface ambiguous.

## P2: Build Generator And Package Wiring

Status: completed.

Goal: Create `packages/drivers/box/scripts/generate.ts` and wire the package.

Implementation Steps:

1. Study `packages/drivers/runpod/scripts/generate.ts` (TS AST → `S.Class`
   output) and `packages/drivers/acp/scripts/generate.ts`.
2. Build the generator to read `box-node-sdk` `.d.ts` and emit:
   - `src/_generated/Box.models.gen.ts` (S.Class per interface);
   - `src/_generated/Box.operations.gen.ts` (per-manager grouped wrappers calling
     a shared `runSdkCall`).
3. Apply pragmatic fidelity: `S.optionalKey`; open enums →
   `S.Union([LiteralKit([...]), S.String])`; drop `rawData`; permissive decode;
   per-export JSDoc; same-name type aliases.
4. Skip `@deprecated` and non-JSON methods; `log()` the dropped lists.
5. Add `"generate"`/`"codegen"` scripts; add `"./_generated/*": null` to both
   `exports` maps in `package.json`.
6. Run an idempotent re-run and a `biome check --write src/_generated/*.gen.ts`
   post-pass.

Exit Criteria:

- [x] Generator produces `_generated/` with no diff on a clean re-run.
- [x] `_generated/` is internal (not in the public `exports` surface).
- [x] Dropped `@deprecated`/non-JSON method lists are logged.

Required Checks:

```sh
bun run --cwd packages/drivers/box generate
bunx turbo run check lint --filter=@beep/box
```

## P3: Generate Models And Operations

Status: completed.

Goal: Commit the generated artifacts and confirm they typecheck.

Implementation Steps:

1. Run the generator; inspect a sample of generated models/operations for
   fidelity (open enums, optionality, nested types, `DateTime`).
2. Iterate the generator on any unmodelable shapes (constrain to `S.Unknown` /
   `S.Record(S.String, S.Unknown)` and document).
3. Replace `Box.models.ts` with `export * from "./_generated/Box.models.gen.ts"`.

Exit Criteria:

- [x] Generated models + operations typecheck under `@beep/box`.
- [x] Any constrained dynamic shapes are documented in the inventory.

Required Checks:

```sh
bunx turbo run check --filter=@beep/box
```

## P4: Hand-Written Config And Errors

Status: completed.

Goal: Extend config (CCG + escape hatch) and errors (translation factories).

Implementation Steps:

1. Extend `Box.config.ts`: keep the dev-token `layer` (`CLOUD_BOX_TOKEN` →
   `BoxDeveloperTokenAuth`); add a CCG config + layer (`BoxCcgAuth`); add
   `makeLayerFromClient(client)`. Secrets via `Redacted`.
2. Extend `Box.errors.ts`: add `BoxMethodName` `LiteralKit`, error-reason
   `LiteralKit`, and `fromUnknown(method, cause)` / `fromReason(...)` factories
   translating `BoxApiError`/`BoxSdkError`/thrown values into sanitized
   `BoxError` (method, status, decoded failure context; no secrets/raw bodies).

Exit Criteria:

- [x] No direct `process.env` reads; secrets use `Config`/`Redacted` and are not
  logged.
- [x] Error factories never embed tokens, raw bodies, or unbounded input.

Required Checks:

```sh
bunx turbo run check lint --filter=@beep/box
```

## P5: Effect Service And Layers

Status: completed.

Goal: Wrap the generated operations behind a typed Effect service boundary.

Implementation Steps:

1. Build `Box` with `Context.Service`; its value merges the generated per-manager
   wrappers with the streaming wrappers (P6).
2. Implement the shared `runSdkCall` (decode payload → `Effect.tryPromise` SDK
   call → decode success → `Effect.tapError` log → `Effect.withSpan("box.<method>")`).
3. Build SDK construction from decoded config; add `makeLayer`, live `layer`, and
   `makeLayerFromClient` (test/escape-hatch).
4. Add technical spans/logs with sanitized low-cardinality attributes.

Exit Criteria:

- [x] No raw SDK result or raw thrown value crosses the service boundary.
- [x] Service root remains product-neutral and server-oriented by default.

Required Checks:

```sh
bunx turbo run check test lint --filter=@beep/box
```

## P6: Streaming Surfaces

Status: completed.

Goal: Hand-write the non-JSON managers as Effect-native streams in
`Box.streaming.ts`.

Implementation Steps:

1. `downloads` / `zipDownloads` → `Stream.Stream<Uint8Array, BoxError>`.
2. `uploads` / `chunkedUploads` → accept byte/`Stream` input; return decoded JSON
   envelopes.
3. `events.getEventStream()` → `Stream.callback` + `Effect.acquireRelease` so
   finalizers close the `EventStream` on completion/interruption; decode events
   into a tagged union.

Exit Criteria:

- [x] Streaming methods return Effect `Stream`/decoded values, never raw SDK
  streams.
- [x] Fake-source tests prove events ordering, decode failure, and interruption
  cleanup.

Required Checks:

```sh
bunx turbo run test --filter=@beep/box
```

## P7: Tests, Docs, And Live Smoke

Status: completed.

Goal: Prove runtime behavior, public API types, documentation, and read-only live
integration.

Implementation Steps:

1. Deterministic fake `BoxClient` tests with `@effect/vitest`.
2. Schema decode tests, incl. unknown-field + unknown open-enum-value tolerance.
3. Error translation + sanitization tests.
4. Streaming tests with fake event emission + finalizer coverage.
5. dtslint tests for public service return types and schema-derived types via
   `@beep/box`.
6. Env-gated read-only live smokes (`users.getUserMe`,
   `folders.getFolderById("0")`) that skip cleanly without `CLOUD_BOX_TOKEN`.
7. JSDoc for every public export (incl. generated); package docs explain the
   technical driver boundary.

Exit Criteria:

- [x] Tests skip cleanly without `CLOUD_BOX_TOKEN`; no mutation in CI.
- [x] All examples compile under docgen; dtslint imports through `@beep/box`.

Required Checks:

```sh
bunx turbo run test type-test --filter=@beep/box
bunx turbo run test:integration --filter=@beep/box
bun run docgen:local
```

## P8: Driver Decision, Package Exports, And Local Quality Closure

Status: completed.

Goal: Retain the schema-fidelity decision at driver scope, refresh exports, and
reach repo quality green.

Implementation Steps:

1. Keep pragmatic generated fidelity documented at the driver boundary. The
   shipped decision was judged not to meet the architecture-wide decision-log
   bar, so no `standards/architecture/DECISIONS.md` entry was added.
2. Refresh the package exports and documentation surfaces.

3. Run focused package gates and repo closure:

```sh
bunx turbo run check test lint type-test --filter=@beep/box
bunx turbo run test:integration --filter=@beep/box
bun run lint:fix
bun run audit:github quality
```

4. Use `$quality-review-fix-loop` until zero required blockers remain in changed
   scope; record unrelated failures separately with reproduction evidence.

Exit Criteria:

- [x] Package gates and docgen were green for the merged implementation.
- [x] Driver-level pragmatic-fidelity rationale is retained without an
  architecture-wide decision-log entry.
- [x] PR quality and review gates completed before merge.

## P9: Commit, PR, CI, Review, Greptile

Status: completed.

Goal: Publish a focused draft PR and carry it to final readiness.

Implementation Steps:

1. Use `github:yeet` for scope review, commit, push, and draft PR.
2. Branch `feature/beep-box-driver` (already current).
3. Commit packet work with `feat: add box driver goal packet`; implementation
   work with `feat: add box driver`.
4. Use `github:gh-fix-ci` to inspect/fetch/fix failing checks and push follow-ups.
5. Use `github:gh-address-comments` to resolve actionable review threads.
6. After each follow-up commit, comment `@greptileai`; wait, parse/report the
   score, and continue until `5/5`.
7. Mark ready only after CI is green, actionable comments are resolved, and
   Greptile reports `5/5`.

Stop Conditions:

- GitHub CLI authentication is unavailable.
- CI failure is unrelated and cannot be reproduced locally after reasonable
  investigation.
- Greptile cannot be triggered or its score cannot be observed after documented
  attempts.
