# #1876 RDF and Pacer follow-up ports: record

Lane `residue-rdf-pacer`, branch `test/residue-rdf-pacer` off `main` `18e322389b`,
2026-10-18. Route: ruling S39, a Claude-originated residue lane worked by a
`claude-opus-5-5` child. Source evidence: the predecessor's
[R105 review and repair preview](https://github.com/beep-effect/beep-effect-goals-archive/blob/main/goals/repository-simplification-confidence/history/receipts/stage-4-vitest-reconciliation.md#r105-review-and-repair-preview)
and its Gap-19 RDF and Pacer rows.

## Inputs and digests

The three source exports live under `$HOME/.cache/beep/rsc/v-preserve/2026-10-09/`.
The lane holds byte copies in the gitignored `.beep/v-preserve/2026-10-09/`. Both
locations hash to the receipt values.

| Export | SHA256 | Receipt match |
| --- | --- | --- |
| `effect-vitest-rdf-unstaged.patch` (RDF WIP at `d88e376619`) | `28028d3ed537f402df11ffe07e3ba32b262a0680a3562388fa5483a8cecff0ac` | yes |
| `rdf-commits.mbox` (four commits `fd01a034a6`..`d88e376619`) | `3f1f353b53debb6b699a9682f10957b73467593c1f0085d11e9d97cb4b05c574` | yes |
| `pacer-commit.mbox` (commit `e8feb7244a`) | `7b54786de933d28d35efe106fa781815ff8e833558b19bc82d44a40ad4036677` | yes |

The committed predecessor patches also match their recorded decompressed digests:
`rsc-v-noncli-followup.patch.gz` decompresses to `b0f087e9…4a92` and
`rsc-v-noncli-repair-preview.patch.gz` to `4ef6960f…1d10`. The repair preview
passes `git apply --check` against `18e322389b` (one-line offsets in `Rdf.test.ts`).
No export, mbox or `.gz` patch was changed or deleted.

## Tooling isolation (D13)

The change touches only test files in `@beep/rdf` and `@beep/pacer`. No
`tooling/tool` source, CLI test, package manifest, lockfile, tsconfig, changeset,
baseline, boundary or exception file changes. The CLI-only first PR boundary that
D13 set is untouched, and this PR is the separate package-scoped follow-up R105
requires.

## What was ported

`@beep/rdf` (test only):

- New `test/helpers/FailureTags.ts`: `mapFailureTags` maps an `Exit` through
  `Cause.map`, so each typed failure becomes its `_tag` while every die and
  interrupt reason stays intact. `mapResultFailureTag` does the same for a
  `Result`. `Exit.mapError` is not used because it keeps only the first typed
  failure.
- `IRI.test.ts` (3), `URI.test.ts` (3), `ProvO.test.ts` (4) and `Rdf.test.ts` (4:
  invalid CURIE, empty and whitespace blank nodes, unknown metadata kind) now
  compare the complete failure cause with `assertExitFailure(...,
  Cause.fail("SchemaError"))`. Any extra defect, interruption, extra failure or
  success fails the assertion. The existing `Cause.pretty` message checks stay.
- `ProvRdf.test.ts` (23 rejection sites) asserts the exact `SchemaError` or
  `ProvRdfCodecError` tag with `assertFailure`. `SemanticSchemaConformance.test.ts`
  (3 sites) asserts `SchemaError`. The `toBeInstanceOf(S.SchemaError)` checks stay.
- New `FailureTags.test.ts`: three properties at `fcRuns(25)` prove that a mixed
  fail/die/interrupt cause keeps all three reasons, that successes pass through,
  and that `Result` failures map to their tag.

`@beep/pacer` (test only): `Pacer.test.ts`'s parameterized interruption test
("deletes the report when polling is interrupted (delete %s)") now passes a fresh
`logoutCount` ref to the mock transport. It asserts one logout after the scoped
session closes, for both successful and failed report deletion. The report-deletion
and interrupt assertions stay. The old standalone cohort is not copied, and the
predecessor preview's `@packageDocumentation` move is left out because it is
outside "port only the cleanup witness".

Every main property, codec binding, case title and sample floor stays.

Mutation checks: expecting `0` logouts fails both Pacer cases (`expected 1 to be
+0`). Changing one IRI tag to `ParseError` and one ProvRdf tag to `SchemaError`
fails exactly those two tests. Each file was restored byte for byte afterwards.

## Disposition summary

The table below gives one row per hunk across the three exports, 126 hunks in all.
"Added lines on main" counts the hunk's non-trivial added lines found verbatim
(trimmed) in the current file. It is supporting evidence, not the decision.

| Disposition | Hunks |
| --- | --- |
| Ported (one partly) | 31 |
| Superseded by this PR's port of `d88e376619` | 22 |
| Present on main | 15 |
| Equivalent drift on main | 23 |
| Not useful (equal-strength style or redundant precheck) | 20 |
| Not replayed (historical canon-packet records, baselines) | 14 |
| Discarded (stale `pacer-instrumented-tests` changeset) | 1 |

Reasons in short:

- `fd01a034a6` and `7c62e550c0` add only timing JSON and history notes for the
  2026-09-26 canon checkout. The 2026-10-09 receipt says current generated
  inventory replaces them.
- `f3ade2c6cd` rewrites assertions at equal strength. Its failure checks are
  superseded by the stronger `d88e376619` forms ported here. The remaining style
  rows belong to #1875's detector cohorts, and `lint effect-vitest` reports zero
  introduced rows.
- `d88e376619` is the source of the port. It drops a redundant `O.isSome`
  precheck in `InteropAndMetadata.test.ts`, and that drop is not useful. Its
  success-side `assertSuccess` in `ProvRdf` matches main's success check plus exact
  `provType` list, so it is equivalent.
- The RDF WIP's properties, `SupportedCoreSeed` and the constructive PROV
  round-trip are on main with current schema models. Its timestamp-domain finding
  is fixed on main: `ProvDateTime` caps the year at 9999 (`src/Prov.ts`).
- The Pacer commit's dependency, tsconfig, import, timeout and helper changes are
  on main in equivalent form: `@beep/test-runner`, `fcRuns` and
  `provideScopedLayer` from `@beep/test-utils`, and 10-second layer timeouts. Its
  phase `Effect.log` lines served timing receipts only. Its standalone witness
  is ported as the logout assertion above, and the deletion half was already on
  main. Its baseline and boundary rows are for dependencies this port does not
  add, so S31 keeps them out.

## Per-hunk disposition

### `rdf-commits.mbox`

| # | Commit | File | Hunk | Added lines on main | Disposition |
| --- | --- | --- | --- | --- | --- |
| 1 | `fd01a034a6` | `canon/history/2026-09-26-rdf-wave-preparation.md` | `-0,0 +1,45` | absent | Not replayed: historical canon-packet record; preserved in the export |
| 2 | `fd01a034a6` | `canon/ops/inventory/timings/rdf-preparation/rdf-before-bun-context.json` | `-0,0 +1,119` | absent | Not replayed: historical canon-packet record; preserved in the export |
| 3 | `fd01a034a6` | `canon/ops/inventory/timings/rdf-preparation/rdf-before-bun.json` | `-0,0 +1,1102` | absent | Not replayed: historical canon-packet record; preserved in the export |
| 4 | `fd01a034a6` | `canon/ops/inventory/timings/rdf-preparation/rdf-before-context.json` | `-0,0 +1,118` | absent | Not replayed: historical canon-packet record; preserved in the export |
| 5 | `fd01a034a6` | `canon/ops/inventory/timings/rdf-preparation/rdf-before.json` | `-0,0 +1,1102` | absent | Not replayed: historical canon-packet record; preserved in the export |
| 6 | `fd01a034a6` | `canon/ops/inventory/timings/rdf-preparation/rdf-source-preparation.json` | `-0,0 +1,74` | absent | Not replayed: historical canon-packet record; preserved in the export |
| 7 | `f3ade2c6cd` | `canon/history/2026-09-26-rdf-assertion-migration.md` | `-0,0 +1,40` | absent | Not replayed: historical canon-packet record; preserved in the export |
| 8 | `f3ade2c6cd` | `rdf/test/IRI.test.ts` | `-2,6 +2,7` | 0/1 | Equivalent drift: main imports from `effect/<Module>` and already uses `@effect/vitest/utils` asserts |
| 9 | `f3ade2c6cd` | `rdf/test/IRI.test.ts` | `-24,19 +25,19` | 0/3 | Superseded by the d88e376619 port below (tag-exact failure assertions) |
| 10 | `f3ade2c6cd` | `rdf/test/IRI.test.ts` | `-90,8 +91,8` | 0/2 | Not useful: equal-strength assertion-style rewrite; remaining style rows belong to the #1875 detector cohorts |
| 11 | `f3ade2c6cd` | `rdf/test/InteropAndMetadata.test.ts` | `-6,6 +6,7` | 0/1 | Equivalent drift: main imports from `effect/<Module>` and already uses `@effect/vitest/utils` asserts |
| 12 | `f3ade2c6cd` | `rdf/test/InteropAndMetadata.test.ts` | `-75,11 +76,12` | 0/3 | Not useful: equal-strength assertion-style rewrite; remaining style rows belong to the #1875 detector cohorts |
| 13 | `f3ade2c6cd` | `rdf/test/ProvO.test.ts` | `-23,6 +23,7` | 0/1 | Equivalent drift: main imports from `effect/<Module>` and already uses `@effect/vitest/utils` asserts |
| 14 | `f3ade2c6cd` | `rdf/test/ProvO.test.ts` | `-86,7 +87,7` | 0/1 | Not useful: equal-strength assertion-style rewrite; remaining style rows belong to the #1875 detector cohorts |
| 15 | `f3ade2c6cd` | `rdf/test/ProvO.test.ts` | `-110,8 +111,8` | 0/2 | Not useful: equal-strength assertion-style rewrite; remaining style rows belong to the #1875 detector cohorts |
| 16 | `f3ade2c6cd` | `rdf/test/ProvO.test.ts` | `-188,14 +189,10` | 0/4 | Superseded by the d88e376619 port below (tag-exact failure assertions) |
| 17 | `f3ade2c6cd` | `rdf/test/ProvO.test.ts` | `-204,7 +201,7` | 0/1 | Not useful: equal-strength assertion-style rewrite; remaining style rows belong to the #1875 detector cohorts |
| 18 | `f3ade2c6cd` | `rdf/test/ProvRdf.test.ts` | `-26,6 +26,7` | 0/1 | Equivalent drift: main imports from `effect/<Module>` and already uses `@effect/vitest/utils` asserts |
| 19 | `f3ade2c6cd` | `rdf/test/ProvRdf.test.ts` | `-78,13 +79,13` | 0/1 | Not useful: equal-strength assertion-style rewrite; remaining style rows belong to the #1875 detector cohorts |
| 20 | `f3ade2c6cd` | `rdf/test/ProvRdf.test.ts` | `-93,7 +94,7` | 0/1 | Not useful: equal-strength assertion-style rewrite; remaining style rows belong to the #1875 detector cohorts |
| 21 | `f3ade2c6cd` | `rdf/test/ProvRdf.test.ts` | `-260,7 +261,7` | 0/1 | Superseded by the d88e376619 port below (tag-exact failure assertions) |
| 22 | `f3ade2c6cd` | `rdf/test/ProvRdf.test.ts` | `-268,7 +269,7` | 0/1 | Superseded by the d88e376619 port below (tag-exact failure assertions) |
| 23 | `f3ade2c6cd` | `rdf/test/ProvRdf.test.ts` | `-277,7 +278,7` | 0/1 | Superseded by the d88e376619 port below (tag-exact failure assertions) |
| 24 | `f3ade2c6cd` | `rdf/test/ProvRdf.test.ts` | `-286,7 +287,7` | 0/1 | Superseded by the d88e376619 port below (tag-exact failure assertions) |
| 25 | `f3ade2c6cd` | `rdf/test/ProvRdf.test.ts` | `-296,7 +297,7` | 0/1 | Superseded by the d88e376619 port below (tag-exact failure assertions) |
| 26 | `f3ade2c6cd` | `rdf/test/ProvRdf.test.ts` | `-307,17 +308,13` | 0/3 | Superseded by the d88e376619 port below (tag-exact failure assertions) |
| 27 | `f3ade2c6cd` | `rdf/test/ProvRdf.test.ts` | `-327,7 +324,7` | 0/1 | Superseded by the d88e376619 port below (tag-exact failure assertions) |
| 28 | `f3ade2c6cd` | `rdf/test/ProvRdf.test.ts` | `-378,10 +375,10` | 0/2 | Superseded by the d88e376619 port below (tag-exact failure assertions) |
| 29 | `f3ade2c6cd` | `rdf/test/ProvRdf.test.ts` | `-391,7 +388,7` | 0/1 | Superseded by the d88e376619 port below (tag-exact failure assertions) |
| 30 | `f3ade2c6cd` | `rdf/test/ProvRdf.test.ts` | `-401,7 +398,7` | 0/1 | Superseded by the d88e376619 port below (tag-exact failure assertions) |
| 31 | `f3ade2c6cd` | `rdf/test/ProvRdf.test.ts` | `-420,9 +417,9` | 0/3 | Superseded by the d88e376619 port below (tag-exact failure assertions) |
| 32 | `f3ade2c6cd` | `rdf/test/ProvRdf.test.ts` | `-435,15 +432,15` | 0/3 | Superseded by the d88e376619 port below (tag-exact failure assertions) |
| 33 | `f3ade2c6cd` | `rdf/test/ProvRdf.test.ts` | `-453,7 +450,7` | 0/1 | Superseded by the d88e376619 port below (tag-exact failure assertions) |
| 34 | `f3ade2c6cd` | `rdf/test/ProvRdf.test.ts` | `-468,14 +465,14` | 0/2 | Superseded by the d88e376619 port below (tag-exact failure assertions) |
| 35 | `f3ade2c6cd` | `rdf/test/Rdf.test.ts` | `-114,7 +114,8` | 0/2 | Equivalent drift: main imports from `effect/<Module>` and already uses `@effect/vitest/utils` asserts |
| 36 | `f3ade2c6cd` | `rdf/test/Rdf.test.ts` | `-172,7 +173,7` | 0/1 | Not useful: equal-strength assertion-style rewrite; remaining style rows belong to the #1875 detector cohorts |
| 37 | `f3ade2c6cd` | `rdf/test/Rdf.test.ts` | `-193,7 +194,7` | 0/1 | Not useful: equal-strength assertion-style rewrite; remaining style rows belong to the #1875 detector cohorts |
| 38 | `f3ade2c6cd` | `rdf/test/Rdf.test.ts` | `-499,19 +500,19` | 0/3 | Superseded by the d88e376619 port below (tag-exact failure assertions) |
| 39 | `f3ade2c6cd` | `rdf/test/Rdf.test.ts` | `-540,8 +541,8` | 2/2 | Not useful: equal-strength assertion-style rewrite; remaining style rows belong to the #1875 detector cohorts |
| 40 | `f3ade2c6cd` | `rdf/test/Rdf.test.ts` | `-567,8 +568,8` | 2/2 | Not useful: equal-strength assertion-style rewrite; remaining style rows belong to the #1875 detector cohorts |
| 41 | `f3ade2c6cd` | `rdf/test/Rdf.test.ts` | `-635,8 +636,8` | 2/2 | Not useful: equal-strength assertion-style rewrite; remaining style rows belong to the #1875 detector cohorts |
| 42 | `f3ade2c6cd` | `rdf/test/Rdf.test.ts` | `-650,7 +651,7` | 1/1 | Not useful: equal-strength assertion-style rewrite; remaining style rows belong to the #1875 detector cohorts |
| 43 | `f3ade2c6cd` | `rdf/test/Rdf.test.ts` | `-698,7 +699,7` | 0/1 | Superseded by the d88e376619 port below (tag-exact failure assertions) |
| 44 | `f3ade2c6cd` | `rdf/test/Rdf.test.ts` | `-713,10 +714,16` | 6/8 | Not useful: equal-strength assertion-style rewrite; remaining style rows belong to the #1875 detector cohorts |
| 45 | `f3ade2c6cd` | `rdf/test/Rdf.test.ts` | `-762,11 +769,11` | 5/5 | Not useful: equal-strength assertion-style rewrite; remaining style rows belong to the #1875 detector cohorts |
| 46 | `f3ade2c6cd` | `rdf/test/SemanticSchemaConformance.test.ts` | `-12,6 +12,7` | 0/1 | Equivalent drift: main imports from `effect/<Module>` and already uses `@effect/vitest/utils` asserts |
| 47 | `f3ade2c6cd` | `rdf/test/SemanticSchemaConformance.test.ts` | `-180,12 +181,14` | 3/5 | Not useful: equal-strength assertion-style rewrite; remaining style rows belong to the #1875 detector cohorts |
| 48 | `f3ade2c6cd` | `rdf/test/SemanticSchemaConformance.test.ts` | `-196,12 +199,12` | 0/2 | Superseded by the d88e376619 port below (tag-exact failure assertions) |
| 49 | `f3ade2c6cd` | `rdf/test/SemanticSchemaConformance.test.ts` | `-215,7 +218,7` | 0/1 | Superseded by the d88e376619 port below (tag-exact failure assertions) |
| 50 | `f3ade2c6cd` | `rdf/test/SemanticSchemaConformance.test.ts` | `-226,15 +229,15` | 0/6 | Not useful: equal-strength assertion-style rewrite; remaining style rows belong to the #1875 detector cohorts |
| 51 | `f3ade2c6cd` | `rdf/test/SemanticSchemaConformance.test.ts` | `-272,17 +275,18` | 0/6 | Not useful: equal-strength assertion-style rewrite; remaining style rows belong to the #1875 detector cohorts |
| 52 | `f3ade2c6cd` | `rdf/test/URI.test.ts` | `-9,6 +9,7` | 0/1 | Equivalent drift: main imports from `effect/<Module>` and already uses `@effect/vitest/utils` asserts |
| 53 | `f3ade2c6cd` | `rdf/test/URI.test.ts` | `-47,13 +48,13` | 0/2 | Superseded by the d88e376619 port below (tag-exact failure assertions) |
| 54 | `f3ade2c6cd` | `rdf/test/URI.test.ts` | `-61,7 +62,7` | 0/1 | Superseded by the d88e376619 port below (tag-exact failure assertions) |
| 55 | `7c62e550c0` | `canon/history/2026-09-26-rdf-assertion-migration.md` | `-34,6 +34,13` | absent | Not replayed: historical canon-packet record; preserved in the export |
| 56 | `d88e376619` | `canon/history/2026-09-26-rdf-failure-assertions.md` | `-0,0 +1,45` | absent | Not replayed: historical canon-packet record; preserved in the export |
| 57 | `d88e376619` | `rdf/test/IRI.test.ts` | `-2,8 +2,9` | 1/2 | Ported: imports adapted to main and the shared `helpers/FailureTags.ts` |
| 58 | `d88e376619` | `rdf/test/IRI.test.ts` | `-25,19 +26,58` | 0/30 | Ported: tag-exact assertion through the shared helper |
| 59 | `d88e376619` | `rdf/test/InteropAndMetadata.test.ts` | `-6,7 +6,7` | 0/1 | Not useful: drops a redundant `O.isSome` precheck; main keeps it beside the stronger name equality |
| 60 | `d88e376619` | `rdf/test/InteropAndMetadata.test.ts` | `-76,7 +76,6` | 0/0 | Not useful: drops a redundant `O.isSome` precheck; main keeps it beside the stronger name equality |
| 61 | `d88e376619` | `rdf/test/ProvO.test.ts` | `-23,8 +23,9` | 0/3 | Ported: imports adapted to main and the shared `helpers/FailureTags.ts` |
| 62 | `d88e376619` | `rdf/test/ProvO.test.ts` | `-189,10 +190,62` | 8/40 | Ported: tag-exact assertion through the shared helper |
| 63 | `d88e376619` | `rdf/test/ProvRdf.test.ts` | `-26,7 +26,7` | 0/1 | Ported: imports adapted to main and the shared `helpers/FailureTags.ts` |
| 64 | `d88e376619` | `rdf/test/ProvRdf.test.ts` | `-79,12 +79,14` | 3/5 | Ported (failure tag); success half equivalent: main asserts success and the exact `provType` list |
| 65 | `d88e376619` | `rdf/test/ProvRdf.test.ts` | `-94,7 +96,10` | 0/3 | Ported: tag-exact assertion through the shared helper |
| 66 | `d88e376619` | `rdf/test/ProvRdf.test.ts` | `-261,7 +266,10` | 2/3 | Ported: tag-exact assertion through the shared helper |
| 67 | `d88e376619` | `rdf/test/ProvRdf.test.ts` | `-269,7 +277,10` | 2/3 | Ported: tag-exact assertion through the shared helper |
| 68 | `d88e376619` | `rdf/test/ProvRdf.test.ts` | `-278,7 +289,10` | 2/3 | Ported: tag-exact assertion through the shared helper |
| 69 | `d88e376619` | `rdf/test/ProvRdf.test.ts` | `-287,7 +301,10` | 2/3 | Ported: tag-exact assertion through the shared helper |
| 70 | `d88e376619` | `rdf/test/ProvRdf.test.ts` | `-297,7 +314,10` | 2/3 | Ported: tag-exact assertion through the shared helper |
| 71 | `d88e376619` | `rdf/test/ProvRdf.test.ts` | `-308,12 +328,26` | 6/15 | Ported: tag-exact assertion through the shared helper |
| 72 | `d88e376619` | `rdf/test/ProvRdf.test.ts` | `-324,7 +358,10` | 2/3 | Ported: tag-exact assertion through the shared helper |
| 73 | `d88e376619` | `rdf/test/ProvRdf.test.ts` | `-375,9 +412,16` | 4/8 | Ported: tag-exact assertion through the shared helper |
| 74 | `d88e376619` | `rdf/test/ProvRdf.test.ts` | `-388,7 +432,10` | 2/3 | Ported: tag-exact assertion through the shared helper |
| 75 | `d88e376619` | `rdf/test/ProvRdf.test.ts` | `-398,7 +445,10` | 2/3 | Ported: tag-exact assertion through the shared helper |
| 76 | `d88e376619` | `rdf/test/ProvRdf.test.ts` | `-417,9 +467,18` | 6/9 | Ported: tag-exact assertion through the shared helper |
| 77 | `d88e376619` | `rdf/test/ProvRdf.test.ts` | `-432,15 +491,24` | 6/9 | Ported: tag-exact assertion through the shared helper |
| 78 | `d88e376619` | `rdf/test/ProvRdf.test.ts` | `-450,7 +518,10` | 2/3 | Ported: tag-exact assertion through the shared helper |
| 79 | `d88e376619` | `rdf/test/ProvRdf.test.ts` | `-465,14 +536,20` | 4/6 | Ported: tag-exact assertion through the shared helper |
| 80 | `d88e376619` | `rdf/test/Rdf.test.ts` | `-114,7 +114,7` | 0/1 | Ported: imports adapted to main and the shared `helpers/FailureTags.ts` |
| 81 | `d88e376619` | `rdf/test/Rdf.test.ts` | `-500,19 +500,58` | 3/30 | Ported: tag-exact assertion through the shared helper |
| 82 | `d88e376619` | `rdf/test/Rdf.test.ts` | `-699,7 +738,20` | 1/10 | Ported: tag-exact assertion through the shared helper |
| 83 | `d88e376619` | `rdf/test/SemanticSchemaConformance.test.ts` | `-12,7 +12,7` | 0/1 | Ported: imports adapted to main and the shared `helpers/FailureTags.ts` |
| 84 | `d88e376619` | `rdf/test/SemanticSchemaConformance.test.ts` | `-199,12 +199,18` | 0/6 | Ported: tag-exact assertion through the shared helper |
| 85 | `d88e376619` | `rdf/test/SemanticSchemaConformance.test.ts` | `-218,7 +224,10` | 0/3 | Ported: tag-exact assertion through the shared helper |
| 86 | `d88e376619` | `rdf/test/URI.test.ts` | `-9,8 +9,9` | 0/2 | Ported: imports adapted to main and the shared `helpers/FailureTags.ts` |
| 87 | `d88e376619` | `rdf/test/URI.test.ts` | `-48,13 +49,39` | 0/20 | Ported: tag-exact assertion through the shared helper |
| 88 | `d88e376619` | `rdf/test/URI.test.ts` | `-62,7 +89,20` | 0/10 | Ported: tag-exact assertion through the shared helper |

### `effect-vitest-rdf-unstaged.patch`

| # | Commit | File | Hunk | Added lines on main | Disposition |
| --- | --- | --- | --- | --- | --- |
| 1 | `-` | `canon/research/OPPORTUNITIES.md` | `-2345,3 +2345,19` | 0/14 | Present on main: `ProvDateTime` caps the year at 9999 (`src/Prov.ts`), so encode and decode agree |
| 2 | `-` | `rdf/test/IRI.test.ts` | `-1,9 +1,10` | 2/2 | Present on main: same schema-derived property/`it.effect` form with current schema models and `fcRuns` floors |
| 3 | `-` | `rdf/test/IRI.test.ts` | `-84,21 +85,46` | 23/30 | Present on main: same schema-derived property/`it.effect` form with current schema models and `fcRuns` floors |
| 4 | `-` | `rdf/test/ProvRdf.test.ts` | `-1,10 +1,14` | 4/4 | Present on main: same schema-derived property/`it.effect` form with current schema models and `fcRuns` floors |
| 5 | `-` | `rdf/test/ProvRdf.test.ts` | `-25,6 +29,7` | 1/1 | Present on main: same schema-derived property/`it.effect` form with current schema models and `fcRuns` floors |
| 6 | `-` | `rdf/test/ProvRdf.test.ts` | `-45,6 +50,13` | 4/5 | Present on main: same schema-derived property/`it.effect` form with current schema models and `fcRuns` floors |
| 7 | `-` | `rdf/test/ProvRdf.test.ts` | `-183,41 +195,92` | 77/77 | Present on main: same schema-derived property/`it.effect` form with current schema models and `fcRuns` floors |
| 8 | `-` | `rdf/test/Rdf.test.ts` | `-164,46 +164,6` | 0/0 | Present on main: the removed `assertRoundTrips`/`assertDecodeEncodeDecodeStable` helpers no longer exist; properties replaced them |
| 9 | `-` | `rdf/test/Rdf.test.ts` | `-361,44 +321,44` | 30/30 | Present on main: same schema-derived property/`it.effect` form with current schema models and `fcRuns` floors |
| 10 | `-` | `rdf/test/Rdf.test.ts` | `-430,11 +390,13` | 3/5 | Present on main: same schema-derived property/`it.effect` form with current schema models and `fcRuns` floors |
| 11 | `-` | `rdf/test/Rdf.test.ts` | `-778,23 +740,16` | 9/9 | Present on main: same schema-derived property/`it.effect` form with current schema models and `fcRuns` floors |
| 12 | `-` | `rdf/test/Rdf.test.ts` | `-892,21 +847,155` | 89/126 | Present on main: same schema-derived property/`it.effect` form with current schema models and `fcRuns` floors |
| 13 | `-` | `rdf/test/URI.test.ts` | `-7,10 +7,11` | 2/2 | Present on main: same schema-derived property/`it.effect` form with current schema models and `fcRuns` floors |
| 14 | `-` | `rdf/test/URI.test.ts` | `-111,19 +112,44` | 23/30 | Present on main: same schema-derived property/`it.effect` form with current schema models and `fcRuns` floors |

### `pacer-commit.mbox`

| # | Commit | File | Hunk | Added lines on main | Disposition |
| --- | --- | --- | --- | --- | --- |
| 1 | `e8feb7244a` | `.changeset/pacer-instrumented-tests.md` | `-0,0 +1,5` | absent | Discarded: stale changeset for a test-only change (stage-4 ruling) |
| 2 | `e8feb7244a` | `bun.lock` | `-1346,6 +1346,8` | 2/2 | Equivalent drift: `@beep/test-runner` present; `@beep/fc-runs` superseded by `fcRuns` from `@beep/test-utils` |
| 3 | `e8feb7244a` | `canon/research/2026-09-25-pacer-partial-proof.md` | `-0,0 +1,22` | absent | Not replayed: historical record; the cancellation-deletion gap it reports is fixed on main and covered by the parameterized interruption test |
| 4 | `e8feb7244a` | `canon/research/OPPORTUNITIES.md` | `-2298,3 +2298,14` | 0/9 | Not replayed: historical record; the cancellation-deletion gap it reports is fixed on main and covered by the parameterized interruption test |
| 5 | `e8feb7244a` | `canon/research/pacer-cache-review.md` | `-0,0 +1,6` | absent | Not replayed: historical record; the cancellation-deletion gap it reports is fixed on main and covered by the parameterized interruption test |
| 6 | `e8feb7244a` | `pacer/package.json` | `-71,6 +71,8` | 1/2 | Equivalent drift: `@beep/test-runner` present; `@beep/fc-runs` superseded by `fcRuns` from `@beep/test-utils` |
| 7 | `e8feb7244a` | `pacer/test/Pacer.equivalence.test.ts` | `-1,5 +1,6` | 2/2 | Present on main |
| 8 | `e8feb7244a` | `pacer/test/Pacer.test.ts` | `-1,4 +1,4` | 0/1 | Equivalent drift: main imports `fcRuns`/`provideScopedLayer` from `@beep/test-utils` and `it` from `@beep/test-runner` |
| 9 | `e8feb7244a` | `pacer/test/Pacer.test.ts` | `-15,13 +15,15` | 2/4 | Equivalent drift: main imports `fcRuns`/`provideScopedLayer` from `@beep/test-utils` and `it` from `@beep/test-runner` |
| 10 | `e8feb7244a` | `pacer/test/Pacer.test.ts` | `-31,11 +33,6` | 0/0 | Equivalent drift: main imports `fcRuns`/`provideScopedLayer` from `@beep/test-utils` and `it` from `@beep/test-runner` |
| 11 | `e8feb7244a` | `pacer/test/Pacer.test.ts` | `-45,8 +42,12` | 2/5 | Equivalent drift: main returns `Arbitrary.sampleEffect`, uses `it.effect.prop` and explicit `fcRuns` floors |
| 12 | `e8feb7244a` | `pacer/test/Pacer.test.ts` | `-66,35 +67,35` | 6/6 | Equivalent drift: main returns `Arbitrary.sampleEffect`, uses `it.effect.prop` and explicit `fcRuns` floors |
| 13 | `e8feb7244a` | `pacer/test/Pacer.test.ts` | `-130,7 +131,8` | 2/2 | Equivalent drift: main returns `Arbitrary.sampleEffect`, uses `it.effect.prop` and explicit `fcRuns` floors |
| 14 | `e8feb7244a` | `pacer/test/Pacer.test.ts` | `-142,18 +144,21` | 2/5 | Equivalent drift: main returns `Arbitrary.sampleEffect`, uses `it.effect.prop` and explicit `fcRuns` floors |
| 15 | `e8feb7244a` | `pacer/test/Pacer.test.ts` | `-166,60 +171,61` | 36/41 | Equivalent drift: main uses 10-second layer timeouts and the same layout; phase `Effect.log` lines not useful (timing-receipt instrumentation only) |
| 16 | `e8feb7244a` | `pacer/test/Pacer.test.ts` | `-234,30 +240,35` | 15/20 | Equivalent drift: main uses 10-second layer timeouts and the same layout; phase `Effect.log` lines not useful (timing-receipt instrumentation only) |
| 17 | `e8feb7244a` | `pacer/test/Pacer.test.ts` | `-269,7 +280,7` | 0/1 | Equivalent drift: main uses 10-second layer timeouts and the same layout; phase `Effect.log` lines not useful (timing-receipt instrumentation only) |
| 18 | `e8feb7244a` | `pacer/test/Pacer.test.ts` | `-282,7 +293,7` | 0/1 | Equivalent drift: main uses 10-second layer timeouts and the same layout; phase `Effect.log` lines not useful (timing-receipt instrumentation only) |
| 19 | `e8feb7244a` | `pacer/test/Pacer.test.ts` | `-296,86 +307,93` | 51/62 | Equivalent drift: main uses 10-second layer timeouts and the same layout; phase `Effect.log` lines not useful (timing-receipt instrumentation only) |
| 20 | `e8feb7244a` | `pacer/test/Pacer.test.ts` | `-388,3 +406,39` | 11/31 | Ported: logout assertion added to main's parameterized interruption test; deletion half already on main |
| 21 | `e8feb7244a` | `pacer/tsconfig.check.json` | `-10,6 +10,12` | 3/4 | Equivalent drift: `@beep/test-runner` present; `@beep/fc-runs` superseded by `fcRuns` from `@beep/test-utils` |
| 22 | `e8feb7244a` | `pacer/tsconfig.json` | `-16,6 +16,12` | 3/4 | Equivalent drift: `@beep/test-runner` present; `@beep/fc-runs` superseded by `fcRuns` from `@beep/test-utils` |
| 23 | `e8feb7244a` | `standards/cache-qualification-baseline.json` | `-1 +1` | 0/1 | Not replayed: baseline/boundary rows for dependencies this port does not add (S31) |
| 24 | `e8feb7244a` | `standards/fallow.boundaries.generated.jsonc` | `-2789,15 +2789,19` | 4/4 | Not replayed: baseline/boundary rows for dependencies this port does not add (S31) |

## Verification

All commands ran in the lane on the final working tree. Heavy commands ran
through `beep-heavy`.

| Command | Result |
| --- | --- |
| `bunx vitest run` in `packages/foundation/modeling/rdf` | 11 files, 112 tests passed (Node) |
| `bunx --bun vitest run` in `packages/foundation/modeling/rdf` | 11 files, 112 tests passed (Bun) |
| `bunx vitest run` in `packages/drivers/pacer` | 2 files, 26 tests passed (Node) |
| `bunx --bun vitest run` in `packages/drivers/pacer` | 2 files, 26 tests passed (Bun) |
| `bun run coverage -- --filter=@beep/rdf --filter=@beep/pacer` | `[coverage-ratchet] ok: compared 2 package(s)`; rdf all files 98.53 / 99.73 / 95.97 / 98.58, pacer 91.76 / 76.99 / 83.33 / 92.49 (stmts / branches / funcs / lines) |
| `bun run beep lint effect-vitest` | `introduced=0 resolved=66` |
| `bun run beep quality effect-diagnostics --filter @beep/rdf` | 0 errors in check and test overlays |
| `bun run beep quality effect-diagnostics --filter @beep/pacer` | 0 errors in check and test overlays |
| `bunx oxlint <9 changed files>` | exit 0, no findings |
| `bunx biome check test` in both packages | clean |
| `bun run beep quality package-verify @beep/rdf` | ok audit, ok docgen |
| `bun run beep quality package-verify @beep/pacer` | ok audit, ok docgen |
| `bun run beep quality fallow audit --base origin/main --check` | `status: ok`, 0 findings (dirty worktree) |
| `bun run beep goals doctor` | no new blocking findings |
| `bun run beep laws retired-effect-paths` | `findings=0` |

The first `package-verify @beep/rdf` run failed on extensionless relative helper
imports (TS2835). The imports now use `./helpers/FailureTags.ts`, following the
repo-cli test helpers, and the rerun passed. Knowledge refs and the goals doctor
read the committed tree, so the driver reruns them on the final commit.
No inventory, baseline or exception row is added.

## Reversal

Revert the PR. The exports, mboxes and predecessor `.gz` patches are unchanged and
can be replayed with `git apply` at their recorded heads.
