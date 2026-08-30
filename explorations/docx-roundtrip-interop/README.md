# DOCX Round-Trip Interop

## Status

<!-- BEGIN GENERATED: EXPLORATION STATUS -->
Stage: `graduate`
Status: `graduated`
<!-- END GENERATED: EXPLORATION STATUS -->

Source: [`ops/manifest.json`](./ops/manifest.json)

## Spark

The original document-editor conversation started from a patent-compliant
DOCX editor, but the immediate useful problem is narrower: prove the AST-level
DOCX round-trip path before building UI, Tauri sidecars, product semantics, or
patent-specific nodes.

## Next Open Question

None - first vertical slice graduated into
[`pandoc-ast-foundation`](../../goals/pandoc-ast-foundation/README.md);
driver, fixture-pipeline, and document-AST decision follow-ons remain named in
[`MAP.md`](./MAP.md).

## Read This First

1. [`ops/manifest.json`](./ops/manifest.json) - machine state: stage, status, open questions.
2. [`CAPTURE.md`](./CAPTURE.md) - raw dump (stage 0).
3. [`RESEARCH.md`](./RESEARCH.md) - prior art + capability inventory (stage 1).
4. [`DECISIONS.md`](./DECISIONS.md) - grilling log (stage 2).
5. [`BRIEF.md`](./BRIEF.md) - shaped pitch (stage 3).
6. [`MAP.md`](./MAP.md) - decomposition (stage 4).

## Trail

- 2026-06-15: graduated first implementation slice into
  [`goals/pandoc-ast-foundation`](../../goals/pandoc-ast-foundation/README.md)
  and landed the pure `@beep/pandoc-ast` package with schema-first models,
  codecs, compatibility mapping, reports, fixtures, and package-local proof.
- 2026-06-15: review follow-up recorded generated-once fixture provenance,
  tables/custom styles as v1 gap-only evidence, repo graph search as
  low-signal, and official Pandoc release verification wording.
- 2026-06-15: packet opened from the DOCX/Lexical/Pandoc planning session;
  pre-seeded through decompose because the main branch decisions were already
  resolved in conversation.
