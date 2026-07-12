# Decisions — grilling log

Pre-seeded (stage is still `research`; align has not formally started).
Convention: one branch-closing question at a time, recommended answer first.

## Q1 — Integration seam: consume, vendor, or rebuild pretext?

**Status:** RECOMMENDED, not ratified by Ben.

**Recommendation: consume/wrap — do not rewrite.** Schema-wrap the boundary
(a `FontMetricsSnapshot` / prepared-text codec, first draft in
[`scratchpad/computable-layout/FontMetrics.schema.ts`](../../scratchpad/computable-layout/FontMetrics.schema.ts)),
not the internals.

**Why the calculus differs from dockview.** The dockview rebuild was justified
because the *architecture* was the asset we needed to own (schema-decoded
commands, typed outcomes, projection semantics) and dockview's DOM-first
design could not be retrofitted. Pretext's irreplaceable asset is not its
architecture — it is the **validated corpus**: 7,680/7,680 browser-exact
sweeps × 3 engines, long-form corpora across a dozen scripts, per-engine
profiles, a committed platform-bug ledger, and years of preprocessing rules
(kinsoku, Arabic clustering, emoji correction) that only browser-oracle
iteration can produce. Rebuilding forfeits the corpus; wrapping keeps it.
MIT, zero runtime deps, tiny API surface, worker-capable. The effect-native
value-add lives entirely at the boundary: typed codecs for the metrics value,
Effect-managed capture, schema-tagged errors.

**Revisit triggers:** upstream abandonment; server-side backend need arriving
before upstream ships one; the boundary wrapper starting to reimplement
internals (that smell means reconsider vendoring, not rebuilding).

## Q2 — Metrics-cache shipping format

**Status:** OPEN — draft contract exists (`FontMetrics.schema.ts`,
fixture-shaped). Real contract needs: segment kinds (pretext's eight), engine
profile fields, emoji correction, font descriptor normalization, and a
versioned envelope (`S.tag(1)` pattern, same as `DockSnapshot`).

## Q3 — First proving consumer

**Status:** PARTIALLY CLOSED — layout-as-unit-tests proven 2026-07-12
(`scratchpad/computable-layout`, 5/5 under `bun test`). Next consumer still
open: thread virtualization vs bubble shrinkwrap vs content-aware dock
constraints.
