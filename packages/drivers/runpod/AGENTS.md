# Agent Guide

`@beep/runpod` is the Effect-first Runpod REST API v2 driver
(`https://api.runpod.io/v2`): provider API transport, generated OpenAPI models,
typed driver errors with RFC 9457 problem details, and Runpod docs-index
retrieval (`RunpodDocs` over docs.runpod.io/llms.txt). Runpod retired REST API
v1 (`rest.runpod.io`) on 2026-11-15.

Do not place infrastructure deployment policy here; infra consumers depend on
this driver, not the other way around.

`src/_generated/Runpod.models.gen.ts` and
`src/_generated/Runpod.operations.gen.ts` are generated from the checked-in
`openapi.json` by `scripts/generate.ts` — never hand-edit them. Refresh the
schema from `https://api.runpod.io/v2/openapi.json`, then run
`bun run generate` and `bun run generate:check`.

Patches apply in two steps, in this order:

- `openapi.patch.json` holds hand-authored fixes: the JSON Schema 2020-12
  conditionals Effect's importer cannot read (`if`/`then`, `not`,
  `dependentRequired`; the server still enforces them) and the public
  `/v2/openapi.json` operation the published document does not list.
- `scripts/openapi.lowering.ts` derives the rest from the source: every
  `unevaluatedProperties: false` closure becomes a flattened closed object, so
  a v1 field name sent to v2 is a type error rather than a 422.

`scripts/operations.renderer.ts` strips the `/v2` prefix from every path,
derives authentication from `security`, and fails generation on an unlowered
closure, an unresolvable reference, or an export that collides with a model.
