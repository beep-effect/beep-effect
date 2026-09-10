# HTML responsive-size design refresh — 2026-09-08

Source reviewed: packet HEAD `7440cb8c4302ce64b87860069a464bafbf65f576`; inspected corpus matches `origin/main` at `9b7553f618b2b3ee10e11a3d6ee93606f3e40ce1`.

## Designs

- `designs/html-img-sizes-disposition.md` now covers all four correlated locals, 16 representable states, and six reachable source tuples. It explains why four issue dispositions preserve six tuples: exact-auto is consumed only within the present compatibility arm and has no independent observer.
- `designs/html-link-imagesizes-disposition.md` covers the three legal presence/incompatibility tuples plus the existing inline missing outcome.
- Both designs reuse one private `ResponsiveSizesDisposition` LiteralKit while keeping img and link classification rules explicit. No generic classifier or relocated boolean family is proposed.
- Both preserve attribute presence independently of source-size parse success, exact diagnostics/order, the img lazy exact-auto exception, invalid-present syntax behavior, and independent link icon-size placement.

## Source and test proof

The audit covered `Html.conformance.ts:330-346,968-1066,1183-1193,2149-2165`, canonical attribute normalization at `internal/conformance/Html.conformance-contracts.ts:235-245`, source-size parsing, the public barrel/package exports, and `test/Html.responsive-image-conformance.test.ts:35-183`. Targeted searches found no other readers/writers or reusable disposition owner.

## Verification

Both design files are present and non-empty. Scoped `git diff --check` passes. `bun goals/boolean-creep/ops/validate-designs.ts` passes with `design coverage OK: 103 qualified ids` after all assigned designs were written.

No source, tests, inventory/status, dependency, generated file, or Git reference was changed.
