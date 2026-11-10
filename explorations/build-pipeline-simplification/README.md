# Build Pipeline Simplification

## Status

<!-- BEGIN GENERATED: EXPLORATION STATUS -->
Stage: `graduate`
Status: `graduated`
<!-- END GENERATED: EXPLORATION STATUS -->

Source: [`ops/manifest.json`](./ops/manifest.json)

## Spark

Should beep-effect adopt a bundler (the operator leaned `bun build`) to simplify
per-package build scripts, speed builds, shrink bundles, and make room for
Effect's SchemaCompiler, or keep `effect-tsgo` emit? A deep-research pass filed
under `research/deep-research/` says: keep tsgo emitting, bundle only what ships.

## Next Open Question

None. Graduated on 2026-11-10 into
[`goals/declaration-only-builds`](../../goals/declaration-only-builds/README.md).
The bundler question closed as "none"; the goal removes the Babel pass and
JavaScript emit from library builds. Three gated candidates stay in
[`MAP.md`](./MAP.md) as re-entry points (a publish lane, source-resolved
checking, a bundler); a fired gate reopens this packet at `decompose`.

## Read This First

1. [`ops/manifest.json`](./ops/manifest.json) - machine state: stage, status, open questions.
2. [`CAPTURE.md`](./CAPTURE.md) - raw dump (stage 0).
3. [`RESEARCH.md`](./RESEARCH.md) - stage 1: cited landscape, in-repo inventory, the two experiments, constraints, questions for align.
4. [`research/deep-research/REPORT.md`](./research/deep-research/REPORT.md) - the deep-research synthesis; six per-thread notes beside it; measured runs under [`research/experiments/`](./research/experiments/).
5. [`DECISIONS.md`](./DECISIONS.md) - grilling log (stage 2, if present).
6. [`BRIEF.md`](./BRIEF.md) - shaped pitch (stage 3, if present).
7. [`MAP.md`](./MAP.md) - decomposition (stage 4, if present).

## Trail

- 2026-11-10: operator-requested review found the packet a month stale (gates
  now on `tsrs`, 220 manifests, #1874 landed) and its publishable-tier predicate
  void. Looped to research: Experiment 3 re-verified the census and swept all
  199 check projects with and without project references. Align in two rounds
  plus a shape review (nine DECISIONS entries): no bundler, no tsdown tier, no
  build-kit, Babel removed after proof, declarations-only emit with a
  conditional check-once, source-resolved checking measured and rejected,
  SchemaCompiler handed back to its DEFER ruling, app-side aims to INBOX. Wrote
  BRIEF.md and MAP.md; graduated one goal, `declaration-only-builds`.
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
