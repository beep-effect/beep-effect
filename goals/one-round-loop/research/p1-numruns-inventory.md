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
