# Agent Guide

`@beep/runpod` is the Effect-first Runpod REST API v1 driver: provider API
transport, generated OpenAPI models, typed driver errors, and Runpod
docs-index retrieval (`RunpodDocs` over docs.runpod.io/llms.txt).

Do not place infrastructure deployment policy here; infra consumers depend on
this driver, not the other way around.

`src/_generated/Runpod.models.gen.ts` and
`src/_generated/Runpod.operations.gen.ts` are generated from the checked-in
`openapi.json` by `scripts/generate.ts` — never hand-edit them.
