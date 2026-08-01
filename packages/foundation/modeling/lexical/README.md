# @beep/lexical-schema

Schema-first models of Lexical's serialized editor state with Md ↔ Lexical
codecs over the canonical `@beep/md` AST.

- **Zero runtime `lexical` imports.** The schemas import only `effect` (plus
  beep foundation packages); `lexical` and `@lexical/*` are devDependencies
  used type-only by the dtslint conformance tests (`dtslint/Lexical.tst.ts`).
- **The schema owns the persisted contract.** Lexical ships minor-breaking
  releases monthly; persisted state must decode through this package, never
  couple to a raw Lexical release's serialization.
- **Nullish wire values decode to `O.Option` at the schema boundary** —
  downstream logic matches Options instead of null-checking. The encoded side
  keeps the exact Lexical wire shape (round-trip fidelity is non-negotiable;
  see `test/Lexical.model.test.ts`).
- **Strict and lossless boundaries are separate.** `LexicalNode`,
  `SerializedEditorState`, `EditorStateFromJson`, and
  `decodeEditorStateStrict` reject excess fields, empty roots that Lexical
  cannot apply, and invalid child topology before editor/runtime use. The
  lossless wire schemas and decoders retain those JSON wires plus future nodes
  and extension fields for persistence and migration. `documentToEditorState`
  migration-safely canonicalizes an empty Md document to one blank paragraph.
- **The lossless wire schemas intentionally use `StructWithRest`.** Effect
  schema classes accept closed `Struct` fields, so a class migration would
  discard arbitrary envelope, root, node, version, and `"$"` NodeState data.
  Exact unknown-field identity takes precedence over class-shaped semantics at
  this persistence boundary.
- **Serialized NodeState is JSON-valued on both surfaces.** Strict runtime
  admission rejects functions, symbols, bigints, and other values that JSON
  persistence would silently discard, while nested JSON NodeState remains
  lossless.
- **URLs and inline styles are safe fixed points.** Decode normalizes untrusted
  input through the canonical `@beep/md` browser URL policy and the package CSS
  allowlist; semantic node constructors reject values that bypass normalization.

## v1 node scope

md-core: `paragraph`, `heading`, `code`, `list`/`listitem`, `quote`, `link`,
`text`/`tab`/`linebreak` (+ inline marks via the text format bitmask), plus
`table`/`tablerow`/`tablecell`, `youtube`, and the package-owned `artifact-ref`
block. Mention and slash-command are composer affordances, not persisted
blocks. Attachments and proposal blocks are named follow-ons.

## Lossiness profile (locked)

The codec profile was locked after running the Md ↔ Lexical lossiness check
(`test/Lexical.codec.test.ts`).

### Round-trips losslessly (Md → Lexical → Md is identity)

| Md | Lexical |
| --- | --- |
| `P` | `paragraph` |
| `H1`–`H6` | `heading` (`h1`–`h6`) |
| `Pre` (`value`, `language`) | `code` (text/tab/linebreak lines) |
| `Ul` / `Ol` | `list` (`bullet`/`ul`, `number`/`ol`) |
| `TaskList`/`TaskItem` | `list` (`check`) + `listitem.checked` |
| Nested lists | nested `list` children inside `listitem` |
| `BlockQuote` with a single `P` | `quote` |
| `Table` / `TableRow` / `TableCell` with default alignment; `headerRow` false or a nonempty first row | `table` / `tablerow` / `tablecell` |
| `YouTube` | `youtube` |
| `Strong` / `Em` / `Del` / `Code` (inline) | text format bits 1 / 2 / 4 / 16 |
| `A` | `link` |
| `Br` | `linebreak` |
| `P` wrapping one untitled `A` with an `artifact://<id>` href and one nonempty plain-text label | `artifact-ref` |

### Normalizations (Md → Lexical → Md converges; the second pass is identity)

- Inline mark nesting canonicalizes to `Strong > Em > Del` (outer → inner):
  the bitmask is orderless, so `Em(Strong(x))` round-trips as `Strong(Em(x))`.
- `BlockQuote` with multiple blocks flattens to one linebreak-separated
  paragraph inside the quote.
- Nested links retain the outer link and unwrap inner link wrappers. An image
  inside a link becomes its alt-text run so the strict Lexical tree never
  contains a link beneath another link.
- Markdown table column alignment is dropped because the Lexical v1 table wire
  has no column-alignment field; the structural table then round-trips.
- `headerRow: true` normalizes to `false` when the table has no first-row cell;
  the Lexical v1 wire carries that flag only on first-row cells.
- Artifact links with rich, segmented, empty, or titled labels stay ordinary
  `link` nodes so their complete Markdown label and title remain reversible.

### Dropped on Lexical → Md (no markdown equivalent)

- Element alignment (`format` token), `indent`, `direction`.
- Lexical-only link `rel` and `target` attributes.
- Text format bits without an Md mark: underline (8), subscript (32),
  superscript (64), highlight (128), casing bits.
- Inline styles (`style`, `textStyle`), `textFormat`, `detail`, `mode`,
  NodeState (`$`).

### Degraded on Md → Lexical (documented, deterministic)

- `Document.frontmatter` is outside the editor wire and must be retained by the
  owning persistence adapter when editor content is rebuilt.
- `RawMarkdown` / `RawHtml` → plain text runs.
- `InlineMath` → formula text; `FootnoteReference` → literal `[^identifier]`
  text.
- `Img` → `link` (alt text, destination, and optional title survive).
- `Hr` → a literal `---` paragraph.
- Bare `Li` outside a list → paragraph.
- `MathBlock`, `FootnoteDefinition`, `Admonition`, and `Embed` → plain-text
  paragraphs using their canonical Markdown plain-text projection.

## Modules

- `Lexical.model` — vocabularies, node classes, the `LexicalNode` tagged
  union, strict semantic and lossless wire editor-state schemas, typed decode
  APIs, and JSON codecs.
- `Lexical.behavior` — pure plain-text projections over strict semantic nodes
  and editor states.
- `Lexical.codec` — `documentToEditorState` / `blockToLexical` (Md → Lexical,
  validating `Effect`s) and `editorStateToDocument` / `nodeToBlocks`
  (Lexical → Md, pure).
- `Lexical.normalize` — canonical URL, inline-style, style-value, and legacy
  YouTube-id normalization used by the semantic schemas.

## Usage

```ts
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import { Document, P, Text } from "@beep/md/Md.model";
import {
  SerializedEditorState,
  analyzeEditorStateCompatibility,
  documentToEditorState,
} from "@beep/lexical-schema";

const document = Document.make({ children: [P.make({ children: [Text.make({ value: "Hello" })] })] });
const inspected = documentToEditorState(document).pipe(
  Effect.flatMap(S.encodeEffect(SerializedEditorState)),
  Effect.flatMap(analyzeEditorStateCompatibility),
  Effect.runSync,
);
console.log(inspected.isCompatible); // true
```

Use `decodeEditorStateStrict` before behavior or DOM rendering. Use
`decodeEditorStateLossless` when a persistence or migration boundary must
retain unknown future JSON fields, and `analyzeEditorStateCompatibility` when a
caller needs both the retained wire and an optional strict semantic state.

## Development

```bash
bun run check      # tsgo type check
bun run test       # vitest
bun run dtslint    # tstyche conformance vs lexical types
bun run lint:fix   # biome
```

Unit tests stay outside `test/integration`; tests and dtslint files import
package source through `@beep/lexical-schema` or other `@beep/*` aliases. Use
relative imports only for local helpers, fixtures, and snapshots.

## License

MIT
