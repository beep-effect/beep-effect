# Calibration Evidence — 2026-07-30 (CYCLOMATIC_COMPLEXITY_STANDARD session)

The measurement + judged-panel evidence behind law 23, the `maxCognitive: 8`
ceiling, and this packet. Referenced by `.fallowrc.jsonc` comments and the
2026-07-30 `standards/architecture/DECISIONS.md` entry.

## Distribution (fallow health, full repo, fallow 3.10.0)

41,469 functions across 3,380 files (pre-backfill snapshot; a same-day re-run
measured 41,565/3,383 — tree moves, shape doesn't).

| Statistic | Value |
| --- | --- |
| p90 cognitive | ≤1 |
| p95 | 2 |
| p99 | 6 |
| p99.5 | 9 |
| >6 | 405 fns (1.0%) — 273 not caught by prior gates (cog15/CRAP30) |
| >8 | 250 fns (0.6%) — 137 not caught |
| >10 | 161 fns — 68 not caught |
| >15 | 60 fns (this packet's scope) |

Family concentration of the 7–10 marginal band: tooling 121, foundation 64,
drivers 31, ontology 8, rest ≤6 each. The >15 tail: tooling 28, foundation 22,
drivers 8, ontology 2.

## Judged panel (21 sampled functions, cognitive 7–14)

Seven agents read each function in full and ruled whether a 6-ceiling refactor
would genuinely improve it. Tally: 12 refactor-improves, 7 appeasement,
2 borderline. **Natural ceilings** (cognitive score of the best honestly
defensible version): `2,2,2,4,4,4,4,5,5,5,5,5,6,6,7,7,7,7,7,9,10`.

Load-bearing readings:

- A third of the band's honest ceilings sit ABOVE 6 (five at exactly 7) — a
  6-gate forces suppression or crispen-violating fragmentation on them.
- Every honest ceiling is ≤8 except two outliers (9: `findFuzzy` scanning loop
  in `packages/foundation/capability/langextract/src/Alignment/index.ts`; 10:
  `OntologyExplorerRegion` in
  `packages/ontology/ui/src/aggregates/Session/Session.explorer.tsx`) — both
  override material, hence 8 is the tightest near-zero-false-positive gate.
- Appeasement clusters have a recognizable type: React conditional mounting
  (`ComposerFeaturePlugins` is already the deliberate extraction), flat
  guard-clause ladders in sync/reconcile services, reference-algorithm ports
  (chalk `applyStyle`). Triage defaults these shapes to override, not refactor.
- Gate precision by band: 7–8 ≈ 50% refactor-improves; 9+ ≈ 70–75%.

## Panel — wave 1 refactor seams (do these first; defensible with the gate off)

1. `packages/foundation/modeling/rdf/src/Iri.ts` — the 8-line optional-suffix
   parse block (`[ "?" iquery ] [ "#" ifragment ]`) repeats 4x across
   `parseAbsoluteIriEnd` / `parseIriEnd` / `parseRelativeIriReferenceEnd`;
   extract `parseOptionalSuffix(input, index, marker, parseTail)` (~cog 1),
   leaving callers at ~2.
2. `packages/foundation/ui-system/ui/src/components/live-waveform.tsx` — mic
   setup/teardown effect duplicates three guard-ifs verbatim in the `!active`
   branch and the cleanup closure; extract `teardownAudio()` (~4), effect ~1–2.
3. `packages/tooling/tool/cli/src/commands/Laws/TerseEffect.ts`
   `getLiteralThunkHelperName` (cog 9) — first-match conditional chain over
   literal-node kinds; convert to a colocated `[predicate, ThunkHelperName]`
   table + `A.findFirst` beside `THUNK_HELPER_NAMES` (~2). Repo match-helper
   law, not appeasement.
4. `packages/tooling/tool/cli/src/commands/Files/internal/ImageCuration.ts`
   `canonicalizeImageTargetPath` (cog 8) — extract
   `findNearestExistingAncestor` (walk-up-until-exists, error at root; ~5),
   caller becomes straight-line realPath + suffix reattach (~2).
5. `packages/tooling/tool/cli/src/commands/Research/internal/RepoCardRun.ts`
   `collectCloneCards` (cog 9) — extract pure `cloneCardOf(info, capturedAt)`
   card construction (~3) from the scan/skip loop (~5); mirror `starCardOf` in
   `collectStarCards`.

## Decisions (grill session, all seven as recommended)

1. `maxCognitive: 8` now; 6 is a revisit target after this packet.
2. Inherited tail frozen by blocking health baseline ratchet (per-file counts,
   `--baseline`; proven: compare exits 0 clean, 1 on regression).
3. `require-suppression-reason: error` + full 78-pragma backfill + review
   dates on waivers.
4. Codified as law 23 + DECISIONS entry; integers live in config.
5. Burn-down scope: >15 tail + the five panel seams.
6. Agent tooling: fallow MCP only (no skills plugin, no PreToolUse hook).
7. P0 evaluates runtime-coverage CRAP + `fallow impact` trends only.

## Mechanics verified against fallow 3.10.0

- `health.maxCognitive` et al. live in `.fallowrc.jsonc`; the blocking `audit`
  lane (`gate: new-only`, structural-key attribution) inherits them.
- `fallow health --save-regression-baseline` **silently no-ops** — the working
  pair is `--save-baseline` / `--baseline` (per-file finding counts; scripts
  `fallow:health:baseline:{write,check}`).
- Health lane today: `--report-only`, advisory everywhere
  (`CiLane.ts:631-632`, `FallowQuality.command.ts:513-525`); promotion = move
  lane to blocking + swap `--report-only` for `--baseline` compare.
- Suppression syntax: `// fallow-ignore-next-line <types> -- <reason>`;
  inventory via `fallow suppressions` (always exit 0; governance surface).
