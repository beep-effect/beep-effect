# HTML responsive full-cluster design refresh — 2026-09-09

## Source

- Repository source: `7440cb8c4302ce64b87860069a464bafbf65f576`
- Compared package/app corpus: `9b7553f618b2b3ee10e11a3d6ee93606f3e40ce1`
- Round-26 input: `goals/boolean-creep/data/sweeps/refresh-2026-09-08-r26-main-9b7553/r26-foundation-modeling-rest.jsonl`

## `html-img-sizes-disposition`

The round-26 `hasSrcset`/`missingSizes` candidate overlaps the existing image relationship owner and must not become a second design. The complete canonical member cluster is:

`[hasSrcset,hasSizes,loadingIsLazy,sizesIsExactlyAuto,missingSizes,incompatibleSizes]`

It has 64 representable Boolean tuples and 20 reachable tuples. The design records the complete bit table. Its source-state enumeration distinguishes absent from invalid-present attributes, `srcset` density/width/invalid profiles, absent/invalid/parsed `sizes`, parsed `usesAuto` from exact whole-string auto, and lazy from non-lazy loading.

E4 at `packages/foundation/modeling/html/src/Html.conformance.ts:979-998` proves the cluster: width profile plus absent sizes produces the missing issue; successful source-size analysis plus raw srcset presence/profile, lazy loading, and exact-auto jointly produces incompatibility. Missing and incompatible cannot coexist because the former requires absent sizes and the latter requires successful analysis of present sizes.

The existing four `ResponsiveSizesDisposition` outcomes remain behavior-complete: `absent-ok`, `absent-missing`, `present-ok`, and `present-incompatible`. The 20 source tuples collapse to these outcomes only after all decision inputs are consumed; none has another observer. The design deletes all six locals and does not move them into a helper. Raw parser inputs remain local. `imgAllowsAutoSizes` remains because `inspectPictureSourceResponsiveRelationships` independently reads it at line 1079.

Exact diagnostics, paths, rule, order, syntax-error precedence, case-insensitive but untrimmed exact-auto comparison, parsed `usesAuto`, lazy exception, HTML AST, and parser behavior remain unchanged.

## `html-link-imagesizes-disposition`

The coupled link audit expands its canonical member cluster to:

`[hasImageSrcset,hasImageSizes,imageSizesIncompatible]`

It has 8 representable tuples and 6 reachable tuples: `000`, `010`, `011`, `100`, `110`, and `111`. Attribute presence again differs from parsing success. The `100` tuple contains both width-profile missing behavior and density/invalid-profile absent-ok behavior; profile is consumed directly during classification and is not another stored Boolean member.

E4 at `Html.conformance.ts:1025-1056` proves that parsed `imagesizes` is incompatible only when raw `imagesrcset` is absent or has a density profile, while width-profile srcset plus absent `imagesizes` produces the missing issue. The link function reuses the same `ResponsiveSizesDisposition`, deletes all three locals and the inline missing guard, and keeps explicit link-specific classification.

`iconSizesMisplaced` remains outside this owner because it describes the independent `sizes`/`rel` icon rule. Its issue remains last and may coexist with a responsive issue. All existing link diagnostic text, paths, order, invalid-present handling, and HTML inputs remain exact.

## Verification and implementation boundary

The two designs are private Tier 1 derived-control-flow migrations with no encoded-side impact, new state, export, generic classifier, dependency, or generated file. Implement them together so the one private disposition owner and both classifiers move atomically. Tests should cover all four output outcomes and representative raw inputs for every reachable bit tuple, with exact issue arrays and parser syntax issues.

No product source, tests, inventory/status, dependencies, generated files, or git refs were changed. The parent owns inventory reconciliation for image 64/20 and link 8/6.
