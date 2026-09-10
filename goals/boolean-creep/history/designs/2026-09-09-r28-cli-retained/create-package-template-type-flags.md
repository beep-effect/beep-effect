# Instance

- id: `create-package-template-type-flags`
- exact source SHA: `3330f9881a50c96d3f2ec0fcad76f0f7a09027e4`
- corpus source SHA: `52fcc8d1353db9481ef9edb6cc9619500f95568d`
- file:line: `packages/tooling/tool/cli/src/commands/CreatePackage/CreatePackage.command.ts:732`
- symbol: `TemplateContext`
- members: `isTool`, `isApp`, `isLibrary`
- evidence: E1 at `packages/tooling/tool/cli/src/commands/CreatePackage/CreatePackage.command.ts:1487-1489` — the sole writer projects one `PackageType` value into three one-hot booleans.

# Current shape

`TemplateContext` is an exported schema class used only as the in-process data
passed to package templates. It already owns the single authoritative
`type: PackageType` field at line 736, but lines 745-747 repeat that value as
three required booleans. Its only constructor at lines 1477-1502 writes all
three projections. No source template, test, or other repository consumer
reads any of them.

`PackageType` is already the annotated `LiteralKit(VALID_TYPES)` at lines
216-223. Its three values are `tool`, `app`, and `library`; the create-package
CLI decodes into that domain before constructing `TemplateContext`.

# Cardinality gap

Three booleans represent eight combinations while exactly three are legal:
`tool`, `app`, and `library`. The existing `type: PackageType` field represents
those legal states directly and is already the source for every projection.

# Target schema

Reuse `PackageType`; do not create another literal domain or compatibility
fields. Delete `isTool`, `isApp`, and `isLibrary` from `TemplateContext` and
their writes. Keep `type: PackageType` unchanged.

The paired `create-package-template-app-kind-flags` migration changes
`appKind` from a decoded optional property to a decoded `Option` with an
optional encoded key. The complete shared target is:

```ts
export class TemplateContext extends S.Class<TemplateContext>($I`TemplateContext`)(
  {
    name: S.String,
    scopedName: S.String,
    type: PackageType,
    description: S.String,
    year: S.String,
    parentDir: ParentDir,
    packagePath: S.String,
    rootRelative: S.String,
    family: S.optionalKey(PackageFamily),
    kind: S.optionalKey(PackageKind),
    appKind: AppKind.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
    isLab: S.Boolean,
    isEcosystem: S.Boolean,
    portlessLabel: S.String,
    rootDirRelative: S.String,
    identityAccessor: S.String,
    effectLanguageServicePlugins: S.String,
    nextjsLanguageServicePlugins: S.String,
  },
  $I.annote("TemplateContext", {
    description: "Variables passed into every template during package scaffolding.",
  })
) {}
```

# Migration inventory

- `packages/tooling/tool/cli/src/commands/CreatePackage/CreatePackage.command.ts:216-223` — retain the existing annotated `PackageType` LiteralKit, its derived type, guard, and equivalence; no duplicate domain is added.
- `packages/tooling/tool/cli/src/commands/CreatePackage/CreatePackage.command.ts:720-769` — update the inaccurate titled example so it constructs the actual required context shape; retain `type: PackageType`, delete the three type flags at lines 745-747, and apply the paired app-kind field change.
- `packages/tooling/tool/cli/src/commands/CreatePackage/CreatePackage.command.ts:1477-1502` — retain `type: packageType` as the sole type write; delete the three equivalence projections at lines 1487-1489 and apply the paired app-kind writer changes.
- `packages/tooling/tool/cli/src/commands/CreatePackage/CreatePackage.command.ts:1507-1511` — keep `type` as the same plain literal in `TemplateRenderRequest.context`; only the paired decoded `appKind` requires flattening for Handlebars.
- `packages/tooling/tool/cli/src/commands/CreatePackage/TemplateService.ts:188-197` and `packages/tooling/tool/cli/src/commands/CreatePackage/templates/app-real-AGENTS.md.hbs:7-12` — touched only by the paired app-kind migration. No template replacement is needed for `type`, because no template reads the removed type flags.
- `packages/tooling/tool/cli/src/commands/CreatePackage/index.ts:14` — the wildcard facade already exports `TemplateContext`; no barrel change or compatibility alias is needed.

An exact repository search at the stated source SHA found no `isTool`,
`isApp`, or `isLibrary` read outside their declaration and sole writer. The
unrelated `isApp` directory probe in
`packages/tooling/tool/cli/src/commands/Qa/Qa.session.ts:202` is outside this
instance.

# Guard-deletion accounting

- Delete the three one-hot coherence expressions at
  `CreatePackage.command.ts:1487-1489`. They can no longer drift from the
  authoritative `type` field because the projections cease to exist.
- Delete the three required boolean members at
  `CreatePackage.command.ts:745-747`; consumers see only the schema-owned
  literal domain.
- Do not introduce replacement `isTool`, `isApp`, or `isLibrary` predicates.
  Existing legitimate `packageTypeEquivalence` reads elsewhere in the command
  remain because they decide CLI/scaffold behavior directly from the literal.

# Encoded-side impact

None. `TemplateContext` is an internal in-process render context, is not
persisted, and is not a wire schema. `TemplateRenderRequest.context` remains a
plain Handlebars record. Its existing `type` key retains the same spelling and
the same `tool | app | library` values; only three unused redundant keys
disappear. CLI flags, defaults, generated file selection, and rendered bytes
are unchanged for this instance.

# Test impact

- Retain the successful Next.js, Tauri, Vite, and runtime-proof scaffold tests at `packages/tooling/tool/cli/test/create-package.test.ts:700`, `:761`, `:840`, and `:942`; they exercise construction and rendering for the `app` type after the coordinated context edit.
- Retain the existing package/tool and refusal coverage earlier in `create-package.test.ts`; package verification supplies the compile-time proof that the sole constructor matches the new class shape.
- Add a focused `TemplateContext` construction/schema assertion only if it can use the complete real context fixture. It should prove each `PackageType` value is accepted and the removed projections are absent; do not add a weaker duplicate test schema or export `PackageType` solely for testing.
- Finish with an exact source/template/test search proving the removed names have zero remaining occurrences in the CreatePackage surface, then run the focused create-package tests and full `@beep/repo-cli` package verification during implementation.

# Risk and sequencing

Apply atomically with `create-package-template-app-kind-flags`: both designs
edit `TemplateContext`, its only constructor, and its renderer handoff. The
type half has low behavioral risk because no template reads these flags. The
implementation must preserve `PackageType`, all raw CLI behavior, the generic
render-context wire shape for retained keys, and generated output.
