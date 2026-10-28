# 3-A5 check-census parity (2026-10-25)

PR 3-A5 moves repo-cli `Quality/CheckCensus.ts` off its hand-rolled tsconfig readers (`jsonc-parser` plus local
`TsconfigReferences`, `TsconfigOutDir` and `TsconfigSelection` schemas) onto `@beep/repo-tsconfig`
`TsconfigLoader.load` and `TsconfigLoader.compilerOptions` (map site #162). The oracle is the census output itself.

## Method

1. Lane base `35faa4a00d` (origin/main), `bun install`, `bunx turbo run build` (186 tasks, a fully built tree).
2. Before: `bun run beep quality check-census --output-json <before.json>` on the base tree with the switch stashed
   (clean source).
3. After: the same command on the final lane source (the switch, the per-run declaration-index cache and the
   `Struct.pick` selection copy).
4. Both reports normalized with `bun goals/effected-promotion/ops/check-census-adoption-parity.ts --normalize-census`,
   which drops every `*Ms` and `*At` key and the gate's wall-clock `checkTime` verdict. Both normalized reports are
   committed, so `diff check-census-3-a5-before.json check-census-3-a5-after.json` reproduces every claim below:

   | Report | sha256 |
   | --- | --- |
   | `check-census-3-a5-before.json` | `3980a2eccfac7b9fad8bc998377251f5021fd6816a1fbc6ba7cc615b8346ccd9` |
   | `check-census-3-a5-after.json` | `1becf06524c44b113e02738e13e1463f681709034bb6453719e9149c9d1fd4cd` |

5. Separately, `ops/check-census-adoption-parity.ts` (no flag) runs frozen copies of the legacy readers against the
   adopted reads for every census package: `check-census-adoption-parity-3-a5.json`.

## Result

- Reader parity: 185 census packages and 1,273 references; 185 of 185 synthesized overlays are byte-identical, and
  0 of 1,273 declaration indexes differ.
- Census output: 185 rows before and after. 184 rows are byte-identical. The one differing row is `@beep/repo-cli`,
  the package whose own source this PR edits: its `overlay` and `referenceKeeping` programs each have 1,865 fewer
  instantiations (14,339,365 to 14,337,500) and 323 fewer types (3,220,990 to 3,220,667). File counts, upstream
  src/dist counts, diagnostics and build overlap are unchanged. The gate's `@beep/repo-cli` single-checker row moves
  the same way (6,363,657 to 6,361,791 instantiations, 1,430,138 to 1,429,798 types).
- Measurement jitter: an intermediate after-run also showed `@beep/git` with its `overlay` and `referenceKeeping`
  instantiation counts (162,076 and 162,085) trading places, delta +9 to -9. Both programs hold the same 614 files,
  and six `check-census --filter @beep/git` runs on unchanged source gave the overlay 162,085 five times and 162,076
  once, so this is tsgo nondeterminism, not this PR. The committed after-run does not show it.
- Every other gate comparison is identical.

## Read cost

`TsconfigLoader.compilerOptions` reads and decodes a referenced project's whole `extends` chain, where the legacy
reader read the project's own file once per reference. The tree guard therefore memoizes the resolved declaration
index per referenced tsconfig for one census run (`effect/Cache`): about 185 distinct referenced projects behind the
1,273 references are resolved once each. The shared root base configs are still re-read once per distinct project's
chain. These are filesystem reads before any compiler spawns; the census wall time is tsgo's.

## Rejected configs

The kit decodes each document through the typed `TsconfigJson`/`CompilerOptions` schemas, so a config the kit rejects
now fails the census with a `QualityScriptCommandError` naming the file: a referenced project (or a base it extends)
with a removed value such as `target: "es3"` fails with `Failed to resolve compilerOptions.outDir of referenced
project <tsconfig>.`, and an empty reference path fails with `Failed to read references from <tsconfig>.`. Both are
pinned in `packages/tooling/tool/cli/test/check-census.test.ts`. The live parity above shows today's repo holds no
such config.

## Inherited red

The census gate fails on the clean base as well: `FAIL @beep/repo-cli: single-checker instantiations increased by
197616` before, `195750` after, against `standards/check-census.regression-baseline.jsonc` (baseline commit
`011190d9ec`). Attribution: inherited from main, not introduced here; this PR lowers the excess by 1,866. The other
gate lines are advisories (check time beyond the 5% band) and `tighten` hints, also present before the switch.
