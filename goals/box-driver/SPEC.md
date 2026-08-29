# Box Driver Specification

## Status

**IMPLEMENTED AND MERGED**

Created on 2026-06-04 as a packet-authoring pass. The full-surface `@beep/box`
driver subsequently shipped in merge commit `f306e8ca5b`; this specification is
retained as the historical implementation contract.

## Owner

@beep-team

## Purpose

The repository needs a robust Box technical driver so product slices and app
adapters can consume Box content management (files, folders, uploads/downloads,
search, shared links, collaborations, metadata, tasks, webhooks, trash, sign
requests, hubs, AI, retention, legal holds, shield, and the rest of the Box
platform) without depending directly on the raw `box-node-sdk`, thrown SDK
errors, raw API failures, or unbounded external wire shapes.

`@beep/box` is not product language. It is a dev-safe wrapper around an external
SDK and service. The HEAD artifacts contain 85 manager groups, 333 generated
JSON operations, and 531 generated model schemas, so the model and wrapper
layers are **code-generated** from the SDK's own TypeScript types rather than
hand-written.

## Architecture Contract

`@beep/box` lives in the flat repo-level `drivers` family:

```txt
packages/drivers/box -> @beep/box
```

This follows the binding rule that external SDKs, services, engines, frameworks,
and browser platform wrappers belong in `drivers/*` (`07-non-slice-families.md`,
`03-driver-boundaries.md`).

The driver may:

- wrap `box-node-sdk` v10.11.1;
- generate and expose schema-first models and per-manager service methods;
- define technical driver errors (`BoxError`);
- provide live and fake Layers;
- provide read-only live smoke tests gated by `CLOUD_BOX_TOKEN`;
- expose binary/streaming surfaces (downloads, uploads, chunked uploads, zip
  downloads, events) as Effect-native streams.

The driver must not:

- import product slices, product use-cases, product domain models, shared
  product language, UI, apps, app-local runtime wiring, or product policy
  (`03-driver-boundaries.md`: only `server` and `tables` may import drivers);
- translate technical Box failures into product-facing action errors
  (`09-errors-across-boundaries.md`: driver/internal errors die at the boundary);
- log or trace tokens, raw request bodies, raw file content, raw PII, or
  unbounded user input (`12-observability.md`);
- expose `@deprecated` SDK methods in the generated surface.

Application policy belongs in consumers. Product-facing consumers translate
technical `BoxError` values at their adapter or use-case boundary.

## Source Hierarchy

Implementation must read sources in this order:

1. User objective captured in this packet.
2. Repo instructions: `AGENTS.md`, `CLAUDE.md`, and loaded skills.
3. Architecture standards:
   - `standards/ARCHITECTURE.md`
   - `standards/architecture/03-driver-boundaries.md`
   - `standards/architecture/06-configuration-boundaries.md`
   - `standards/architecture/07-non-slice-families.md`
   - `standards/architecture/09-errors-across-boundaries.md`
   - `standards/architecture/12-observability.md`
4. Documentation standards:
   - `.patterns/jsdoc-documentation.md`
5. Generated-driver precedents (the closest model for this work):
   - `packages/drivers/runpod` (custom generator + `S.Class` `_generated`)
   - `packages/drivers/acp` (`@effect/openapi-generator` + `_generated`)
6. Hand-written driver precedents (service/error/test patterns):
   - `packages/drivers/firecrawl`
7. Box SDK source (the generation INPUT and runtime dependency):
   - `node_modules/box-node-sdk/lib/index.d.ts`
   - `node_modules/box-node-sdk/lib/client.d.ts`
   - `node_modules/box-node-sdk/lib/managers/*.d.ts`
   - `node_modules/box-node-sdk/lib/schemas/*.d.ts`
   - `node_modules/box-node-sdk/lib/box/errors.d.ts`
   - `node_modules/box-node-sdk/lib/box/eventStream.d.ts`
8. Box references:
   - `https://developer.box.com/reference/`
   - `https://github.com/box/box-node-sdk`

Current architecture doctrine outranks older packet prose and current code drift.

## Required Skills

The implementation agent must use these repo-local skills or record any
unavailable path and continue with the closest repo-native fallback:

- `$grill-with-docs`
- `$effect-first-development`
- `$schema-first-development`
- `$jsdoc-annotation-specialist`
- `$quality-review-fix-loop`
- `github:yeet`
- `github:gh-fix-ci`
- `github:gh-address-comments`

During packet authoring on 2026-06-04, `$grill-with-docs` was loaded and used to
resolve the design decisions below.

## Package State

The package is implemented; **do not** re-run `create-package`. Shipped state:

- `packages/drivers/box/src/Box.config.ts` — developer-token and CCG config
  models plus configuration Layers.
- `packages/drivers/box/src/Box.errors.ts` — sanitized typed `BoxError`
  translation.
- `packages/drivers/box/src/Box.service.ts` — the Effect service and
  developer-token, CCG, and client-injection Layers.
- `packages/drivers/box/src/Box.streaming.ts` — hand-written byte/event
  adapters.
- `packages/drivers/box/src/Box.models.ts` — public generated-model re-export.
- `packages/drivers/box/src/_generated/Box.models.gen.ts` and
  `Box.operations.gen.ts` — 531 model schemas and 333 JSON operations across 85
  manager groups.
- `package.json` already depends on `box-node-sdk` (`catalog:`) and `@beep/identity`,
  `@beep/schema`. `$BoxId` is registered in `@beep/identity`.

## SDK Dependency Decision

Use the installed `box-node-sdk` v10.11.1. Box's v10 SDK is itself generated
(`sdk-gen`) from the Box OpenAPI spec; it exposes camelCase TypeScript
interfaces with `serialize`/`deserialize` helpers and a `rawData` passthrough,
and performs no runtime validation.

Generate the driver's schemas from the SDK's own `.d.ts`, **not** from the
upstream snake_case Box OpenAPI spec, so decoded schemas match the camelCase
shape the SDK actually returns. The generated surface is version-locked to the
installed SDK; the generator must be re-run when the SDK is upgraded.

## Generation Requirements

A custom generator at `packages/drivers/box/scripts/generate.ts` (runpod
precedent) must:

- read `box-node-sdk` `.d.ts` (managers + schemas) from `node_modules`;
- emit models to `src/_generated/Box.models.gen.ts` and per-manager wrappers to
  `src/_generated/Box.operations.gen.ts`;
- keep `_generated/` internal via package `exports` (`"./_generated/*": null`);
- skip `@deprecated` methods and skip non-JSON methods (returning `ByteStream`,
  `EventStream`, or `undefined`), and **log the dropped lists** (no silent caps);
- add per-export `/** @since @category @example */` JSDoc to generated exports
  (docgen requires it; biome already ignores `*.gen.*`);
- be idempotent: a clean re-run produces no diff;
- run a `biome check --write src/_generated/*.gen.ts` post-pass.

Wire `"generate"`/`"codegen"` scripts into `package.json`.

## Schema Requirements

Use `$schema-first-development`. Generated schemas are the source of truth for
Box wire shapes.

Generated model policy (**pragmatic generated fidelity** — a documented
divergence from firecrawl's hand-crafted Option bar):

- each SDK interface becomes `S.Class<T>($I\`T\`)({...}, $I.annote("T", {...}))`;
- optional fields use `S.optionalKey` (NOT `Option`);
- open enums (`'a' | 'b' | ... | string`) become
  `S.Union([LiteralKit([...known]), S.String])` so unknown values still decode;
- closed literal unions use `LiteralKit`;
- decoding is **permissive**: excess properties and `rawData` are ignored so SDK
  upgrades that add fields do not break decode;
- each non-class schema export pairs with a same-name runtime type alias.

This divergence is justified by scale (531 generated model schemas at HEAD),
Box's open-enum/field evolution, and the runpod generated precedent. It remains
a driver-level implementation decision; it was judged not to meet the bar for
an architecture-wide `standards/architecture/DECISIONS.md` entry.

Truly unrepresentable dynamic shapes must be constrained with the narrowest safe
schema (`S.Record(S.String, S.Unknown)` or `S.Unknown`) and documented in the
inventory, never left as `any`.

## Effect Service Requirements

Use `$effect-first-development` and the firecrawl service pattern.

The package must expose an Effect service boundary around the Box SDK:

- Use `Context.Service` and Layers; use the package identity composer `$BoxId`.
- The service value mirrors the SDK managers: per-method wrappers grouped by
  manager (`box.files.getFileById(payload)`), merged with the hand-written
  streaming wrappers.
- A single shared `runSdkCall` helper performs: decode payload → invoke SDK via
  `Effect.tryPromise` → decode success → `Effect.tapError` diagnostics →
  `Effect.withSpan("box.<method>")`.
- Read secrets through Effect `Config` and `Redacted`; never `process.env` in
  service logic.
- Never leak thrown SDK errors or raw thrown values across the service boundary.
- Return decoded success values; fail with typed technical `BoxError` values.

`BoxError` (already defined) must gain translation factories
(`fromUnknown(method, cause)`, `fromReason(...)`) that map `BoxApiError` /
`BoxSdkError` / arbitrary thrown values into a sanitized `BoxError` carrying
method name, status, and decoded failure context — without embedding tokens, raw
request bodies, raw file content, or unbounded user input. Add a `BoxMethodName`
`LiteralKit` and an error-reason `LiteralKit` (firecrawl `Firecrawl.errors.ts`
pattern).

## Streaming Requirement

The non-JSON managers do not fit the JSON decode path and are hand-written in
`packages/drivers/box/src/Box.streaming.ts`:

- `downloads` / `zipDownloads` — return `Stream.Stream<Uint8Array, BoxError>`;
- `uploads` / `chunkedUploads` — accept byte input (`Stream` or bytes) and return
  decoded JSON envelopes;
- `events.getEventStream()` — wrap the long-polling `EventStream` as an Effect
  `Stream` of decoded events using `Stream.callback` + `Effect.acquireRelease`
  so finalizers close the underlying `EventStream` on completion or interruption
  (the direct analog of firecrawl's first-class watcher stream).

Raw byte bodies are not schema-decoded; only JSON envelopes are.

## Auth And Configuration Requirements

Extend `Box.config.ts` while keeping `06-configuration-boundaries.md` boundaries
(secrets via `Redacted`, technical knobs only, never logged):

- keep the developer-token live `layer` reading `CLOUD_BOX_TOKEN` →
  `BoxDeveloperTokenAuth`;
- add a CCG (Client Credentials Grant) config + layer
  (`BoxCcgAuth`: `clientId`, `clientSecret`, optional `enterpriseId`/`userId`);
- add `makeLayerFromClient(client)` so callers can inject any pre-authenticated
  `BoxClient` (covering OAuth2 / JWT App Auth, which are otherwise deferred).

OAuth2 user-delegation and JWT App Auth config layers are out of V1 scope and
must be documented as deferred.

## Observability, Logging, And Tracing

- Technical span names: `box.<method>` (e.g. `box.getFileById`,
  `box.searchForContent`, `box.events.stream`).
- Low-cardinality, sanitized attributes: method name, manager, SDK version,
  status. NO domain-semantic attributes (`12-observability.md`).
- No tokens, raw request bodies, raw file content, raw PII, or unbounded input
  in spans/logs.
- Logs only for noteworthy diagnostics: retries, fallbacks, dropped technical
  details, decoded API failures.

## Documentation Requirements

Use `$jsdoc-annotation-specialist`.

- JSDoc/TSDoc for every exported schema (including generated), service, Layer,
  error, helper, and public type.
- Meaningful examples using the `@beep/box` package alias, not relative imports
  into workspace `src`.
- Schema annotations via `$I.annote`/`$I.annoteSchema` with quality
  descriptions, identifiers, examples, and category/since metadata per
  `.patterns/jsdoc-documentation.md`.
- Docs explain `@beep/box` is a technical Box driver, not a product/domain
  package.
- No `@template`, no type blobs in tags, no `@module`, no examples using `any`,
  type assertions, or deprecated `@effect/schema` imports.
- If `docgen:local` cannot process the generated surface at scale, decide
  whether to exclude `_generated/**` in `docgen.json` and how that interacts
  with the jsdoc inventory; record the decision.

## Testing Requirements

Use `@effect/vitest` best practices.

Required tests:

- Unit tests with a deterministic fake `BoxClient` Layer for representative
  wrapped methods.
- Error translation tests: SDK throws / `BoxApiError` → sanitized `BoxError`.
- Schema decoding tests, including tolerance of unknown fields and unknown
  open-enum values (proving permissive decode + open-enum unions).
- Streaming tests: download `Stream`, events `Stream` emission, and
  interruption/finalizer coverage.
- dtslint tests for public API, service method return types, schema-derived
  types, and `@beep/box` package-alias imports.
- Env-gated read-only live integration smoke tests using `CLOUD_BOX_TOKEN`.

Live tests must be read-only and low-cost:

- Prefer `users.getUserMe` and `folders.getFolderById("0")` (root folder).
- Skip cleanly when `CLOUD_BOX_TOKEN` is absent.
- No create/update/delete in CI.

## Quality And PR Closure Requirements

Use `$quality-review-fix-loop` before PR readiness.

```sh
bunx turbo run check test lint type-test --filter=@beep/box
bunx turbo run test:integration --filter=@beep/box
bun run docgen:local
bun run lint:fix
bun run audit:github quality
```

Required PR behavior:

- Use branch `feature/beep-box-driver` (already current).
- Commit packet-only work with `feat: add box driver goal packet`.
- Commit implementation work with `feat: add box driver`.
- Open a draft PR after local quality is green.
- Use GitHub skills to babysit CI and review threads.
- After each follow-up commit, comment `@greptileai`, wait for the review, parse
  and report the score, and continue until Greptile reports `5/5`. Mark ready
  only after CI is green, actionable comments are resolved, and Greptile is
  `5/5`.

## Stop Conditions

Stop and report exact evidence if:

- `box-node-sdk` `.d.ts` shapes make a method or model unmodelable after
  reasonable generator effort.
- Live integration tests would incur unexpected cost or destructive side effects.
- `docgen:local` cannot process the generated surface and the exclusion/inventory
  tradeoff needs a human decision.
- A CI failure is unrelated and cannot be reproduced locally after reasonable
  investigation.
- Greptile cannot be triggered or its score cannot be observed after documented
  attempts.
