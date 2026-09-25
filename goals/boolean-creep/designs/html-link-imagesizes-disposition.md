# Instance

- id: `html-link-imagesizes-disposition`
- exact source SHA: `f137beedb270a071d4aa2ecc1dd52a9d233044d1`
- Audit scope: current owner and its parser adapters, dispatch, public fixtures and exports; this is P2 design refresh, not a new corpus round or independent P3 review.
- file:line: `packages/foundation/modeling/html/src/Html.conformance.ts:1033`
- symbol: `inspectLinkResponsiveRelationships`
- members: `hasImageSrcset`, `hasImageSizes`, `imageSizesIncompatible`
- evidence: E4 at `Html.conformance.ts:1029-1060` — successful parsed `imagesizes` can be incompatible only according to `imagesrcset` presence/profile; width-profile missing remains the direct output decision.

# Current shape

The function derives three correlated locals from raw `imagesrcset`/`imagesizes`, then separately evaluates the width-profile missing condition. Presence remains distinct from parser success: invalid-present attributes have presence true with no profile/analysis. The responsive decisions produce the same four shared dispositions. `iconSizesMisplaced` comes from the separate `sizes` plus `rel` rule and remains independent and last.

# Cardinality gap

The three locals represent eight tuples; six are reachable: `000` (both absent), `010` (sizes present but unparsed/compatible), `011` (parsed sizes with no srcset), `100` (srcset present and sizes absent), `110` (both present/compatible), and `111` (density srcset with parsed sizes). Therefore the corrected cardinality is 8 representable / 6 legal.

Within `100`, width profile selects `absent-missing`, while density/invalid profile selects `absent-ok`; this decision uses source profile rather than another stored local. The four output dispositions preserve all responsive diagnostic behavior.

# Target schema

Introduce exactly one private `ResponsiveSizesDisposition` alongside the adjacent img design; it does not already exist in source. Add `LiteralKit` to the existing `@beep/schema` import (which already supplies `SchemaUtils`). Use the same four cases for both owners:

```ts
const ResponsiveSizesDispositionBase = LiteralKit([
  "absent-ok", "absent-missing", "present-ok", "present-incompatible",
]);
const ResponsiveSizesDisposition = ResponsiveSizesDispositionBase
  .annotations($I.annote("ResponsiveSizesDisposition", {
    description: "Derived responsive-image sizes relationship disposition",
  }))
  .pipe(SchemaUtils.withLiteralKitStatics(ResponsiveSizesDispositionBase));
type ResponsiveSizesDisposition = typeof ResponsiveSizesDisposition.Type;
```

Reuse its `Enum` and literal match surface, keeping the annotated schema and original kit statics together. Do not create another kit or shared generic classifier. The img and link rules are distinct classifiers over their original source values. The cases describe this relationship check only: `present-ok` can still have independent syntax errors.

Classify link input explicitly. Absent plus width-profile `imagesrcset` is `absent-missing`; other absent input is `absent-ok`. Present parsed `imagesizes` with no `imagesrcset` or density profile is `present-incompatible`. Every other present value, including invalid source-size text whose parser returns `None`, is `present-ok`. In particular, invalid-present `imagesrcset` plus parsed `imagesizes` remains `present-ok`: raw srcset presence is true while its profile is `None`. `auto` has no lazy exception for link: it is parsed and follows the same link rules as other parsed sizes.

Match the disposition to the same issues: `absent-missing` retains `attributes.imagesrcset` and `<link imagesrcset> using width descriptors requires imagesizes`; `present-incompatible` retains `attributes.imagesizes` and `<link imagesizes> requires a width-descriptor imagesrcset`; both keep `attributeRelationship`. Compute `iconSizesMisplaced` independently and append its existing `attributes.sizes` / `<link sizes> requires an icon link relation` issue after the responsive result exactly as today.

# Migration inventory

- `Html.conformance.ts:12-24,979-1071` — add `LiteralKit` to imports and introduce the one shared private literal domain with the img migration.
- `Html.conformance.ts:334-350` — reuse existing adapters; add no helper.
- `Html.conformance.ts:1025-1070` — replace all three correlated booleans, the inline missing guard, and two responsive conditional spreads with local disposition/match. Leave `iconSizesMisplaced` independent and third.
- `Html.conformance.ts:1187-1197,2149-2165` — preserve dispatch and global issue order.
- `internal/conformance/Html.conformance-contracts.ts:235-245` and `Html.source-size.ts:808-834` — no edit.
- `test/Html.responsive-image-conformance.test.ts:137-176` — cover all outcomes, invalid-present syntax, exact issue order, and coexistence with misplaced icon sizes.
- `src/index.ts:64-91` and `package.json:44-74` — no export change.

Search found no pre-existing responsive disposition beyond the owner introduced by the paired img design and no other reader/writer of these locals.

# Guard-deletion accounting

Delete the three correlated boolean declarations at 1033-1038, the inline width-and-absence output guard at 1044, and the second responsive output guard at 1053. Replace their two conditional spreads with one disposition match returning zero or one issue. The source predicates needed to classify raw presence and parse results remain necessary inside the classifier; do not claim those domain checks disappear or merely move the same boolean family into a helper. The present branch short-circuits failed parsing to `present-ok`, then selects incompatibility from absent raw srcset or density. The absent branch selects missing only from width profile. There is no legacy normalizer or comment-only invariant here to delete. Retain `iconSizesMisplaced` and its issue spread because icon `sizes`/`rel` is independent and can coexist with a responsive issue.

# Encoded-side impact

None. The disposition is private and derived. Preserve AST/wire fields, invalid-input treatment, parser behavior, public API, and exact diagnostics/order. The icon issue remains last and can coexist with a responsive issue.

# Test impact

Retain density-only success, width missing, width valid, density/no-srcset incompatibility, and icon rules. Add explicit absent-ok and present-invalid cases. Present invalid `imagesizes` emits its syntax issue without becoming missing or relationship-incompatible. Syntax issues use the same `attributeRelationship` rule as pairing issues, so tests must distinguish exact messages/paths rather than filter solely by rule. Assert exact messages/order when responsive and icon issues coexist.

# Risk and sequencing

Tier 1 private derived refactor landed with img. Main risks are treating parser failure as absence and folding independent icon placement into responsive state. Run responsive-image/source-size tests plus full `@beep/html` verification. No new state, export, dependency, generated file, or generic helper is introduced.

# Exact-source audit evidence (2026-09-22)

The finite projection counts the three locals in declared member order. The only excluded tuples are `001` and `101`: parser success is required for incompatibility, hence incompatibility implies raw sizes presence. Every other tuple has a schema-valid AST witness:

| Tuple | imagesrcset | imagesizes |
| --- | --- | --- |
| 000 | absent | absent |
| 010 | absent | `10%` (invalid-present) |
| 011 | absent | `100vw` |
| 100 | `small.png 1x` | absent |
| 110 | `small.png 400w` | `100vw` |
| 111 | `small.png 1x` | `100vw` |

Thus 8/6 remains exact for these locals, while four dispositions retain finer source distinctions needed by output (`100` can be missing for width or allowed for density). No stored product is introduced.

A private read-only probe executed 32 public `Link.make` / `inspectConformance` fixtures: absent/width/density/invalid srcset × absent/ordinary/auto/invalid sizes × no/icon sizes under `rel=preload`. It asserted exact relationship message ordering and retained invalid-size syntax diagnostics. All passed. The retained output records full diagnostic paths/order. These fixtures are bounded behavior evidence, not implementation verification or exhaustive parser coverage.

Existing syntax validation precedes responsive validation at `Html.conformance.ts:2162-2170`; nested traversal appends child paths afterward. Keep exact diagnostic arrays, rule, path, and messages. No public AST/schema/encoding/export/serialization shape changes, no changeset assertion based merely on the package being private, and no source implementation was performed during this audit. Apply the repository's release policy when implementation is prepared.
