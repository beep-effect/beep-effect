# Decisions — grilling log

Align ran 2026-07-13 via `/grill-with-docs` (Ben present, four
branch-closing questions). Convention: one question at a time,
recommended answer first.

## Q1 — Integration seam: consume, vendor, or rebuild pretext?

**Status:** RATIFIED (Ben, 2026-07-13) — consume/wrap as repo driver
**`@beep/pretext`** (`packages/drivers/pretext`), routed by
`standards/architecture/07-non-slice-families.md` route #2 (external
engine wrapper → drivers). Entrypoint law maps the purity boundary:
package **root = browser-safe pure surface** (schema contracts,
FontMetricsSnapshot codecs, pure layout helpers over decoded
snapshots); **`@beep/pretext/browser` = impure capture surface**
(`prepare()`, canvas, engine-profile detection). `@chenglou/pretext`
enters as a catalog dependency. Test layers ship fixture metrics so
consumers test DOM-free.

**Original recommendation (accepted as written):** consume/wrap — do not rewrite. Schema-wrap the boundary
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

**Status:** V1 LANDED (2026-07-12) — versioned envelope
(`FontMetricsV1.schema.ts`: `S.tag(1)` + `EngineProfile` mirroring pretext's
quirk fences; unversioned input fails typed; encode∘decode identity proven;
`fixture-v1.json` carries the Chrome/150 profile). **V2 residue:** segment
kinds (pretext's eight break kinds), emoji correction, font-descriptor
normalization, and — once the seam decision (Q1) is ratified — alignment
with pretext's actual `PreparedText` internals rather than word-level widths.

## Q3 — First proving consumer

**Status:** CLOSED for scratchpad consumers (layout-as-unit-tests 2026-07-12;
dock-constraint full-circle proof same day). First PRODUCT consumer decided
at align (see Q6): thread virtualization, coordination-gated.

## Q4 — Kickoff shape (align, 2026-07-13)

**RATIFIED: crystallize + graduate.** Finish align → BRIEF → MAP →
definition-of-ready → graduate `goals/pretext-driver/`. No pipeline bypass;
implementation runs inside the goal packet.

## Q5 — Publish sequencing (align, 2026-07-13)

**RATIFIED: publish before building.** The dockview-experiment arc ships as
PR #391 (hosted checks gate; local full proof known-stricter on pre-existing
full-scope debt). Driver work starts from the published state. Operational
note: yeet `--start-pr-early` requires `--monitor` whose PR-exists check
fires pre-push (circular for first publish of a branch); the manual
equivalent (push → `gh pr create` → `yeet monitor`) was used.

## Q6 — First consumer sequencing (align, 2026-07-13)

**RATIFIED: driver-only goal #1; consumer #2 coordination-gated.**
`goals/pretext-driver` touches zero product surface (no write-lane
collision). Goal #2 = thread virtualization in the editor stack, explicitly
gated on coordination with the beep-effect6 write lane before its packet
opens. Later candidates: dock-adapter minima wiring (kernel side already
landed), bubble shrinkwrap.
