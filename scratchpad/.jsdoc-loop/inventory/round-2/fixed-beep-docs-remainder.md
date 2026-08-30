# Round 2 fixed: beep-docs + remainder

Fixer surface: `scratchpad/beep-docs/**`, `scratchpad/metadata/**`,
`scratchpad/ontoskills/**`, `scratchpad/microdata/**`. JSDoc only. No runtime
behavior changes. `ontoskills/registry/Registry.models.ts` was not touched.

## Changed files

| File | What closed |
| --- | --- |
| `scratchpad/beep-docs/api-reference/CodeSnippet.ts` | `CodeSnippetLanguage` Example now `S.is` a member and `"cobol"` |
| `scratchpad/beep-docs/api-reference/ApiReference.ts` | `DeclarationKind` Example now `S.is` a member and `"method"` |
| `scratchpad/beep-docs/domain/SearchMetadata.ts` | `SearchContentSource` Example now `S.is` a member and `"forum"` |
| `scratchpad/metadata/services/officeparser/OfficeParser.models.ts` | Nested `console.log(literal)` placeholders deleted; parent Examples construct realistic objects; `OfficeParserAST` builds a document fragment |

Example import specifiers in the four touched files now resolve from
`scratchpad/.jsdoc-loop/generated-docs/examples/`
(`../../../beep-docs/...`, `../../../metadata/services/officeparser/...`),
matching the CodeSnippet pack rewrite. Runtime `./` imports are unchanged.

## Items closed

| ID | Symbol | Status |
| --- | --- | --- |
| beep-docs-R2-001 | `CodeSnippetLanguage` | closed — `S.is(...)(Enum.typescript) // true` and `S.is(...)("cobol") // false`; title kept **Example** (Guard a language name) |
| beep-docs-R2-001 | `DeclarationKind` | closed — `S.is(...)(Enum.function) // true` and `S.is(...)("method") // false`; retitled **Example** (Guard a kind name) |
| beep-docs-R2-001 | `SearchContentSource` | closed — `S.is(...)(Enum.documentation) // true` and `S.is(...)("forum") // false`; retitled **Example** (Guard a content source) |
| remainder-R2-001 | `TextFormatting` | closed — nested primitive fences deleted; parent **Example** (Format a heading run) constructs `{ bold: true, size: "12pt", font: "Arial" }` |
| remainder-R2-001 | `ListMetadata` | closed — nested fences deleted; parent constructs an ordered nested item |
| remainder-R2-001 | `CellMetadata` | closed — nested fences deleted; parent constructs a merged header cell |
| remainder-R2-001 | `TableMetadata` | closed — nested fence deleted; parent centers a table with an anchor |
| remainder-R2-001 | `ChartMetadata` | closed — nested fence deleted; parent points at `chart1.xml` |
| remainder-R2-001 | `ImageMetadata` | closed — nested fences deleted; parent describes a centered logo |
| remainder-R2-001 | `PageMetadata` | closed — nested fence deleted; parent tags page 1 |
| remainder-R2-001 | `TextMetadata` | closed — nested fence deleted; parent links a text run |
| remainder-R2-001 | `NoteMetadata` | closed — nested fence deleted; parent identifies a footnote |
| remainder-R2-001 | `BaseContentNode` | closed — nested `text` / `children` / `formatting` / `rawContent` / `htmlAttributes` fences deleted; two existing parent Examples kept (imports added) |
| remainder-R2-001 | `OfficeAttachment` | closed — nested `type` / `mimeType` / `data` / `name` / `extension` / `ocrText` / `altText` / `chartData` fences deleted; existing parent Example kept (import added) |
| remainder-R2-001 | `OfficeParserAST` | closed — vacuous `type`/`to` destination logs deleted; parent **Example** (Inspect a parsed document tree) constructs a `docx` fragment with heading + paragraph and observes `ast.type` / `ast.content[0]?.text` |
| remainder-R2-001 | `SlideMetadata` | closed while touching the file — leftover `noteId` placeholder deleted; parent locates a slide note |

Untouched on purpose (inventory rejected / explicit leave-standing):

- Nested `styleMap`, `metadataOverrides`, `embeddingFunction`,
  `sentenceBoundaryRegex`, `abbreviations` Examples
- Barrel header on `beep-docs/api-reference/index.ts`
- Example on `CodeSnippetLanguageFromExtension` declare-namespace
- `ontoskills/**` and `scratchpad/microdata/**`

No When-to-use sections were added. No `@example` / `@remarks` / `@module` /
`@template` carriers. The only `@example` token remaining under beep-docs is
TypeDoc tag matching inside `codeExamples`.

## Residual risk

- **No shell in this subagent.** `bun scratchpad/.jsdoc-loop/census.ts`,
  `bun run docgen:local`, and package typecheck were not executed here.
  Orchestrator should run the commands below.
- **Census namespace FP (expected).** `CodeSnippetLanguageFromExtension`
  declare-namespace may still score `kind: value`, `missing=@example`. Do not
  add an Example.
- **`@beep/scratchpad` has no `check` script.** Typecheck is
  `tsgo -p scratchpad/tsconfig.json --noEmit`.
- **`docgen:local` from repo root** plans `src/` / `docs/` package inputs and
  may noop on `scratchpad/**`. Bound the proof with scratchpad `--include`.
- Concurrent type-companion copy on `CodeSnippetLanguageFromExtension` (lead /
  `@see` / `@category type-level`) was already in the file; left standing.

## Commands run

- Rubric + inventory + sibling LiteralKit (`TypeKind`, `FileCategory`) and
  OfficeParser placeholder census via ripgrep
- Grep for leftover `T["k"] = literal` / `console.log(bold)` placeholders
  (none remain except the five leave-standing nested fences)
- Grep for `@example` / `@remarks` / `@module` / `@template` in touched files

## Commands still required (orchestrator)

```bash
zsh -ic 'bun scratchpad/.jsdoc-loop/census.ts'
# accepted-finding opens for beep-docs + remainder must be 0;
# CodeSnippetLanguageFromExtension namespace @example FP may remain

zsh -ic 'cd scratchpad && bun run docgen -- --include "beep-docs/api-reference/CodeSnippet.ts,beep-docs/api-reference/ApiReference.ts,beep-docs/domain/SearchMetadata.ts,metadata/services/officeparser/OfficeParser.models.ts"'

zsh -ic 'bun run docgen:local -- --package @beep/scratchpad'
# may still be a no-op for scratchpad paths outside src/; the include run above
# is the bounded Example TypeScript gate
```
