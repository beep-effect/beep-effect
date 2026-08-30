# Pack schemastore — round 1 fixer report

- `round`: 1
- `fixer`: jsdoc-annotation-specialist
- `slice`: `scratchpad/schemastore/`
- `status`: mechanical JSDoc/schema-identity work applied; R1-036 left unedited

## Changed files

- `scratchpad/schemastore/index.ts`
- `scratchpad/schemastore/internal/limits.ts`
- `scratchpad/schemastore/KeywordFamilies.ts`
- `scratchpad/schemastore/AnnotationCarriers.ts`
- `scratchpad/schemastore/CanonicalJson.ts`
- `scratchpad/schemastore/CatalogEntry.ts`
- `scratchpad/schemastore/DocumentDiff.ts`
- `scratchpad/schemastore/DocumentLint.ts`
- `scratchpad/schemastore/SchemaTarget.ts`
- `scratchpad/schemastore/SchemaVersioning.ts`
- `scratchpad/schemastore/StoreDocument.ts`
- `scratchpad/schemastore/SchemaFile.ts`
- `scratchpad/schemastore/SchemaPipeline.ts`
- `scratchpad/schemastore/SchemaValidator.ts`

Runtime behavior was not changed. Allowed edits only: module/value/type JSDoc, `$I.annote` / `$I.annoteSchema` / `$I\`Name\`` identifiers on class and tagged-error schemas, and the existing `SchemaVersion` same-name type alias tags.

## Items closed

| Id | Status | Notes |
| --- | --- | --- |
| schemastore-R1-001 | closed | Module header; `CarrierDepthExceededError` / `AnnotationCarriers` tags + titled Examples |
| schemastore-R1-002 | closed | `$I = $ScratchpadId.create("schemastore/AnnotationCarriers")`; TaggedError `$I.annote` |
| schemastore-R1-003 | closed | Gotchas + described `@see` on `AnnotationCarriers`; `carryResult` called out in Details |
| schemastore-R1-004 | closed | Module header; error/type/class tags; serialize + error Examples |
| schemastore-R1-005 | closed | `$I` + `$I.annote` on `NonJsonValueError` / `JsonDepthExceededError` |
| schemastore-R1-006 | closed | CanonicalJson Gotchas, `@throws` for indent wiring, described `@see` |
| schemastore-R1-007 | closed | Module header; `CatalogLintFinding` / `CatalogEntry` Examples |
| schemastore-R1-008 | closed | `$I` + `$I.annote` on both class schemas |
| schemastore-R1-009 | closed | CatalogEntry Gotchas + described `@see` |
| schemastore-R1-010 | closed | Module header; converted `@example` → titled Example; `SchemaChange` type tags |
| schemastore-R1-011 | closed | Import `@beep/scratchpad/schemastore`; Gotchas; described `@see` |
| schemastore-R1-012 | closed | Module header; finding + lint Examples |
| schemastore-R1-013 | closed | `$I` + `$I.annote` on `DocumentLintFinding` |
| schemastore-R1-014 | closed | DocumentLint Gotchas + described `@see` |
| schemastore-R1-015 | closed | Module `@packageDocumentation` `@since`; class Example |
| schemastore-R1-016 | closed | KeywordFamilies Gotchas (taplo prefix asymmetry) + described `@see` |
| schemastore-R1-017 | closed | Module header; three error Examples; type-level tags; class Example |
| schemastore-R1-018 | closed | `$I` + `$I.annote` on three TaggedErrors; `Defect()` encoding left as-is |
| schemastore-R1-019 | closed | Converted vacuous `@example`; in-memory `MemoryFileSystem` + `Path.layer`; Gotchas |
| schemastore-R1-020 | closed | Module header; finding/error Examples; type-level tags |
| schemastore-R1-021 | closed | `$I` + `$I.annote` on `PipelineFinding` / `SchemaGateError` |
| schemastore-R1-022 | closed | Converted `@example` to `checkOne`; Gotchas for run vs check |
| schemastore-R1-023 | closed | Module header; interface type-level tags; class Example |
| schemastore-R1-024 | closed | Rewrote class lead; Gotchas + `@throws`; described `@see` |
| schemastore-R1-025 | closed | Module header; error/finding Examples; converted class Example |
| schemastore-R1-026 | closed | `$I` + `$I.annote` on `SchemaValidatorError` / `ValidationFinding` |
| schemastore-R1-027 | closed | Import rewrite; Gotchas (findings vs error, `makeTest` die, keyword register) |
| schemastore-R1-028 | closed | Module header; version parse + catalogUrls Examples; type alias tags |
| schemastore-R1-029 | closed | `$I.annote` on TaggedError; `$I.annoteSchema` on branded `SchemaVersion` |
| schemastore-R1-030 | closed | Gotchas + `@throws` on `fileName` / `catalogUrls` |
| schemastore-R1-031 | closed | Module header; moved `draft07` `@example` onto the class; constant + error Examples |
| schemastore-R1-032 | closed | `$I` + `$I.annote` on `SchemaConversionError` / `StoreDocument` |
| schemastore-R1-033 | closed | Observable class Example (`$schema` + omitted `$defs`); lowering Gotchas |
| schemastore-R1-034 | closed | Barrel `@since`; converted `@example`; purpose-phrase `@see`; no re-export docs |
| schemastore-R1-035 | closed | `internal/limits.ts` module tags; `MAX_NESTING_DEPTH` Example + described `@see` |
| schemastore-R1-036 | **not edited** | Cause-carrying `Schema.Defect()` without `includeStack: true` — runtime encoding change; escalate to schema-first-development |

## Residual risk

- **R1-036** remains open by design. Four cause fields still use `Schema.Defect()` (`SchemaFileReadError`, `SchemaFileWriteError`, `SchemaValidatorError`, `SchemaConversionError`). Adding `includeStack: true` would change encoded payloads.
- `MAX_NESTING_DEPTH` is still not re-exported from `index.ts`. Its Example demonstrates the cap via public `CarrierDepthExceededError` / `JsonDepthExceededError` constructors (`maxDepth: 256`) rather than importing the internal const.
- `SchemaFile` / `SchemaPipeline` Examples provide `MemoryFileSystem.layer` + `Path.layer` so they typecheck without host FS. They log `Effect.runPromise(...)` (a Promise) rather than asserting a live `WriteResult`; that is observable enough for the TypeScript gate, not a doctest.
- Same-name type alias was already present for `SchemaVersion` (the only non-class exported schema). No additional aliases were required.

## Mechanical check (pre-census)

Owning exports in the slice: 47 (29 value, 18 type). After the pass:

- 14 exporting modules carry a fileoverview lead, `@packageDocumentation`, and `@since 0.0.0` (including the barrel).
- 47 owning exports carry `@category` and `@since 0.0.0`.
- 29 value-level exports carry a titled `**Example** (Title)` with a single `ts` fence.
- Zero `@example` / `@remarks` / `@module` / `@template` remain under `scratchpad/schemastore/`.
- File-local `$I = $ScratchpadId.create("schemastore/<File>")` is on every module that owns a `Schema.Class`, `Schema.TaggedError`, or branded schema.

## Commands run

Census and bounded docgen were the acceptance commands. Re-run after this pass:

```bash
/home/elpresidank/.local/share/mise/installs/bun/latest/bin/bun scratchpad/.jsdoc-loop/census.ts
# expect packs.schemastore.openModuleCount === 0 && openOwningExportCount === 0
# (index.ts module findings stay skipped: owningExportCount === 0)

/home/elpresidank/.local/share/mise/installs/bun/latest/bin/bun run docgen:local -- --package @beep/scratchpad
```

This fixer process did not have a shell tool, so those two commands still need to be executed in the parent loop to prove mechanical opens are 0 and that extracted Examples typecheck.
