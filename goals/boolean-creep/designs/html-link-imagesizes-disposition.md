# Instance

- id: `html-link-imagesizes-disposition`
- exact source SHA: `3330f9881a50c96d3f2ec0fcad76f0f7a09027e4`
- corpus source SHA: `52fcc8d1353db9481ef9edb6cc9619500f95568d`
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

Reuse the private `ResponsiveSizesDisposition` LiteralKit from the adjacent img design. Do not create a second kit or generic classifier.

Classify link input explicitly. Absent plus width-profile `imagesrcset` is `absent-missing`; other absent input is `absent-ok`. Present parsed `imagesizes` with no `imagesrcset` or density profile is `present-incompatible`. Every other present value, including invalid source-size text whose parser returns `None`, is `present-ok`.

Match the disposition to the same issues: `absent-missing` retains `attributes.imagesrcset` and `<link imagesrcset> using width descriptors requires imagesizes`; `present-incompatible` retains `attributes.imagesizes` and `<link imagesizes> requires a width-descriptor imagesrcset`; both keep `attributeRelationship`. Compute `iconSizesMisplaced` independently and append its existing `attributes.sizes` / `<link sizes> requires an icon link relation` issue after the responsive result exactly as today.

# Migration inventory

- `Html.conformance.ts:12-24,968-1020` — reuse the one private literal domain.
- `Html.conformance.ts:334-350` — reuse existing adapters; add no helper.
- `Html.conformance.ts:1025-1070` — replace all three correlated booleans, the inline missing guard, and two responsive conditional spreads with local disposition/match. Leave `iconSizesMisplaced` independent and third.
- `Html.conformance.ts:1187-1197,2149-2165` — preserve dispatch and global issue order.
- `internal/conformance/Html.conformance-contracts.ts:235-245` and `Html.source-size.ts:808-834` — no edit.
- `test/Html.responsive-image-conformance.test.ts:137-176` — cover all outcomes, invalid-present syntax, exact issue order, and coexistence with misplaced icon sizes.
- `src/index.ts:64-91` and `package.json:44-74` — no export change.

Search found no pre-existing responsive disposition beyond the owner introduced by the paired img design and no other reader/writer of these locals.

# Guard-deletion accounting

Delete `hasImageSrcset`, `hasImageSizes`, and `imageSizesIncompatible`, the inline missing guard, both responsive issue spreads, and empty fallbacks at lines 1033-1060. Evaluate attribute presence/profile only within the direct classifier; do not relocate a correlated bit family. Retain `iconSizesMisplaced` and its issue spread because icon `sizes`/`rel` is independent and can coexist with a responsive issue.

# Encoded-side impact

None. The disposition is private and derived. Preserve AST/wire fields, invalid-input treatment, parser behavior, public API, and exact diagnostics/order. The icon issue remains last and can coexist with a responsive issue.

# Test impact

Retain density-only success, width missing, width valid, density/no-srcset incompatibility, and icon rules. Add explicit absent-ok and present-invalid cases. Present invalid `imagesizes` emits its syntax issue without becoming missing or relationship-incompatible. Assert exact messages/order when responsive and icon issues coexist.

# Risk and sequencing

Tier 1 private derived refactor landed with img. Main risks are treating parser failure as absence and folding independent icon placement into responsive state. Run responsive-image/source-size tests plus full `@beep/html` verification. No new state, export, dependency, generated file, or generic helper is introduced.
