# Firecrawl Driver

## Status

Pending implementation. Packet authored on 2026-06-04.

## Mission

Implement a robust `@beep/firecrawl` driver package that wraps the modern
Firecrawl v2 JavaScript SDK behind schema-first, Effect-first services,
technical error boundaries, fake/live Layers, watcher streams, documentation,
tests, and PR closure gates.

This packet is for implementation planning and execution. It does not implement
the driver itself.

## Reading Order

1. [GOAL.md](./GOAL.md) - direct `/goal` execution prompt.
2. [SPEC.md](./SPEC.md) - authoritative contract when it does not conflict
   with architecture doctrine.
3. [PLAN.md](./PLAN.md) - phased implementation path.
4. [research/firecrawl-sdk-inventory.md](./research/firecrawl-sdk-inventory.md)
   - required SDK/docs/source inventory.
5. [ops/manifest.json](./ops/manifest.json) - machine-readable routing and
   closure metadata.

For topology, package placement, boundary, error, observability, schema, and
documentation doctrine, the binding sources are `AGENTS.md`, `CLAUDE.md`,
loaded repo-local skills, `standards/ARCHITECTURE.md`,
`standards/architecture/*`, and `.patterns/jsdoc-documentation.md`.

## Target Topology

- Package name: `@beep/firecrawl`
- Package path: `packages/drivers/firecrawl`
- Family: flat repo-level `drivers`
- Packet path: `goals/firecrawl-driver`
- Scaffold command:

```sh
bun run create-package firecrawl --family drivers --description "Firecrawl driver package"
```

The package is a technical driver. It may wrap the Firecrawl SDK, expose safe
capabilities, define technical errors, build Layers, and provide fake/live test
Layers. It must not import product slices, product use-cases, product domain
models, UI, app runtime policy, or app-specific configuration.

## Current Research Snapshot

- Local Firecrawl clone: `/home/elpresidank/YeeBois/dev/firecrawl`
- Local clone commit: `42b46be4f75afbd88cd4161495345e94a04c3148`
- Local clone status observed during packet authoring: `main...origin/main`
  with untracked `.idea/`
- Local JS SDK path:
  `/home/elpresidank/YeeBois/dev/firecrawl/apps/js-sdk/firecrawl`
- Local SDK package manifest observed as `@mendable/firecrawl-js@4.25.2`
  depending on `firecrawl@4.16.0`
- Current npm `firecrawl` version observed on 2026-06-04: `4.25.2`
- Firecrawl v2 OpenAPI version observed: `v2`

The implementation agent must re-check these facts at implementation time and
record any drift before writing package code.

## V1 Cutline

In scope:

- Modern nondeprecated v2 SDK methods listed in [SPEC.md](./SPEC.md).
- Schema-first payload, success, and failure classes for every wrapped method.
- Effect service methods returning decoded success class values.
- Typed technical `FirecrawlError` variants in the Effect error channel.
- First-class watcher-as-stream wrapper with finalizer/interruption coverage.
- Fake SDK Layers, live env-gated Layers, unit tests, integration smoke tests,
  dtslint, docgen, export catalog refresh, quality closure, draft PR, CI
  babysitting, review response, and Greptile `5/5` readiness.

Out of scope:

- Deprecated v1 compatibility aliases.
- Deprecated scrape-browser aliases that forward to `interact` or
  `stopInteraction`.
- Maintenance-mode extract methods: `startExtract`, `getExtractStatus`,
  `extract`.
- Product policy, slice adapters, UI, app runtime wiring, or product-facing
  error language.

## Completion Standard

This packet is implementation-ready when a future `/goal` agent can run against
[GOAL.md](./GOAL.md), refresh the required inventory, scaffold
`packages/drivers/firecrawl`, implement the driver, prove local quality, open a
draft PR, babysit CI/reviews, retrigger Greptile until `5/5`, and mark the PR
ready without reopening package placement, method cutline, watcher semantics,
error model, schema policy, or closure criteria.
