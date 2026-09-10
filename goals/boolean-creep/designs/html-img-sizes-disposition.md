# Instance

- id: `html-img-sizes-disposition`
- exact source SHA: `3330f9881a50c96d3f2ec0fcad76f0f7a09027e4`
- corpus source SHA: `52fcc8d1353db9481ef9edb6cc9619500f95568d`
- file:line: `packages/foundation/modeling/html/src/Html.conformance.ts:987`
- symbol: `inspectImgResponsiveRelationships`
- members: `hasSrcset`, `hasSizes`, `loadingIsLazy`, `sizesIsExactlyAuto`, `missingSizes`, `incompatibleSizes`
- evidence: E4 at `Html.conformance.ts:983-1002` — attribute presence, srcset profile, source-size parse/auto state, and lazy loading jointly determine missing and incompatible outcomes.

# Current shape

The function derives six correlated locals from three raw attributes. Presence is distinct from parse success: a present invalid `srcset` has `hasSrcset` true with no profile, and a present invalid `sizes` has `hasSizes` true with no analysis. Exact-auto is ASCII-case-insensitive equality with the entire untrimmed string; it is narrower than parsed `analysis.usesAuto`. Lazy loading affects only parsed-size incompatibility.

The two issue decisions are mutually exclusive because missing requires absent sizes while incompatibility requires successful sizes analysis. Their four observable outcomes remain `absent-ok`, `absent-missing`, `present-ok`, and `present-incompatible`. No caller observes any decision-only input after the issue array is built. `imgAllowsAutoSizes` at lines 968-973 remains because the picture-source relationship separately consumes it.

# Cardinality gap

Six booleans represent 64 tuples. Exactly 20 are reachable from supported absent, invalid-present, density-srcset, width-srcset, parsed-size, exact-auto, uses-auto, and lazy/non-lazy inputs. Columns are `hasSrcset hasSizes loadingIsLazy sizesIsExactlyAuto missingSizes incompatibleSizes`:

| bits | representative source class |
| --- | --- |
| `000000`, `001000` | no srcset, no sizes; eager/lazy |
| `010000`, `011000` | no srcset, invalid-present sizes; eager/lazy |
| `010001`, `011001` | no srcset, parsed non-exact sizes; eager/lazy |
| `010101`, `011100` | no srcset, exact auto; eager incompatible/lazy allowed |
| `100000`, `101000` | present non-width srcset, absent sizes; eager/lazy |
| `100010`, `101010` | width srcset, absent sizes; eager/lazy missing |
| `110000`, `111000` | present srcset and present sizes, relationship-compatible class; eager/lazy |
| `110001`, `111001` | parsed incompatible class without exact-auto; eager/lazy representatives |
| `110100`, `111100` | exact-auto compatible class; eager/lazy representatives |
| `110101`, `111101` | exact-auto incompatible class; eager/lazy representatives |

The representative labels intentionally aggregate raw parser classes that project to the same six bits. The four output dispositions preserve all observable behavior of these 20 tuples because only `missingSizes` and `incompatibleSizes` select diagnostics, and they never coexist.

# Target schema

Reuse the private `ResponsiveSizesDisposition = LiteralKit(["absent-ok", "absent-missing", "present-ok", "present-incompatible"])` shared with the adjacent link classifier. Keep the img classification explicit and consume all decision detail inside it; do not add a generic classifier or another flag-bearing helper.

Match sizes attribute presence first. Absent plus width-profile srcset selects `absent-missing`; other absent input selects `absent-ok`. Present invalid sizes remains `present-ok` because syntax validation already reports it. For parsed sizes, preserve the current three branches: absent srcset is allowed only for lazy plus exact whole-string auto; density srcset is incompatible; width srcset using auto is incompatible unless lazy. Evaluate srcset presence, lazy loading, and exact-auto directly inside this arm, without retaining locals.

Match the disposition to the exact existing issues. Missing retains path `attributes.srcset` and message `<img srcset> using width descriptors requires sizes`; incompatible retains path `attributes.sizes` and message `<img sizes> requires a width-descriptor srcset, except for loading=lazy with sizes=auto`. Both retain rule and ordering.

# Migration inventory

- `Html.conformance.ts:12-24` — reuse the existing `LiteralKit` import and `$I` annotation owner.
- `Html.conformance.ts:334-350` — reuse `stringAttributeValue`, `srcsetProfile`, and `sourceSizeAnalysis` unchanged.
- `Html.conformance.ts:972-977` — retain `imgAllowsAutoSizes` for the independent picture-source reader at line 1079.
- `Html.conformance.ts:979-1023` — replace all six locals and issue spreads with one direct classifier plus exhaustive disposition match.
- `Html.conformance.ts:1187-1197,2149-2165` — preserve dispatch and global issue order.
- `internal/conformance/Html.conformance-contracts.ts:235-245`, `Html.srcset.ts:195-251`, and `Html.source-size.ts:675-834` — no edit; retain attribute/parser semantics.
- `test/Html.responsive-image-conformance.test.ts:35-67,178-183` — cover all dispositions and the 20-bit truth-table classes with representative raw values.
- `src/index.ts:64-91` and `package.json:44-74` — no export change.

Targeted source/barrel search found no second owner or consumer of these locals.

# Guard-deletion accounting

Delete `hasSrcset`, `hasSizes`, `loadingIsLazy`, `sizesIsExactlyAuto`, `missingSizes`, and `incompatibleSizes`, their negations, both issue spreads, and empty fallbacks at lines 987-1021. Presence, lazy, and exact-auto predicates are evaluated only inside the classification arm and are not returned or moved to a helper. Keep raw `srcset`, `sizesValue`, profile, and parsed analysis as parser inputs. Keep `imgAllowsAutoSizes` solely for its separate picture-source consumer.

# Encoded-side impact

None. This is private derived control flow. HTML AST fields, accepted inputs, parser results, serialization, and public exports do not change. Preserve exact diagnostic path, rule, message, order, invalid-present semantics, width/density profiles, and narrow lazy plus exact-auto exception.

# Test impact

Through public `inspectConformance`, assert exact issues for all four outcomes. Preserve lazy `"AUTO"` without srcset, reject non-exact `"auto, 100vw"` without srcset, retain lazy parsed-auto with width srcset, and retain non-lazy incompatibility. Present invalid `"10%"` continues to emit only the specialized syntax issue at the same ordering point. Existing parser tests remain grammar proof.

# Risk and sequencing

Tier 1 private derived refactor, designed and landed with `html-link-imagesizes-disposition`. Main risks are equating presence with parse success or broadening exact-auto. Keep classifications explicit and run focused responsive-image/source-size tests plus full `@beep/html` verification. No new state, API, dependency, generated file, or generic helper is introduced.
