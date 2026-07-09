# Box Driver

## Status

Partially implemented; status was stale. Packet authored on 2026-06-04 as
"pending implementation", but as of 2026-07-08 `packages/drivers/box/src`
already ships a substantial surface: `Box.service.ts`, `Box.streaming.ts`,
generated operations/models (`_generated/Box.operations.gen.ts`,
`Box.models.gen.ts`), upload sessions
(`experimental/domain/entities/UploadSession`), folder operations, events, and
webhooks. Reconcile the remaining packet phases against actual source before
executing this packet (drift found during the
[`legal-document-intake`](../legal-document-intake/README.md) exploration,
which consumes this driver's write surface in its Box-sync phase).

## Mission

Implement a robust `@beep/box` driver that wraps the full `box-node-sdk` v10.11.1
surface behind schema-first, Effect-first services, technical error boundaries,
fake/live Layers, streaming surfaces, documentation, tests, and PR closure gates.

Because the Box surface is very large (~80 managers, ~305 methods, ~301 models),
the model and per-manager wrapper layers are **code-generated** from the SDK's
own TypeScript types; only config, errors, the service shell, and streaming are
hand-written.

This packet is for implementation planning and execution. It does not implement
the driver itself.

## Reading Order

1. [GOAL.md](./GOAL.md) — direct `/goal` execution prompt.
2. [SPEC.md](./SPEC.md) — authoritative contract when it does not conflict with
   architecture doctrine.
3. [PLAN.md](./PLAN.md) — phased implementation path.
4. [research/box-sdk-inventory.md](./research/box-sdk-inventory.md) — SDK/source
   inventory.
5. [ops/manifest.json](./ops/manifest.json) — machine-readable routing and
   closure metadata.

For topology, boundary, error, observability, schema, and documentation
doctrine, the binding sources are `AGENTS.md`, `CLAUDE.md`, loaded repo-local
skills, `standards/ARCHITECTURE.md`, `standards/architecture/*`, and
`.patterns/jsdoc-documentation.md`.

## Target Topology

- Package name: `@beep/box`
- Package path: `packages/drivers/box`
- Family: flat repo-level `drivers`
- Packet path: `goals/box-driver`
- Identity composer: `$BoxId` (already registered)

The package **already exists** (scaffolded on `feature/beep-box-driver`). Do not
re-run `create-package`. `Box.config.ts` and `Box.errors.ts` are implemented;
`Box.service.ts` is a stub and `Box.models.ts` is empty.

The package is a technical driver. It may wrap the Box SDK, generate and expose
safe capabilities, define technical errors, build Layers, and provide fake/live
test Layers. It must not import product slices, product use-cases, product domain
models, UI, app runtime policy, or app-specific configuration.

## Current Research Snapshot

- SDK: `box-node-sdk` `10.11.1`, installed at `node_modules/box-node-sdk`.
- Surface: 85 manager properties on `BoxClient`, ~305 async methods, ~301 schema
  files. 0 manager methods are currently `@deprecated`.
- The SDK is itself generated; interfaces are **camelCase**, every object carries
  `rawData`, Box uses **open enums** (`... | string`), and there is no runtime
  validation.
- Auth classes: `BoxDeveloperTokenAuth`, `BoxCcgAuth`, `BoxJwtAuth`, `BoxOAuth`;
  client constructed as `new BoxClient({ auth })`.
- Errors: `BoxApiError extends BoxSdkError` with
  `responseInfo.{statusCode,code,contextInfo,requestId,helpUrl}` — already
  mirrored by the existing `BoxError`.
- Non-JSON managers: `downloads`, `uploads`, `chunkedUploads`, `zipDownloads`,
  `events` (long-polling `EventStream`).

The implementation agent must re-verify these facts at implementation time and
record any drift before writing package code.

## V1 Cutline

In scope:

- Full non-deprecated SDK surface, generated per-method and grouped by manager.
- Generated schema-first models with **pragmatic generated fidelity**
  (`S.optionalKey`, open-enum unions, permissive decode).
- Effect service methods returning decoded success values; typed technical
  `BoxError` in the Effect error channel.
- First-class Effect streaming for `downloads`/`uploads`/`chunkedUploads`/
  `zipDownloads`/`events` (events as a finalizer-backed stream).
- Auth: developer-token + CCG Layers + `makeLayerFromClient` escape hatch.
- Fake SDK Layers, env-gated read-only live smokes, unit tests, schema/error/
  streaming tests, dtslint, docgen, export catalog refresh, a `DECISIONS.md`
  divergence record, quality closure, draft PR, CI babysitting, review response,
  and Greptile `5/5` readiness.

Out of scope:

- `@deprecated` SDK methods (generator logs any dropped).
- OAuth2 user-delegation and JWT App Auth config layers (deferred; reachable via
  `makeLayerFromClient`).
- Product policy, slice adapters, UI, app runtime wiring, or product-facing error
  language.

## Completion Standard

This packet is implementation-ready when a future `/goal` agent can run against
[GOAL.md](./GOAL.md), refresh the inventory, build the generator, generate and
hand-write the driver, prove local quality, record the schema-fidelity
divergence, open a draft PR, babysit CI/reviews, retrigger Greptile until `5/5`,
and mark the PR ready without reopening package placement, generation strategy,
schema-fidelity policy, service shape, streaming semantics, auth modes, error
model, or closure criteria.
