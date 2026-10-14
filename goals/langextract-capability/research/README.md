# LangExtract Capability Research

This directory holds source-backed research for the `@beep/langextract`
initiative.

## Required Reports

Write reports under [`reports/`](./reports/). Each report must distinguish:

- measured facts
- source-backed observations
- inferences
- recommended tasks
- "do not do" guidance

## Report Lanes

| Report | Required focus |
| --- | --- |
| `repo-reuse-audit.md` | Existing repo exports, `@beep/file-processing`, provider drivers, and duplicate risks. |
| `nlp-fit-audit.md` | `@beep/nlp` fit for spans, provenance, chunks, handoff, graph, backend, tests, and consumer table updates. |
| `effect-v3-reference.md` | Effect v3 reference clone modules, behavior, tests, docs, and drift. |
| `effect-v4-migration.md` | `.repos/effect-v4` migration facts for Schema, Context, Layer, Stream, and `effect/ai`. |
| `architecture-boundaries.md` | Foundation capability gate, dependency direction, exports, and package README policy. |
| `extraction-alignment.md` | Chunking, prompting, parsing, resolver/alignment, fuzzy matching, spans, and parity fixtures. |
| `testing-quality.md` | Fake model, property tests, dtslint, docgen, repo export catalog, QRFL, yeet, and PR babysitting. |

## Synthesis

After all reports exist, write [`synthesis.md`](./synthesis.md) with the
implementation proposal. Then run the proposal review loop and store inventories
as `reports/proposal-review-round-<n>.md` until zero required improvement items
remain.
