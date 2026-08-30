# Packs jsonc / toml — round 2 fixer report

- `fixer`: jsdoc-annotation-specialist
- `round`: 2
- `scope`: `scratchpad/jsonc/**`, `scratchpad/toml/**` (jsonl not edited)
- `census target`: jsonc and toml packs remain `openModuleCount = 0` / `openOwningExportCount = 0`

Runtime behavior was not changed. Allowed identity edits: `$ScratchpadId.create("jsonc/<File>")` plus `$I.annote` / `$I.annoteSchema` on exported Class, TaggedError, and Literals. `_tag` strings and same-name type aliases were left alone.

## Changed files

jsonc:

- `scratchpad/jsonc/Jsonc.ts`
- `scratchpad/jsonc/JsoncEdit.ts`
- `scratchpad/jsonc/JsoncFingerprint.ts`
- `scratchpad/jsonc/JsoncFormatter.ts`
- `scratchpad/jsonc/JsoncModifier.ts`
- `scratchpad/jsonc/JsoncNode.ts`

toml:

- `scratchpad/toml/Toml.ts`
- `scratchpad/toml/TomlFormat.ts`
- `scratchpad/toml/internal/stringifyValue.ts`

jsonl: not touched.

## Items closed

### jsonc-R2-001 — `$I.annote` / `$I.annoteSchema`

Each schema file now does `import { $ScratchpadId } from "@beep/identity"` and `const $I = $ScratchpadId.create("jsonc/<File>")`, matching jsonl/toml.

| File | Composer | Symbols |
| --- | --- | --- |
| `Jsonc.ts` | `jsonc/Jsonc` | `JsoncParseErrorCode`, `JsoncParseErrorDetail`, `JsoncParseError`, `JsoncParseOptions`, `JsoncStringifyErrorCode`, `JsoncStringifyOptions`, `JsoncStringifyError` |
| `JsoncEdit.ts` | `jsonc/JsoncEdit` | `JsoncRange`, `JsoncFormattingOptions`, `JsoncEdit` |
| `JsoncFingerprint.ts` | `jsonc/JsoncFingerprint` | `JsoncCanonicalizeErrorCode`, `JsoncCanonicalizeError`, `JsoncTextHashOptions` |
| `JsoncModifier.ts` | `jsonc/JsoncModifier` | `JsoncModificationError` |
| `JsoncNode.ts` | `jsonc/JsoncNode` | `JsoncNodeType`, `JsoncNode` |

Class / TaggedError take `$I\`Name\`` plus `$I.annote`. Literals use `$I.annoteSchema` via `.pipe(...)`. Nested non-exported `Schema.Literals(["object", "array"])` on `JsoncModificationError.expected` is not an owning schema.

### jsonc-R2-002 — `JsoncFormatter` Example

One titled Example **(Pretty-print compact JSONC)** remains. It applies `format` via `JsoncEdit.applyAll` and observes the pretty-printed document (`'{\n  "a": 1,\n  "b": 2\n}'`). The tautological `format === formatToString` identity is gone.

### jsonc-R2-003 — `JsoncNode` depth-cap Gotcha

`JsoncNode` now has **Gotchas**: parser trees cannot exceed `{@link MAX_NESTING_DEPTH}`; a `JsoncNode.make` tree past the cap yields silent placeholders (`toValue` → `{}` / `[]` / `null`; `findAtOffset` / `pathAt` stop descending). Described `@see {@link MAX_NESTING_DEPTH}`. No second Example.

### jsonc-R2-004 — `__proto__` own-property Gotcha

- `Jsonc` class **Gotchas**: `"__proto__"` from `parse` / `parseResult` is an own data property (`Object.defineProperty`), matching `JSON.parse`.
- `JsoncNode.toValue` **Gotchas**: the same own-property contract.

No new Examples.

### toml-R2-001 — `TomlFormat` lead

Lead rewritten around conservative, span-preserving format/modify (malformed `format` yields no edits; `modify` fails typed and never auto-creates). **Gotchas** and the two titled Examples are unchanged in count.

### toml-R2-002 — stringify/format expected comments

Expected comments now match `stringifyValue` (`// 'name = "Alice"\n'`):

- `Toml.stringifyResult`
- `Toml.bind`
- `TomlFormat` class Example
- `TomlFormat.formatToString` member Example (same residue in the touched file)
- `renderKey("has space")` → `// '"has space"'`

`TomlFormattingOptions` / `TomlStringifyOptions` already used the correct JS-literal form and were left alone.

## Residual risk

- This subagent has no shell tool, so live `bun scratchpad/.jsdoc-loop/census.ts` and `bun run docgen:local` were not executed here. Mechanical gates were applied from `census.ts` rules and sibling-kit `$I` patterns. Re-run those two commands on the host.
- `{@link MAX_NESTING_DEPTH}` on `JsoncNode` points at the `@internal` export in `jsonc/internal/limits.ts` (already imported by `JsoncNode.ts`). Same internal-link posture as the existing `JsoncParseError` `{@link parseValue}`.
- Nested non-exported Literals (`JsoncModificationError.expected`) remain unannotated; annotation-patterns cover exported schemas.
- jsonl was in the review pack but had zero accepted findings and was not edited.

## Commands run

- In-session: file reads, greps for `$I` / `Schema.Class` / `Schema.TaggedError` / `Schema.Literals` / `@example` / `@remarks` / over-escaped expected comments; census-rule cross-check; formatter-edit walk of `'{"a":1,"b":2}'`.
- Required on the host (not executed in this tool surface):

```bash
/home/elpresidank/.local/share/mise/installs/bun/latest/bin/bun scratchpad/.jsdoc-loop/census.ts
bun run docgen:local -- --package @beep/scratchpad
```

Expect jsonc and toml pack `openModuleCount: 0` and `openOwningExportCount: 0`.
