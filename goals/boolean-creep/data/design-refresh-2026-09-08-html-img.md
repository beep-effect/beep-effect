# HTML img sizes design refresh — 2026-09-08

Source reviewed: packet HEAD `05405bf322da0ca7eb88b8bb402145081e8fded6`;
the inspected `packages/**/src` and `apps/**/src` corpus matches
`origin/main` at `be8995e66aeefedf0dabf131deaeaaf25c8e6fc8`.

## Owned design

- `designs/html-img-sizes-disposition.md` — designed the newly admitted
  `hasSizes`, `missingSizes`, and `incompatibleSizes` cluster as a private
  four-value `ImgSizesDisposition` LiteralKit. The design derives presence
  from the canonical attribute normalizer and compatibility from the existing
  parsed source-size analysis, preserving the important case where a present
  invalid `sizes` string has no analysis but still is not missing.

## Source and consumer audit

- The cluster is written and read only inside
  `packages/foundation/modeling/html/src/Html.conformance.ts:975-1019`.
- Its only function reader is the private img dispatcher at
  `Html.conformance.ts:1183-1193`; issue ordering is owned by the element
  collector at `Html.conformance.ts:2149-2165`.
- Reused owners are `htmlAttributeValue` in
  `src/internal/conformance/Html.conformance-contracts.ts:235-236`,
  `sourceSizeAnalysis` in `src/Html.conformance.ts:334-346`,
  `inspectSourceSizeList` in `src/Html.source-size.ts:831-834`, and the
  existing file identity composer. No equivalent disposition owner exists in
  source or package barrels.
- Focused behavior coverage lives in
  `test/Html.responsive-image-conformance.test.ts:35-67`; source-size parser
  coverage remains in `test/Html.source-size.test.ts`.

## Verification

- Targeted source, test, and barrel searches covered all declarations,
  readers, writers, parser owners, diagnostics, and public exports named by
  the design.
- `bun goals/boolean-creep/ops/validate-designs.ts` was run after the edit.
- A scoped `git diff --check` was run for the new design and this handoff.

No product source, test, inventory/status, dependency, generated file, or Git
reference was changed. No design blocker remains.
