# 3-A5 check-census parity (2026-10-25)

PR 3-A5 moves repo-cli `Quality/CheckCensus.ts` off its hand-rolled tsconfig readers (`jsonc-parser` plus local
`TsconfigReferences`, `TsconfigOutDir` and `TsconfigSelection` schemas) onto `@beep/repo-tsconfig`
`TsconfigLoader.load` and `TsconfigLoader.compilerOptions` (map site #162). The oracle is the census output itself.

## Method

1. Lane base `35faa4a00d` (origin/main), `bun install`, `bunx turbo run build` (186 tasks, a fully built tree).
2. Before: `bun run beep quality check-census --output-json <before.json>` on the base tree with the switch stashed
   (clean source).
3. After: the same command with the switch applied.
4. Both reports normalized with `bun goals/effected-promotion/ops/check-census-adoption-parity.ts --normalize-census`,
   which drops every `*Ms` and `*At` key and the gate's wall-clock `checkTime` verdict. The normalized before report is
   committed as `check-census-3-a5-before.json`.
5. Separately, `ops/check-census-adoption-parity.ts` (no flag) runs frozen copies of the legacy readers against the
   adopted reads for every census package: `check-census-adoption-parity-3-a5.json`.

## Result

- Reader parity: 185 census packages and 1,273 references; 185 of 185 synthesized overlays are byte-identical, and
  0 of 1,273 declaration indexes differ.
- Census output: 185 rows before and after. 184 rows are byte-identical. The one differing row is `@beep/repo-cli`,
  the package whose own source this PR edits: its `overlay` and `referenceKeeping` programs each have 1,980 fewer
  instantiations (14,339,365 to 14,337,385) and 361 fewer types (3,220,990 to 3,220,629). File counts,
  upstream src/dist counts, diagnostics and build overlap are unchanged. The gate's `@beep/repo-cli` single-checker
  row moves the same way (6,363,657 to 6,361,676 instantiations, 1,430,138 to 1,429,776 types). Every other gate
  comparison is identical.

## Inherited red

The census gate fails on the clean base as well: `FAIL @beep/repo-cli: single-checker instantiations increased by
197616` before, `195635` after, against `standards/check-census.regression-baseline.jsonc` (baseline commit
`011190d9ec`). Attribution: inherited from main, not introduced here; this PR lowers the excess by 1,981. The other
gate lines are advisories (check time beyond the 5% band) and `tighten` hints, also present before the switch.
