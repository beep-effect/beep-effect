# Build Pipeline Simplification

## Status

<!-- BEGIN GENERATED: EXPLORATION STATUS -->
Stage: `capture`
Status: `active`
<!-- END GENERATED: EXPLORATION STATUS -->

Source: [`ops/manifest.json`](./ops/manifest.json)

## Spark

Should beep-effect adopt a bundler (the operator leaned `bun build`) to simplify
per-package build scripts, speed builds, shrink bundles, and make room for
Effect's SchemaCompiler, or keep `effect-tsgo` emit? A deep-research pass filed
under `research/deep-research/` says: keep tsgo emitting, bundle only what ships.

## Next Open Question

Two to carry into research/align: (1) does the operator accept the
deep-research framing (library build = declaration pipeline; `bun build` out for
libraries; two-tier shape)? (2) the operator disputes the SchemaCompiler
paragraph on bundle size and runtime; which mechanism or newer numbers support
larger wins than the +2 KB / 1.2x–1.5x on file, and does it move the compiler
from per-app to per-library placement?

## Read This First

1. [`ops/manifest.json`](./ops/manifest.json) - machine state: stage, status, open questions.
2. [`CAPTURE.md`](./CAPTURE.md) - raw dump (stage 0).
3. [`research/deep-research/REPORT.md`](./research/deep-research/REPORT.md) - pre-seeded synthesis (stage 1 input, not yet a RESEARCH.md).
4. [`RESEARCH.md`](./RESEARCH.md) - prior art + capability inventory (stage 1, if present).
5. [`DECISIONS.md`](./DECISIONS.md) - grilling log (stage 2, if present).
6. [`BRIEF.md`](./BRIEF.md) - shaped pitch (stage 3, if present).
7. [`MAP.md`](./MAP.md) - decomposition (stage 4, if present).

## Trail

- 2026-10-09: packet opened from a deep-research session; operator's framing and
  the six research notes + report filed under `research/deep-research/`
  (home paths redacted). Stage stays `capture`; two experiments pending.
  Operator pushback on the SchemaCompiler paragraph appended to CAPTURE and
  registered as an open question.
