# Round 27 tooling configuration census adjudication

Source: `8f266b878445ca8a7f751f9248da428a4dde39a1`.
Corpus main: `663904610cce2a38c06b0619a8c414646b69361c`.

The support partition completed all four assigned roots and reported four D
rows. The policy partition completed both assigned roots and reported two D
rows. All six proposals concern actual configuration carriers; none establishes
a new qualified state migration. Preserve the raw reports and execution receipts.

## Compiler option field coverage

The three support residue rows name the shape, strict exported schema and
ts-node overlay of the same compiler-option field bag in
`packages/tooling/library/repo-utils/src/schemas/TSConfig.ts`:

- `TSConfigCompilerOptionsShape` at 1205 uses `tsConfigCompilerOptionsFields`.
- `TSConfigCompilerOptions` at 1306 exports the semantic schema at 1277.
- `TSNodeCompilerOptions` at 1286 uses the same fields in a loose JSON object.

The existing representative fourteen-member subset, the earlier sixteen-member
shape residue, and the new fifty-five-member residue together cover all **85**
direct Boolean fields in that bag. A declaration-level extraction checks every
member against its actual `nullableOptionalField(S.Boolean, ...)` expression and
finds no uncovered direct Boolean field. Absence and null support remain as
declared; this census correction does not narrow those domains.

Consolidate the member lists under the existing stable ids
`tsconfig-compiler-options`, `tsconfig-compiler-options-export`, and
`ts-node-compiler-options`, retaining D2. Each owner gets the complete
85-member list in declaration order. Archive and withdraw the superseded
`r25-tooling-library-policy-test-tsconfig-compiler-options-residue` subset;
the three new raw residue ids need no separate canonical rows.

The D2 ground is the explicit SchemaStore/TypeScript configuration mirror
(`TSConfig.ts:1-6,1306-1309`), not an assertion that every tuple is freely
accepted. The strict schema applies three cross-field checks at 1211-1275;
the unrefined shape and loose ts-node overlay have different decoding roles.
Preserve those roles and existing external compiler semantics.

## Next experimental option coverage

`ExperimentalConfig` is the named schema at
`packages/tooling/policy-pack/repo-configs/src/next/models/ExperimentalConfig.schema.ts:228`.
The file imports the corresponding Next config type at line 16. Combine the
two existing twelve-member subsets and the new seventy-four-member residue
under the stable `tooling-rest-experimental-config` id, retaining D2.
The resulting **98** members cover all direct Boolean fields plus the reported
Boolean-capable aliases and literal fields. Preserve actual alternatives:
`PrefetchInlining` at 114, `BooleanOrStrict` at 22 and
`BrowserDebugInfoInTerminal` at 207 are unions, while
`fallbackNodePolyfills` and `allowDevelopmentBuild` are optional fixed literals.

Archive and withdraw the superseded
`r25-tooling-library-policy-test-experimental-config-residue` row. Do not add
another residue row for the same external option bag, claim every Next option
combination valid, or replace the external configuration with a local phase.

## New census rows

- Admit `canonical-docgen-examples-compiler-options` as D1. The named class in
  `packages/tooling/library/repo-utils/src/schemas/DocgenConfig.ts:131-168`
  pins all eighteen recorded Boolean members to `S.Literal(true)` or
  `S.Literal(false)`. The managed constructor at 468 and encoder at 416 retain
  this fixed profile. Its Boolean projection has one representable and one
  legal tuple, so there is no cardinality gap to refactor.
- Admit `r27-tooling-policy-docs-eslint-file-overview-package-documentation`
  as D2 with `kind: object-literal`, anchored at
  `packages/tooling/policy-pack/repo-configs/src/eslint/DocsESLintConfig.ts:245`.
  The actual `packageDocumentation` option object contains `initialCommentsOnly`
  and `mustExist` at 245-246 under the imported eslint-plugin-jsdoc rule at
  240-250. The enclosing `DocsESLintConfig` is a real exported Linter config
  array at 65. The plugin option mirror supplies the D2 ground; the single
  all-true configuration does not prove every external combination legal.

The configuration census corrections preserve every qualified id, design and
status. No source, tests, dependency or lockfile changes are proposed. Parent
integration preserves prior rows and validates the resulting inventory.
