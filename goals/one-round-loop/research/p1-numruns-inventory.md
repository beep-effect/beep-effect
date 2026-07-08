# P1 numRuns inventory (execution-time regen, 2026-07-08)

Fresh `rg` sweep per orl-011 ("regenerate the inventory at execution
time"); supersedes the 2026-07-07 authoring-time figures.

| Surface | Count |
|---|---|
| Inline `numRuns:` lines | 283 (157 files) |
| `fc.assert` sites | 262 |
| `assertSchemaArbitraryDecodesToSelf` calls | 65 |
| `it.prop`/`test.prop` sites | 2 (both `packages/drivers/pacer/test/Pacer.test.ts`) |
| `fc.configureGlobal` uses | 0 (confirmed absent) |

Deltas vs authoring-time (287/161, 264, 53): the crispening-adjacent
merges shifted counts slightly; assertSchemaArbitraryDecodesToSelf grew
53 → 65.

Key facts for the helper design (orl-010):

- Precedent: `packages/tooling/test-kit/test-utils/src/Schema.ts` —
  `assertSchemaArbitraryDecodesToSelf(schema, { numRuns })` applies
  `{ numRuns: options?.numRuns ?? 50 }` at :42. The env-max helper
  replaces exactly that shape: `effective = max(env(BEEP_FC_NUM_RUNS),
  inline ?? default)`.
- `vitest.setup.ts` and `vitest.shared.ts` live at the REPO ROOT (not
  in repo-configs) — the `fc.configureGlobal` floor lands in
  `vitest.setup.ts`.
- The two pacer `it.prop` sites pass NO `fastCheck` params (object
  arbitraries + assertion only), so the configureGlobal floor covers
  them without a codemod touch — R2's "it.prop params override globals"
  concern applies only to sites that pass params, of which there are
  currently ZERO. The codemod still guards the pattern (future sites),
  but the migration surface is the 283 inline `numRuns:` lines.

## Sweep execution (orl-011, 2026-07-08)

- Codemod sweep over 158 test files: **144 rewritten** (211 fc.assert
  sites); floor invariant proven — removed `numRuns:` literal multiset
  identical to the added `fcRuns(...)` multiset
  (6×5, 8×10, 1×15, 3×16, 15×20, 70×25, 1×32, 101×50, 5×100, 1×200).
- 7 hand-rolled local wrapper helpers (professional-desktop,
  law-practice, shared-domain, epistemic, duckdb, uspto-mcp,
  ai-metrics) migrated manually to `fcRuns(options?.numRuns ?? N)` —
  their call sites' inline values flow through as floors.
- Ledgered (intentionally NOT migrated): pacer `fc.sample(...,
  { numRuns: 24, seed })` — a seeded fixture-volume control, not a
  property law (raising it changes generated data volume, not law
  depth); assertSchemaArbitraryDecodesToSelf option objects (the helper
  applies fcRuns internally); test-utils' own FastCheckRuns
  expectations.
- Verification: sample suites green plain AND under
  `BEEP_FC_NUM_RUNS=300`; biome clean over all 151 changed files.
