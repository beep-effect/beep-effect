# Box Driver

## Status

Lifecycle: `completed-retained`

Implementation complete. The full `@beep/box` driver shipped in merge commit
`f306e8ca5b`; P1-P9 are retained as completed historical execution phases.
Current generated artifacts expose 85 manager groups, 333 JSON operations, and
531 model schemas, with byte/event operations supplied by `Box.streaming.ts`.

> **Superseded mission framing (2026-08-01).** The "full-surface" framing below
> is historical. `goals/box-typecheck-cost` scopes the generated surface to
> declared demand (9 of 85 managers) because the full surface costs ~4.8M type
> instantiations in `Box.models.gen.ts` alone. That packet contradicts none of
> the 10 locked `keyDecisions` here — `generate-from-sdk-types` and
> `pragmatic-generated-fidelity` both continue to bind; only the generator's
> input scope changes.

## Mission

Implement a robust `@beep/box` driver that wraps the full `box-node-sdk` v10.11.1
surface behind schema-first, Effect-first services, technical error boundaries,
fake/live Layers, streaming surfaces, documentation, tests, and PR closure gates.

Because the Box surface is very large (85 manager groups, 333 generated JSON
operations, and 531 generated model schemas at HEAD),
the model and per-manager wrapper layers are **code-generated** from the SDK's
own TypeScript types; only config, errors, the service shell, and streaming are
hand-written.

This packet now records the completed implementation and its closure evidence.

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

The package exists and is fully implemented. `Box.config.ts`, `Box.errors.ts`,
`Box.service.ts`, `Box.streaming.ts`, and the generated model/operation files are
the shipped boundary; do not re-run `create-package`.

The package is a technical driver. It may wrap the Box SDK, generate and expose
safe capabilities, define technical errors, build Layers, and provide fake/live
test Layers. It must not import product slices, product use-cases, product domain
models, UI, app runtime policy, or app-specific configuration.

## Current Research Snapshot

- SDK: `box-node-sdk` `10.11.1`, installed at `node_modules/box-node-sdk`.
- Generated surface at HEAD: 85 manager groups, 333 JSON operations, and 531
  model schemas.
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

These are retained as the shipped artifact counts, not instructions for a new
implementation run.

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
  streaming tests, dtslint, docgen, a driver-level pragmatic-fidelity record,
  quality closure, draft PR, CI babysitting, review response,
  and the completed PR review/merge closure.

Out of scope:

- `@deprecated` SDK methods (generator logs any dropped).
- OAuth2 user-delegation and JWT App Auth config layers (deferred; reachable via
  `makeLayerFromClient`).
- Product policy, slice adapters, UI, app runtime wiring, or product-facing error
  language.

## Completion Standard

The implementation and review gates were completed by the work merged as
`f306e8ca5b`. The packet is ready for the external completed-retained status
flip after this bookkeeping reconciliation is verified.
