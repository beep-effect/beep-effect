# Instance

- id: `html-img-sizes-disposition`
- exact source SHA: `f137beedb270a071d4aa2ecc1dd52a9d233044d1`
- audit scope: current owner, parser contracts, reachable callers, and bounded behavior probes; not a new corpus round or independent P3 review
- file:line: `packages/foundation/modeling/html/src/Html.conformance.ts:987`
- symbol: `inspectImgResponsiveRelationships`
- members: `hasSrcset`, `hasSizes`, `loadingIsLazy`, `sizesIsExactlyAuto`, `missingSizes`, `incompatibleSizes`
- evidence: E4 at `Html.conformance.ts:983-1002` — attribute presence, srcset profile, source-size parse/auto state, and lazy loading jointly determine missing and incompatible outcomes.

# Current shape

The function derives six correlated locals from three raw attributes. Presence is distinct from parse success: a present invalid `srcset` has `hasSrcset` true with no profile, and a present invalid `sizes` has `hasSizes` true with no analysis. Exact-auto is ASCII-case-insensitive equality with the entire untrimmed string; it is narrower than parsed `analysis.usesAuto`. Lazy loading affects only parsed-size incompatibility.

The two issue decisions are mutually exclusive because missing requires absent sizes while incompatibility requires successful sizes analysis. Their four observable outcomes remain `absent-ok`, `absent-missing`, `present-ok`, and `present-incompatible`. No caller observes these decision-only locals after the issue array is built. `present-ok` means no relationship issue from this classifier, not overall syntax or AST validity. `imgAllowsAutoSizes` at lines 972-977 remains because the picture-source relationship separately consumes it.

# Cardinality gap

Six booleans represent 64 tuples. Exactly 20 are reachable from absent, invalid-present, density-srcset, width-srcset, parsed-size, exact-auto, uses-auto, and lazy/non-lazy inputs. Columns are `hasSrcset hasSizes loadingIsLazy sizesIsExactlyAuto missingSizes incompatibleSizes`:

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

The complete finite quotient has four srcset classes (absent; present but non-string/invalid; density; width), five sizes classes (absent; present but non-string/invalid; parsed non-auto; parsed exact-auto; parsed non-exact usesAuto), and two loading outcomes. The predicates cannot distinguish other values within a class. Exact-auto implies present and successfully parsed auto; parse success implies presence. Enumerating this quotient projects to exactly the listed 20 tuples. A 40-fixture witness grid using four srcset values, five sizes values, and eager/lazy reaches every tuple through the current parsers and agrees with public diagnostics. This supports the projection proof; it is not exhaustive parsing of all strings or all ASTs.

# Target schema

Define one private domain for IMG and link in the existing conformance role file; do not export it or introduce a generic classifier:

```ts
const ResponsiveSizesDispositionBase = LiteralKit([
  "absent-ok", "absent-missing", "present-ok", "present-incompatible",
]);
const ResponsiveSizesDisposition = ResponsiveSizesDispositionBase.annotations(
  $I.annote("ResponsiveSizesDisposition", {
    description: "Derived responsive sizes presence and relationship outcome.",
  })
).pipe(SchemaUtils.withLiteralKitStatics(ResponsiveSizesDispositionBase));
type ResponsiveSizesDisposition = typeof ResponsiveSizesDisposition.Type;
```

The annotation rebuild is followed by the existing helper to preserve Enum and $match. Derive a value of this type on each inspection; never persist it. Use its literal helpers or an exhaustive Effect Match to select the issue arrays. No S.Class or tagged union is warranted because these four outcomes carry no payload.

Reuse the private `ResponsiveSizesDisposition = LiteralKit(["absent-ok", "absent-missing", "present-ok", "present-incompatible"])` shared with the adjacent link classifier. Keep the img classification explicit and consume all decision detail inside it; do not add a generic classifier or another flag-bearing helper.

Match **raw attribute presence** first (hasAttribute, not stringAttributeValue or parsed Option presence). Absent plus width-profile srcset selects `absent-missing`; other absent input selects `absent-ok`. Present invalid sizes remains `present-ok` because syntax validation already reports it. For parsed sizes, preserve the current three branches: absent srcset is allowed only for lazy plus exact whole-string auto; density srcset is incompatible; width srcset using auto is incompatible unless lazy. Evaluate srcset presence, lazy loading, and exact-auto directly inside this arm, without retaining locals.

Match the disposition to the exact existing issues. Missing retains path `attributes.srcset` and message `<img srcset> using width descriptors requires sizes`; incompatible retains path `attributes.sizes` and message `<img sizes> requires a width-descriptor srcset, except for loading=lazy with sizes=auto`. Both retain rule and ordering.

# Migration inventory

- `Html.conformance.ts:12-24,81` — add `LiteralKit` to the existing `@beep/schema` import; reuse `SchemaUtils` and `$I`. There is no current LiteralKit import in this file.
- `Html.conformance.ts:334-350` — reuse `stringAttributeValue`, `srcsetProfile`, and `sourceSizeAnalysis` unchanged.
- `Html.conformance.ts:972-977` — retain `imgAllowsAutoSizes` for the independent picture-source reader at line 1083.
- `Html.conformance.ts:979-1023` — replace all six locals and issue spreads with one direct classifier plus exhaustive disposition match.
- `Html.conformance.ts:1187-1197,2165-2173` — preserve dispatch and global issue order.
- `internal/conformance/Html.conformance-contracts.ts:235-245`, `Html.srcset.ts:195-251`, and `Html.source-size.ts:675-834` — no edit; retain attribute/parser semantics.
- `test/Html.responsive-image-conformance.test.ts:35-67,178-183` — cover all dispositions and the 20-bit truth-table classes with representative raw values.
- `src/index.ts:64-91` and `package.json:44-74` — no export change.

Targeted source/barrel search found no second owner or consumer of these locals.

# Guard-deletion accounting

Delete `hasSrcset`, `hasSizes`, `loadingIsLazy`, `sizesIsExactlyAuto`, `missingSizes`, and `incompatibleSizes`, their negations, both issue spreads, and empty fallbacks at lines 987-1021. Presence, lazy, and exact-auto predicates are evaluated only inside the classification arm and are not returned or moved to a helper. Keep raw `srcset`, `sizesValue`, profile, and parsed analysis as parser inputs. Keep `imgAllowsAutoSizes` solely for its separate picture-source consumer.

No schema coherence guard or legacy normalizer exists here, so none is claimed deleted. The actual deletion is six correlated boolean bindings, the missing/incompatible decision network, and its two independent conditional issue spreads; predicates necessary to classify raw inputs remain directly inside the selected arm. Do not merely move the six-bit bag into another helper. The final exhaustive four-way issue match replaces the two spreads while preserving missing-before-incompatible ordering (the two cannot coexist).

# Encoded-side impact

None. This is private derived control flow. HTML AST fields, accepted inputs, parser results, serialization, and public exports do not change. Preserve exact diagnostic path, rule, message, order, invalid-present semantics, width/density profiles, and narrow lazy plus exact-auto exception.

# Test impact

Through public `inspectConformance`, assert exact issues for all four outcomes. Preserve lazy `"AUTO"` without srcset, reject non-exact `"auto, 100vw"` without srcset, retain lazy parsed-auto with width srcset, and retain non-lazy incompatibility. Present invalid `"10%"` continues to emit only the specialized syntax issue at the same ordering point. Existing parser tests remain grammar proof. Add invalid-present srcset plus valid sizes: syntax issue only, with no new incompatibility. Preserve invalid sizes before invalid srcset issue ordering. The picture source test must distinguish parsed `auto, 100vw` (allows following-image auto sizes with lazy) from the no-srcset IMG exception (requires exact whole-string auto). Keep nested fragment paths. The private audit reran 40 witness fixtures, five spelling probes, eight low-level presence probes, four picture fixtures, and one nested fixture with byte-identical saved output; this is baseline evidence, not implementation verification. Low-level null/non-string presence probes document helper semantics, not a claim that every raw value is a legitimate generated AST input.

# Risk and sequencing

Tier 1 private derived refactor, designed and landed with `html-link-imagesizes-disposition`. Main risks are equating presence with parse success or broadening exact-auto. Keep classifications explicit and run focused responsive-image/source-size tests plus full `@beep/html` verification. No new stored state, API, dependency, generated file, or generic helper is introduced. Apply the release policy to the actual implementation diff; private package status alone neither mandates nor prohibits a changeset.
