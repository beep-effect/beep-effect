# Instance

- id: `create-package-template-app-kind-flags`
- exact source SHA: `3330f9881a50c96d3f2ec0fcad76f0f7a09027e4`
- corpus source SHA: `52fcc8d1353db9481ef9edb6cc9619500f95568d`
- file:line: `packages/tooling/tool/cli/src/commands/CreatePackage/CreatePackage.command.ts:732`
- symbol: `TemplateContext`
- members: `isNextjsApp`, `isTauriApp`, `isViteApp`, `isServiceApp`, `isRuntimeProofApp`, `isRealApp`
- evidence classes:
  - E1 — `packages/tooling/tool/cli/src/commands/CreatePackage/CreatePackage.command.ts:1490-1494`: the sole writer projects one optional `AppKind` into five exclusive kind flags.
  - E4 — `packages/tooling/tool/cli/src/commands/CreatePackage/CreatePackage.command.ts:1495`: `isRealApp` is derived from the same value; every present kind except `runtime-proof` implies it.

# Current shape

`TemplateContext` already carries `appKind: S.optionalKey(AppKind)` at line
744, then repeats it as six required booleans at lines 748-753. Its sole
constructor writes the optional literal and all six projections at lines
1477-1502. Only `isNextjsApp` and `isTauriApp` are read, by the two conditional
blocks in `templates/app-real-AGENTS.md.hbs`; the other four projections have
no readers.

The upstream command domain is already `O.Option<AppKind>`. `AppKind` is the
annotated `LiteralKit(VALID_APP_KINDS)` at lines 225-238, with values `nextjs`,
`vite`, `service`, `tauri`, and `runtime-proof`. Absence means a non-app
package. The existing `appKindIs` helper at lines 706-707 also has legitimate
non-template readers at lines 970 and 1474.

# Cardinality gap

Six booleans represent 64 combinations. Six states are legal: absent,
`nextjs`, `vite`, `service`, `tauri`, and `runtime-proof`. `isRealApp` is false
for absence and `runtime-proof`, and true for each of the other four kinds.
The optional `AppKind` already names every legal state without permitting an
incoherent combination.

# Target schema

Reuse the existing `AppKind` LiteralKit. Make absence explicit on the decoded
class while preserving an optional plain literal on the schema's encoded side:

```ts
appKind: AppKind.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault)
```

Pass the existing `O.Option<AppKind>` directly to `TemplateContext.make`.
Before handing the generic record to Handlebars, flatten only this field back
to its existing optional string representation:

```ts
context: { ...ctx, appKind: O.getOrUndefined(ctx.appKind) }
```

Register one equality helper on the isolated Handlebars environment, reusing
the existing unknown-to-template-string normalization:

```ts
hbs.registerHelper("literalEquals", (actual: unknown, expected: unknown) =>
  Str.Equivalence(toHelperValue(actual), toHelperValue(expected))
)
```

The template conditions become
`{{#if (literalEquals appKind "nextjs")}}` and
`{{#if (literalEquals appKind "tauri")}}`. Delete `isRealApp` outright;
template selection already determines whether `app-real-AGENTS.md.hbs` is
rendered, and no code reads that projection.

# Migration inventory

- `packages/tooling/tool/cli/src/commands/CreatePackage/CreatePackage.command.ts:225-239` — retain and reuse the annotated `AppKind` LiteralKit, its decoder, and its equivalence.
- `packages/tooling/tool/cli/src/commands/CreatePackage/CreatePackage.command.ts:710-714` — retain `appKindIs` because the lab refusal at line 970 and language-service selection at line 1474 still use it; delete `isRealAppKind`, whose only reader is the redundant write at line 1495.
- `packages/tooling/tool/cli/src/commands/CreatePackage/CreatePackage.command.ts:716-765` — update the inaccurate titled example to the complete real decoded class shape; change `appKind` to `OptionFromOptionalKey` plus `withNoneDefault`, delete all six app-kind flags, and apply the paired three-type-flag deletion.
- `packages/tooling/tool/cli/src/commands/CreatePackage/CreatePackage.command.ts:1477-1511` — keep `O.getSomesStruct` for `family` and `kind`, pass `appKind` as its own decoded `Option` field, and delete all app-kind and type-flag projections at lines 1487-1495.
- `packages/tooling/tool/cli/src/commands/CreatePackage/CreatePackage.command.ts:1507-1511` — flatten `ctx.appKind` with `O.getOrUndefined` in the generic `TemplateRenderRequest.context`; all other context keys retain their current values.
- `packages/tooling/tool/cli/src/commands/CreatePackage/TemplateService.ts:172-197` — reuse `toHelperValue` and `Str.Equivalence` to register `literalEquals` beside the four existing helpers on the per-service Handlebars environment. Do not export a second app-kind predicate.
- `packages/tooling/tool/cli/src/commands/CreatePackage/templates/app-real-AGENTS.md.hbs:7-12` — replace the Next.js and Tauri flag conditions with equality checks against the single `appKind` literal; retain the emitted prose byte-for-byte.
- `packages/tooling/tool/cli/src/commands/CreatePackage/index.ts:14` — the wildcard facade already exports the touched public classes and service; no barrel or dependency change is required.

The exact search found no other readers of the six flags. The labs share the
same rendering pipeline but do not render `app-real-AGENTS.md.hbs`, because
their template specs use the lab-specific AGENTS template; they remain useful
coverage of the optional-literal handoff but are not direct branch tests.

# Guard-deletion accounting

- Delete the five one-hot `appKindIs` projections at
  `CreatePackage.command.ts:1490-1494`.
- Delete `isRealAppKind` at `CreatePackage.command.ts:709-710` and its derived
  `isRealApp` write at line 1495.
- Delete the six boolean fields at `CreatePackage.command.ts:748-753`.
- Delete the two template assumptions at
  `app-real-AGENTS.md.hbs:7-12` that require coherent parallel flags; each
  branch now compares one literal.
- Retain `appKindIs` only for its two legitimate direct domain decisions. Do
  not recreate per-kind boolean aliases in the command, context, or renderer.

# Encoded-side impact

None outside the internal render handoff. `TemplateContext` is not persisted
or transported. Its decoded `appKind` becomes `O.Option<AppKind>`, while the
schema's encoded field remains the same optional literal and the explicit
Handlebars handoff emits the same `string | undefined` representation. CLI
flag names, accepted values, absence semantics, defaults, template selection,
and all generated prose remain unchanged. The six redundant context keys are
internal implementation details and are removed.

# Test impact

- `packages/tooling/tool/cli/test/create-package.test.ts:700` — after creating a Next.js app, read generated `AGENTS.md`; assert it contains the existing Next.js surface sentence and omits the Tauri sentence.
- `packages/tooling/tool/cli/test/create-package.test.ts:763` — add the inverse assertions for a Tauri app.
- `packages/tooling/tool/cli/test/create-package.test.ts:842` and `:942` — assert Vite and runtime-proof output does not select either conditional sentence. The runtime-proof scaffold uses package-like templates, so also retain its existing file-shape assertions.
- `packages/tooling/tool/cli/test/create-package-lab.test.ts:394`, `:464`, and `:518` — retain Next.js, Vite, and service lab coverage through the shared context constructor; these tests do not directly cover `app-real-AGENTS.md.hbs`.
- Add one focused `createTemplateService` render test in an existing create-package test file using a temporary template with equal, unequal, and absent `appKind` cases. Exercise the helper through the public service rather than exporting the private Handlebars environment.
- Finish with exact searches for all six removed names in source, templates, and tests, then run focused create-package tests and full `@beep/repo-cli` package verification during implementation.

# Risk and sequencing

Land atomically with `create-package-template-type-flags`. First register and
test `literalEquals`, migrate the two template branches, change the decoded
`TemplateContext.appKind`, adapt its sole constructor and render handoff, then
delete both boolean families and `isRealAppKind`. The main regression risk is
generated `AGENTS.md` content. Preserve all raw CLI behavior and every retained
render-context key.
