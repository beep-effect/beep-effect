# Capture

## 2026-08-17 — operator brain dump (roadmap re-eval session)

Captured near-verbatim from the operator's notes; two honesty annotations
added inline and marked.

**Why:** it is expensive to run the oppold-corpus pipeline, and we want the
best-quality knowledge graph we can deliver. If we get this right it is the
single best asset to the practice-kg-mcp and something usable for other
potential solo-practice attorneys.

The wants:

1. **Salvage integration.** The practice's old workstation was mined
   (2026-08-17 minus a week) onto a machine-local T7 salvage drive
   (`oppold-salvage-2026-08-10`); this data is practice-relevant and not yet
   in the corpus.
2. **Pipeline re-evaluation from scratch** — make sure everything is
   exhaustively covered.
3. **Ideal T-Box for ingestion** — a corpus-relevant T-Box used during
   ingestion so the generated A-Box has the best quality possible.
   *(Annotation: composes with `semantic-foundation` M1 Intake-Serving
   Semantic Seed and the patent-document-schema / FOLIO goals already in
   flight — extend those, do not re-found.)*
4. **Restoration with no data loss** — including the salvage drive's
   recycle-bin content. *(Annotation: `$RECYCLE.BIN` holds `$R…` content
   files paired with `$I…` metadata files carrying the original path and
   deletion time; restoration is re-pairing. The removable drive itself is
   the most urgent data-loss risk.)*
5. **Dedupe and prune** — dedupe pipeline data; prune non-relevant corpus
   data.
6. **Proper mail handling** — all `.pst` files and descendant extensions
   handled properly: libpff-exported attachments landing as `.p`, `.d`, etc.
   must be repaired to their true types and converted/restored to `.docx`;
   `.doc` converted to `.docx` as losslessly as possible. *(Annotation:
   binary Word → OOXML cannot be strictly lossless; the deliverable is
   fidelity-verified conversion with provenance — original retained,
   conversion diffed, any loss recorded.)*
7. **Full capability incorporation** — langextract, nlp, file-processing,
   metadata/exif provenance and more, fully incorporated into the pipeline.
8. **Pipeline self-improvement** — evaluate improvements to the pipeline
   itself at every step.
9. **Enrichment** — evaluate every avenue for corpus data enrichment to fill
   gaps and raise fidelity of the corpus and the downstream knowledge graph.

### Capability bricks already live (verified 2026-08-17)

| Need | Brick |
| --- | --- |
| pst extraction | `packages/drivers/libpff` |
| doc/docx text | `packages/drivers/doc-text`, `packages/drivers/tika` |
| exif/metadata provenance | `packages/drivers/exiftool` |
| span extraction | `packages/foundation/capability/langextract` |
| nlp | `packages/drivers/nlp-mcp`, `packages/drivers/wink` |
| file classification | completed `goals/file-processing-capability` |
| prior salvage/dedupe pass | completed `goals/oppold-corpus-refresh` (July wave) |

Net-new: the restoration/repair pass (recycle-bin re-pairing, attachment
type repair, fidelity-verified doc conversion), T-Box-guided ingestion
wiring, per-step pipeline self-evaluation, and the enrichment survey.
