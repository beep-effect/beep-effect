## Instance

- id: `create-package-template-type-flags`
- file:line: `packages/tooling/tool/cli/src/commands/CreatePackage/CreatePackage.command.ts:741`
- symbol: `TemplateContext`
- members: `isTool`, `isApp`, `isLibrary`
- evidence classes:
  - E1 — `packages/tooling/tool/cli/src/commands/CreatePackage/CreatePackage.command.ts:1483`: One write projects the exclusive PackageType literal into three one-hot booleans: isTool/isApp/isLibrary via packageTypeEquivalence.

## Current shape

Live affected portion of `TemplateContext` at `packages/tooling/tool/cli/src/commands/CreatePackage/CreatePackage.command.ts:728`:

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
    appKind: S.optionalKey(AppKind),
    isTool: S.Boolean,
    isApp: S.Boolean,
    isLibrary: S.Boolean,
    isNextjsApp: S.Boolean,
    isTauriApp: S.Boolean,
    isViteApp: S.Boolean,
    isServiceApp: S.Boolean,
    isRuntimeProofApp: S.Boolean,
    isRealApp: S.Boolean,
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

## Cardinality gap

The three type flags represent eight combinations, but exactly three are legal: `tool`, `app`, and `library`. Those states already have names in the existing `PackageType = LiteralKit(VALID_TYPES)` at `CreatePackage.command.ts:213`, and `TemplateContext.type` already carries that upstream literal.

## Target schema

Do not mint a duplicate kit. Reuse the existing annotated `PackageType` and delete only the one-hot projections. The coordinated app-kind design changes `appKind` to an `Option`; it is included here so either apply agent sees the complete shared target.

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

The replacement for this instance is the already-present `type: PackageType`; no second type-status field is introduced.

## Migration inventory

This inventory is intentionally shared with `create-package-template-app-kind-flags.md`, because both records edit one `TemplateContext` constructor and one render handoff.

- `packages/tooling/tool/cli/src/commands/CreatePackage/CreatePackage.command.ts:213` — retain and reuse the existing `PackageType` kit; do not create another literal domain.
- `packages/tooling/tool/cli/src/commands/CreatePackage/CreatePackage.command.ts:728` — remove all three type flags and all six app-kind flags from `TemplateContext`; change `appKind` to the decoded `Option<AppKind>` described in the paired design.
- `packages/tooling/tool/cli/src/commands/CreatePackage/CreatePackage.command.ts:1473` — pass `appKind` directly to `TemplateContext.make`; `type: packageType` remains the sole type write.
- `packages/tooling/tool/cli/src/commands/CreatePackage/CreatePackage.command.ts:1483` — delete the `isTool` projection.
- `packages/tooling/tool/cli/src/commands/CreatePackage/CreatePackage.command.ts:1484` — delete the `isApp` projection.
- `packages/tooling/tool/cli/src/commands/CreatePackage/CreatePackage.command.ts:1485` — delete the `isLibrary` projection.
- `packages/tooling/tool/cli/src/commands/CreatePackage/CreatePackage.command.ts:1486` — delete the five app-kind projections through line 1490.
- `packages/tooling/tool/cli/src/commands/CreatePackage/CreatePackage.command.ts:1491` — delete the `isRealApp` projection.
- `packages/tooling/tool/cli/src/commands/CreatePackage/CreatePackage.command.ts:1506` — keep the render boundary plain by passing `{ ...ctx, appKind: O.getOrUndefined(ctx.appKind) }`; `type` passes through as its literal string.
- `packages/tooling/tool/cli/src/commands/CreatePackage/TemplateService.ts:191` — the paired design registers a literal-equality Handlebars helper beside the existing isolated-environment helper registrations; no template consumes the type flags.
- `packages/tooling/tool/cli/src/commands/CreatePackage/templates/app-real-AGENTS.md.hbs:7` — paired app-kind migration replaces `isNextjsApp` with a comparison against `appKind`.
- `packages/tooling/tool/cli/src/commands/CreatePackage/templates/app-real-AGENTS.md.hbs:10` — paired app-kind migration replaces `isTauriApp` with a comparison against `appKind`.

The exact whole-repo search found no read of `isTool`, `isApp`, or `isLibrary` outside their declaration and write. The unrelated local `isApp` in `commands/Qa/Qa.session.ts:200` is a directory probe and is not part of this instance.

## Guard-deletion accounting

- `packages/tooling/tool/cli/src/commands/CreatePackage/CreatePackage.command.ts:1483` — delete the three runtime equivalence checks through line 1485 that manufacture and must keep a one-hot projection coherent with `type`.
- `packages/tooling/tool/cli/src/commands/CreatePackage/CreatePackage.command.ts:741` — delete the comment-only invariant encoded only by adjacency/order of the three boolean fields; `PackageType` now states the invariant directly.

## Encoded-side impact

none (internal). `TemplateContext` is an in-process render context. The `TemplateRenderRequest.context` handoff remains a plain Handlebars record, now carrying the existing `type` literal rather than redundant booleans.

## Test impact

- No test directly references `isTool`, `isApp`, or `isLibrary` (whole-repo test search: zero hits).
- `packages/tooling/tool/cli/test/create-package.test.ts:694` and `packages/tooling/tool/cli/test/create-package.test.ts:754` exercise the shared render context for Next.js and Tauri apps and must stay green after the coordinated edit.
- Add a focused `TemplateContext` schema assertion in `packages/tooling/tool/cli/test/create-package.test.ts` proving `type` accepts exactly `PackageType.Options` and that the three removed keys are not required or emitted by construction.

## Risk & sequencing

Apply this design and `create-package-template-app-kind-flags.md` in one change: they share `TemplateContext` (`CreatePackage.command.ts:728`), its only writer (`:1473`), and the Handlebars handoff (`:1503-1507`). Apply the app-kind render-helper/template changes before deleting the flags, then remove both flag families together. No template currently reads the type flags, so the type half has no template-content risk.
