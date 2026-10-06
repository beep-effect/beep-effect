# Patent Drawing Pipeline

## Status

<!-- BEGIN GENERATED: EXPLORATION STATUS -->
Stage: `graduate`
Status: `graduated`
<!-- END GENERATED: EXPLORATION STATUS -->

Source: [`ops/manifest.json`](./ops/manifest.json)

## Spark

A partner emailed a design-patent drawing request (eight named views of a
flat-pack sheet-panel furniture article, with photos, a sketch sheet, and a
provisional description) and asked whether Claude could produce
USPTO-compliant figures. The itch: make that a repeatable repo feature
(spec-as-code → one solid → hidden-line views → shading → compliant sheets →
validator → attorney sign-off) instead of a one-off.

## Next Open Question

None — graduated. Promised-now goal: [`goals/design-figure-generation`](../../goals/design-figure-generation/).
Gated candidates (`design-figure-intake`, `design-figure-desktop`) stay in
[`MAP.md`](./MAP.md); a fired gate reopens this packet at `decompose`.

## Read This First

1. [`ops/manifest.json`](./ops/manifest.json) - machine state: stage, status, open questions.
2. [`CAPTURE.md`](./CAPTURE.md) - raw dump (stage 0).
3. [`RESEARCH.md`](./RESEARCH.md) - prior art + capability inventory (stage 1).
4. [`DECISIONS.md`](./DECISIONS.md) - grilling log (stage 2, if present).
5. [`BRIEF.md`](./BRIEF.md) - shaped pitch (stage 3, if present).
6. [`MAP.md`](./MAP.md) - decomposition (stage 4, if present).

## Trail

- 2026-10-05: packet opened from a live drawing request; deep-research sweep
  (5 researchers + writer, Opus 5.5) landed; full report + notes kept
  out-of-repo (`$BEEP_OPPOLD_CORPUS_ROOT/ops/patent-drawing-pipeline/`)
  because they describe the client's article; RESEARCH.md carries the
  generic findings. Align grilled in two rounds (8 decisions in
  `DECISIONS.md`, topology resolved by doctrine); BRIEF.md drafted; stopped
  at shape; operator confirmed the brief; MAP.md written; graduated into
  `goals/design-figure-generation` (agentic-cad Out list amended to point there).
