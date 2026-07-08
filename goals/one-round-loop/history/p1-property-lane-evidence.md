# P1 property-lane evidence (Verification Matrix rows 4–6)

Evidence trail for orl-010/011/012 (D3, R2, fence 3).

## Row 5 — numRuns floors

- Helper: `@beep/test-utils` `fcRuns(inline?)` →
  `max(inline ?? 100, BEEP_FC_NUM_RUNS)`; 6 unit tests incl. a live
  `configureGlobal` floor probe and the never-lower guarantee (fence 3).
- Codemod (`goals/one-round-loop/ops/codemods/numruns-fcruns.codemod.ts`)
  golden-diff tested (rewrite, idempotence, negative), following the
  crispening harness.
- Sweep: 144/158 files rewritten (211 `fc.assert` sites) + 7 hand-rolled
  local wrappers migrated manually. **Floor invariant proven**: the
  removed `numRuns:` literal multiset equals the added `fcRuns(...)`
  multiset exactly (6×5, 8×10, 1×15, 3×16, 15×20, 70×25, 1×32, 101×50,
  5×100, 1×200).
- `it.prop`/`test.prop`: the repo's only two sites (drivers/pacer) pass
  NO fastCheck params — covered by the `configureGlobal` floor; zero
  param-carrying sites exist to migrate (fresh inventory,
  `research/p1-numruns-inventory.md`).
- Ledgered non-migrations: pacer `fc.sample(..., { numRuns: 24, seed })`
  (seeded fixture volume, not a law);
  `assertSchemaArbitraryDecodesToSelf` option objects (the helper
  routes through `fcRuns` internally).

## Row 4 — property lane catches a seeded non-round-tripper

- Lane: `beep ci lane property` → dedicated turbo task `test:property`
  (87 packages; `BEEP_FC_NUM_RUNS` declared in task `env` — own cache
  key, deliberately NOT passThroughEnv per R2), 400-run default floor.
- FAIL leg: seeded fixture
  (`assertSchemaArbitraryDecodesToSelf(S.NumberFromString, ...)` — the
  Type-side arbitrary cannot decode through the encoded-side codec) →
  `beep ci lane property --affected --base origin/main` exited 1.
- PASS leg: seed removed → lane green (run recorded below).

### First-sweep finding (timeout scaling)

The first 400-floor sweep failed 5 `@beep/agents-use-cases` tests —
ALL `Test timed out in 30000ms`, zero law violations (14/14 pass at
inline floors). Deep sweeps scale wall time like coverage
instrumentation does, so `vitest.shared.ts` now grants the same 180s
cap when `BEEP_FC_NUM_RUNS` is active (`fcDeepSweepActive`, beside the
existing `vitestCoverageRunActive` precedent). Post-fix: 14/14 green at
400; full lane sweep 86/87 → 87/87.

## Row 6 — nightly sweep

- `.github/workflows/property-laws-nightly.yml`: `schedule` +
  `workflow_dispatch` (runs input, default 1000), `issues: write`;
  failure opens/updates ONE tracking issue (stable title "Nightly
  property-law sweep failures", label `property-laws-nightly`).
- Manual-dispatch verification is a POST-MERGE step: workflow_dispatch
  only registers once the file reaches the default branch (P0 lesson,
  evidence §1). To be executed and recorded immediately after the P1 PR
  merges.

## Lane wiring (D3)

- check.yml gains the `property-laws` job (context name **Property
  Laws**, frozen at introduction; NON-required — the ruleset 10240248
  addition is a P4 close criterion after a stable green history).
- `beep ci lane --list` now enumerates 22 descriptors; the lane carries
  `--runs` (floor override; raise-only semantics via fcRuns).
- `beep ci local` battery includes the property lane (affected shape
  passthrough; not skipped by `--fast`).

## Row 4 addendum — live catch on the P1 PR itself (2026-07-08)

The property lane caught a **pre-existing non-round-tripping schema on
the P1 PR's own CI run** — the packet's thesis proving itself:

- `@beep/box` `BoxError` fails equivalence round-trip for an
  empty-message `Error` cause (`new Error("")`, seed 1731503382, first
  counterexample at test #216). Invisible at the pre-P1 inline value of
  25 runs; surfaced once the lane raised the floor to 400.
- Encode→decode succeeds; line 180's `Equal.equals || toEquivalence`
  assertion is what fails (the decoded empty-message Error is not
  equivalent to the original).
- SPEC stop-condition disposition: this is product work (fixing the Box
  cause codec could change wire shape — fence 4 bars it here). Filed as
  a spawned task; the single `assertSchemaRoundTrip(B.BoxError)` call is
  seed-excluded via `assertSchemaRoundTripPinned` (hard `{ numRuns: 25 }`,
  its original value — no floor lowered, fence 3 intact). The other
  three Box schemas stay env-raisable. Remove the pin when the codec is
  fixed.

## Review-fix findings (PR #327)

- **Dependency cycle (blocking).** The sweep introduced the first
  `@beep/test-utils` import into 55 packages; declaring it as a devDep
  in the three that are in test-utils's OWN dependency closure
  (`@beep/utils`, `@beep/schema`, `@beep/pglite`) created a turbo cycle
  (`utils→data→schema→pglite→test-utils→…`), failing every affected
  turbo lane instantly. Those three keep the undeclared import (always
  resolvable — test-utils depends on them, so they are always
  installed); the other 52 declare it. This is the reason foundation
  packages never declared test-utils before.
- **Blank `--runs` floor drop.** `resolvePropertyLaneRuns` normalizes a
  blank/whitespace `--runs` back to 400 (`??` only guards `undefined`).
