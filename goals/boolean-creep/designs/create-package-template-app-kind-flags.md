## Instance

- id: `create-package-template-app-kind-flags`
- file:line: `packages/tooling/tool/cli/src/commands/CreatePackage/CreatePackage.command.ts:713`
- symbol: `TemplateContext`
- members: `isNextjsApp`, `isTauriApp`, `isViteApp`, `isServiceApp`, `isRuntimeProofApp`, `isRealApp`
- evidence classes:
  - E1 — `packages/tooling/tool/cli/src/commands/CreatePackage/CreatePackage.command.ts:1421`: One write projects optional AppKind into exclusive isNextjs/isTauri/isVite/isService/isRuntimeProof flags plus isRealApp.
  - E4 — `packages/tooling/tool/cli/src/commands/CreatePackage/CreatePackage.command.ts:1426`: isRealApp is implied by the specific app-kind flags (isRealAppKind); a flattened implication on the same AppKind source.

## Current shape

Live affected portion of `TemplateContext` at `packages/tooling/tool/cli/src/commands/CreatePackage/CreatePackage.command.ts:697`:

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

Six booleans represent 64 combinations. Six states are legal: `none`, `nextjs`, `tauri`, `vite`, `service`, and `runtime-proof`; `isRealApp` is false for `none` and `runtime-proof`, and true for the other four. The five present states already exist in `AppKind = LiteralKit(VALID_APP_KINDS)` at `CreatePackage.command.ts:222`; absence is the legal sixth state.

## Target schema

Do not mint a duplicate kit. Reuse `AppKind` and model absence honestly as `O.Option<AppKind>` through the repo's existing default idiom. The coordinated type-flags design deletes its three fields in the same class.

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

At the generic Handlebars boundary, encode only this field back to its plain optional literal and compare it with a helper; do not recreate per-kind flags:

```ts
// TemplateService.ts, using its existing Str import and toHelperValue helper
hbs.registerHelper("literalEquals", (actual: unknown, expected: unknown) =>
  Str.Equivalence(toHelperValue(actual), toHelperValue(expected))
)

TemplateRenderRequest.make({
  templateDir,
  templates: templateSpecsFor(scaffoldShape),
  context: { ...ctx, appKind: O.getOrUndefined(ctx.appKind) },
})
```

Template use becomes `{{#if (literalEquals appKind "nextjs")}}` or `"tauri"`. `isRealApp` has no consumer and is deleted outright; app-template selection already embodies whether a real-app template is rendered.

## Migration inventory

This inventory is intentionally shared with `create-package-template-type-flags.md`, because both records edit one `TemplateContext` constructor and render handoff.

- `packages/tooling/tool/cli/src/commands/CreatePackage/CreatePackage.command.ts:222` — retain and reuse the existing `AppKind` kit and its `AppKind` type.
- `packages/tooling/tool/cli/src/commands/CreatePackage/CreatePackage.command.ts:671` — retain `appKindIs`; it has legitimate non-template reads at lines 949, 953, and 1405.
- `packages/tooling/tool/cli/src/commands/CreatePackage/CreatePackage.command.ts:674` — delete `isRealAppKind`; its only read is the redundant projection at line 1426.
- `packages/tooling/tool/cli/src/commands/CreatePackage/CreatePackage.command.ts:697` — remove all six app-kind flags and the paired three type flags; change `appKind` to `AppKind.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault)`.
- `packages/tooling/tool/cli/src/commands/CreatePackage/CreatePackage.command.ts:1408` — pass `appKind` directly into `TemplateContext.make` instead of spreading its encoded presence.
- `packages/tooling/tool/cli/src/commands/CreatePackage/CreatePackage.command.ts:1418` — delete the three paired type projections.
- `packages/tooling/tool/cli/src/commands/CreatePackage/CreatePackage.command.ts:1421` — delete the `nextjs`, `tauri`, `vite`, `service`, and `runtime-proof` one-hot writes through line 1425.
- `packages/tooling/tool/cli/src/commands/CreatePackage/CreatePackage.command.ts:1426` — delete the implied `isRealApp` write.
- `packages/tooling/tool/cli/src/commands/CreatePackage/CreatePackage.command.ts:1441` — flatten only `ctx.appKind` to `string | undefined` in `TemplateRenderRequest.context`; all other context values remain unchanged.
- `packages/tooling/tool/cli/src/commands/CreatePackage/TemplateService.ts:154` — register `literalEquals` on the isolated Handlebars environment using `Str.Equivalence` and the existing safe unknown-to-string normalization.
- `packages/tooling/tool/cli/src/commands/CreatePackage/templates/app-real-AGENTS.md.hbs:7` — replace `{{#if isNextjsApp}}` with `{{#if (literalEquals appKind "nextjs")}}`.
- `packages/tooling/tool/cli/src/commands/CreatePackage/templates/app-real-AGENTS.md.hbs:10` — replace `{{#if isTauriApp}}` with `{{#if (literalEquals appKind "tauri")}}`.

The exact whole-repo search found no reads of `isViteApp`, `isServiceApp`, `isRuntimeProofApp`, or `isRealApp`, and no reads of `isNextjsApp`/`isTauriApp` beyond those two templates.

## Guard-deletion accounting

- `packages/tooling/tool/cli/src/commands/CreatePackage/CreatePackage.command.ts:1421` — delete five runtime `appKindIs` coherence checks that manufacture the one-hot flags.
- `packages/tooling/tool/cli/src/commands/CreatePackage/CreatePackage.command.ts:674` — delete the `isRealAppKind` implication helper.
- `packages/tooling/tool/cli/src/commands/CreatePackage/CreatePackage.command.ts:1426` — delete the derived `isRealApp` write that duplicates the optional literal's meaning.
- `packages/tooling/tool/cli/src/commands/CreatePackage/templates/app-real-AGENTS.md.hbs:7` and `:10` — delete the comment-only/template-only assumption that six booleans are mutually coherent; each condition now asks the single `appKind` value.

## Encoded-side impact

none (internal). `TemplateContext` is in-process. Its decoded side becomes `O.Option<AppKind>`; the generic render handoff explicitly emits the same plain optional string shape Handlebars already understands.

## Test impact

- `packages/tooling/tool/cli/test/create-package.test.ts:627` — the Next.js scaffold exercises the `appKind === "nextjs"` template branch; add an assertion that generated `AGENTS.md` contains the Next.js surface line and not the Tauri line.
- `packages/tooling/tool/cli/test/create-package.test.ts:687` — the Tauri scaffold exercises the `appKind === "tauri"` branch; add the inverse `AGENTS.md` assertions.
- `packages/tooling/tool/cli/test/create-package-lab.test.ts:367` — the Next.js lab exercises the same optional-literal render handoff.
- `packages/tooling/tool/cli/test/create-package-lab.test.ts:445`, `:495`, and `:560` — Vite, service, and runtime-proof paths prove other `AppKind` literals do not accidentally select the Next.js/Tauri prose.
- Add a focused TemplateService helper test covering equal, unequal, and absent `appKind`; no existing test names the removed booleans directly.

## Risk & sequencing

Land this with `create-package-template-type-flags.md`. Register and test `literalEquals`, migrate the two templates, change `TemplateContext.appKind` to `Option`, adapt the render handoff, then delete both flag families and `isRealAppKind`. The shared files are `CreatePackage.command.ts`; the app-kind half additionally touches `TemplateService.ts` and `app-real-AGENTS.md.hbs`. Template output is the principal regression risk.
