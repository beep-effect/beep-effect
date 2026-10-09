# Build Pipeline Simplification

## Status

<!-- BEGIN GENERATED: EXPLORATION STATUS -->
Stage: `research`
Status: `active`
<!-- END GENERATED: EXPLORATION STATUS -->

Source: [`ops/manifest.json`](./ops/manifest.json)

## Spark

Should beep-effect adopt a bundler (the operator leaned `bun build`) to simplify
per-package build scripts, speed builds, shrink bundles, and make room for
Effect's SchemaCompiler, or keep `effect-tsgo` emit? A deep-research pass filed
under `research/deep-research/` says: keep tsgo emitting, bundle only what ships.

## Next Open Question

Align round 1: does the operator accept the two-tier framing now that both
experiments agree with it (Bun 1.4.2 builds effect-drizzle correctly, bun#18008
still live; no bundler beats effect-tsgo emit on `@beep/schema`, Babel is the
only pure-annotation source)? And the SchemaCompiler dispute: which mechanism or
numbers support larger wins than the +2 KB / 1.2x-1.5x on file?

## Read This First

1. [`ops/manifest.json`](./ops/manifest.json) - machine state: stage, status, open questions.
2. [`CAPTURE.md`](./CAPTURE.md) - raw dump (stage 0).
3. [`RESEARCH.md`](./RESEARCH.md) - stage 1: cited landscape, in-repo inventory, the two experiments, constraints, questions for align.
4. [`research/deep-research/REPORT.md`](./research/deep-research/REPORT.md) - the deep-research synthesis; six per-thread notes beside it; measured runs under [`research/experiments/`](./research/experiments/).
5. [`DECISIONS.md`](./DECISIONS.md) - grilling log (stage 2, if present).
6. [`BRIEF.md`](./BRIEF.md) - shaped pitch (stage 3, if present).
7. [`MAP.md`](./MAP.md) - decomposition (stage 4, if present).

## Trail

- 2026-10-09 (later): ran both experiments (Bun 1.4.2 tree-shake probe: 1.3.14
  finding RETIRED, fixed in 1.4.1, bun#18008 CONFIRMED; `@beep/schema` timed four
  ways: emit-only 0.65-0.88 s fastest, no bundler wins, Babel sole PURE source);
  wrote RESEARCH.md + research/SOURCES.md + one friction receipt; stage -> `research`.
  Four open questions queued for align.
- 2026-10-09: packet opened from a deep-research session; operator's framing and
  the six research notes + report filed under `research/deep-research/`
  (home paths redacted). Stage stays `capture`; two experiments pending.
  Operator pushback on the SchemaCompiler paragraph appended to CAPTURE and
  registered as an open question.
