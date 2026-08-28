# OpenAI Driver (@beep/openai)

## Status

Lifecycle: `completed-retained`

Source: [`ops/manifest.json`](./ops/manifest.json)

## Mission

Ship `@beep/openai`, a new packages/drivers/openai workspace (spelled in prose
until it exists): a thin driver mirroring `@beep/anthropic` that composes
`@effect/ai-openai`'s shipped `OpenAiClient`, `OpenAiLanguageModel`, and
`OpenAiEmbeddingModel` behind typed config and errors, and exposes Layer
factories for both model kinds. No engine code.

Graduated from
[`explorations/semantica-lab`](../../explorations/semantica-lab/README.md)
(MAP v1.0 packet #2; DECISIONS S3-rev and M3). The consuming lab,
`semantica-canary`, needs this driver's `EmbeddingModel` Layer before its C1
stage (not before C0) so it can dimension-key its vector tables.

## Launch

Use this command for execution-capable sessions:

```text
/goal follow the instructions in goals/openai-driver/GOAL.md
```

`GOAL.md` is the compact launcher. `SPEC.md` remains the normative contract.

## Read This First

1. [`GOAL.md`](./GOAL.md) - compact `/goal` launcher.
2. [`SPEC.md`](./SPEC.md) - normative source of truth.
3. [`PLAN.md`](./PLAN.md) - active execution plan.
4. [`ops/manifest.json`](./ops/manifest.json) - machine-readable routing.
5. [`research/SOURCES.md`](./research/SOURCES.md) - pointer set into the
   source exploration, the Effect reference checkout, and the in-repo bricks.
6. Binding decisions S3, S3-rev, and M3:
   [`DECISIONS.md`](../../explorations/semantica-lab/DECISIONS.md).
7. [`history/`](./history/) - evidence and the closeout reflection, once they
   exist.

## Current Phase

P4 Close, complete. P0 re-verified the composition contract against
`@effect/ai-openai` 4.0.0-rc.112 and Effect reference `dd99ab007e`; P1
scaffolded and implemented the package; P2 completed the local proof and
quality-review loop; P3 published the single goal PR for hosted closeout.

## Latest Evidence

- [`history/2026-08-27-p0-research.md`](./history/2026-08-27-p0-research.md)
  records the upstream API proof, selected defaults, and scaffold result.
- `bun run --cwd packages/drivers/openai test`: 3 files and 12 tests passed.
- Package coverage: 100% statements, branches, functions, and lines.
- `bun run docgen:local -- --package @beep/openai`: 15 examples compiled.
- `bun run docgen:local -- --full`: 131 package docgen tasks and the generated
  documentation aggregate completed successfully.
- Exact-head `bun run beep yeet verify` passed at
  `2b82f9aaaf70a9252036d6650434d248a34fee02`: all 25 lanes were green,
  including build, typecheck, lint, unit, both integration waves, the JSDoc
  ratchet, and full docgen.
- The ten-role quality panel and its confirmation pass report zero required
  blockers.
- [PR #864](https://github.com/beep-effect/beep-effect/pull/864) contains the
  entire goal; its hosted closeout is monitored through Yeet.
- [`history/reflections/2026-08-27-codex.md`](./history/reflections/2026-08-27-codex.md)
  records the P4 closeout reflection.

## Notes

- Template weight (DECISIONS M3; precedent `goals/pretext-driver`): the
  template phase ladder, a plan close to the template, one reflection at
  close.
- The driver runs on its own PR beside the lab's C0 work; it has no dependency
  on the lab and the lab has no dependency on it until C1.
- `@beep/openai-compat` cannot host this: it is a hand-rolled
  `/chat/completions` protocol driver with no `@effect/ai` dependency and no
  embeddings surface, while the shipped `OpenAiEmbeddingModel` and
  `OpenAiLanguageModel` require `@effect/ai-openai`'s own `OpenAiClient`
  (`/responses`, `/embeddings`).
