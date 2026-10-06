# P0 inventory — live tagged constructors and their diagnostic paths

Captured 2026-10-05 from the live checkout (`main` at `ea7b0c6251`). Every
row names a tagged constructor as it exists in source today, the PO pattern
it carries after P1, and the cross-model diagnostic path that already covers
it. The PO pattern vocabulary and axis definitions are the Pattern Ontology
(`http://www.essepuntato.it/2008/12/pattern`; see the exploration
`RESEARCH.md`). PO is cited as a type discipline, never adopted as RDF.

## Pattern axes

| Pattern | Textual | Structured | Contained in |
| --- | --- | --- | --- |
| `atom` | yes | no | flow (block or inline) |
| `field` | yes | no | container |
| `inline` | yes | yes | flow |
| `block` | yes | yes | container |
| `milestone` | no | no | flow |
| `meta` | no | no | container |
| `popup` | no | yes | flow |
| `container` | no | yes | container |
| `headedContainer` | no | yes | container (head blocks first) |
| `record` | no | yes | container (heterogeneous children) |
| `table` | no | yes | container (homogeneous children) |

Classification reads each constructor's schema fields only: a constructor
with recursive inline children is `inline`/`block`, a string payload with no
children is `atom`/`field`, no payload is `milestone`/`meta`, and block or
mixed children make a `container` family pattern. Where a Markdown shorthand
mixes inline and block children (`Li`, `TaskItem`, `ListItemNode`) the
constructor is classified by the content it must hold (`container`); the
tight-list inline children are the Pandoc `Plain` shorthand.

## `@beep/md` — `Md.model.ts` (31 tagged classes)

Unions: `Inline` (12 members), `Block` (14 members). Outside the unions but
reachable through fields: `Li`, `TaskItem`, `TableCell`, `TableRow`,
`Document`.

| Tag | Class | Pattern |
| --- | --- | --- |
| `text` | Text | atom |
| `rawMarkdown` | RawMarkdown | atom |
| `rawHtml` | RawHtml | atom |
| `strong` | Strong | inline |
| `em` | Em | inline |
| `del` | Del | inline |
| `code` | Code | atom |
| `a` | A | inline |
| `img` | Img | milestone |
| `br` | Br | milestone |
| `inlineMath` | InlineMath | atom |
| `footnoteReference` | FootnoteReference | milestone |
| `p` | P | block |
| `heading` | Heading | block |
| `li` | Li | container |
| `ul` | Ul | table |
| `ol` | Ol | table |
| `taskItem` | TaskItem | container |
| `taskList` | TaskList | table |
| `blockquote` | BlockQuote | container |
| `pre` | Pre | field |
| `tableCell` | TableCell | block |
| `tableRow` | TableRow | table |
| `table` | Table | table |
| `youtube` | YouTube | meta |
| `mathBlock` | MathBlock | field |
| `footnoteDefinition` | FootnoteDefinition | container |
| `admonition` | Admonition | container |
| `embed` | Embed | meta |
| `hr` | Hr | meta |
| `document` | Document | container |

## `@beep/pandoc-ast` — `Pandoc.model.ts` (38 tagged classes + 6 tagged structs)

Unions: `PandocInline` (21), `PandocBlock` (15), `PandocMetaValue` (7).
`PandocDocument` is the root. `PandocAttr`, `PandocTarget`, `Citation`, and
`PandocCaption` are untagged `S.Class` payloads and are out of scope.

| Tag | Constructor | Pattern |
| --- | --- | --- |
| `str` | Str | atom |
| `space` | Space | milestone |
| `softbreak` | SoftBreak | milestone |
| `linebreak` | LineBreak | milestone |
| `emph` | Emph | inline |
| `strong` | Strong | inline |
| `strikeout` | Strikeout | inline |
| `underline` | Underline | inline |
| `superscript` | Superscript | inline |
| `subscript` | Subscript | inline |
| `smallCaps` | SmallCaps | inline |
| `quoted` | Quoted | inline |
| `cite` | Cite | inline |
| `rawInline` | RawInline | atom |
| `code` | Code | atom |
| `link` | Link | inline |
| `image` | Image | inline |
| `span` | Span | inline |
| `note` | Note | popup |
| `math` | Math | atom |
| `unknownInline` | UnknownInline | milestone |
| `plain` | Plain | block |
| `para` | Para | block |
| `header` | Header | block |
| `blockquote` | BlockQuote | container |
| `codeblock` | CodeBlock | field |
| `bulletlist` | BulletList | table |
| `orderedlist` | OrderedList | table |
| `horizontalrule` | HorizontalRule | meta |
| `div` | Div | container |
| `lineBlock` | LineBlock | table |
| `rawBlock` | RawBlock | field |
| `definitionList` | DefinitionList | table |
| `figure` | Figure | container |
| `table` | Table | table |
| `unknownBlock` | UnknownBlock | meta |
| `metaBool` | MetaBool | field |
| `metaString` | MetaString | field |
| `metaInlines` | MetaInlines | block |
| `metaBlocks` | MetaBlocks | container |
| `metaList` | MetaList | table |
| `metaMap` | MetaMap | record |
| `unknownMeta` | UnknownMeta | meta |
| `pandocDocument` | PandocDocument | container |

## `@beep/lexical-schema` — `Lexical.model.ts` (16 tagged classes)

Union: `LexicalNode` (16 members, discriminated on `type`). `BaseNode`,
`ElementNode`, and `TextBase` are abstract bases without a `type` literal and
are out of scope.

| Type | Class | Pattern |
| --- | --- | --- |
| `text` | TextNode | atom |
| `tab` | TabNode | atom |
| `linebreak` | LineBreakNode | milestone |
| `artifact-ref` | ArtifactRefNode | meta |
| `youtube` | YouTubeNode | meta |
| `root` | RootNode | container |
| `paragraph` | ParagraphNode | block |
| `heading` | HeadingNode | block |
| `quote` | QuoteNode | block |
| `list` | ListNode | table |
| `listitem` | ListItemNode | container |
| `link` | LinkNode | inline |
| `code` | CodeNode | block |
| `table` | TableNode | table |
| `tablerow` | TableRowNode | table |
| `tablecell` | TableCellNode | container |

`QuoteNode` is the one multi-pattern constructor: legacy quotes hold inline
children (`block`), shadow-root quotes hold root children (`container`). The
class carries the legacy pattern; the conservation report classifies the
shadow-root realization per instance.

## Existing diagnostic paths

| Mapping | Diagnostic | Where |
| --- | --- | --- |
| Pandoc → Md | `PandocMappingIssue` (`lossy`/`unsupported`) with a `JsonPath` into the Pandoc document | `Pandoc.mapping.ts` `pandocBlockToMd`/`pandocInlineToMd`; 36 issue sites |
| Md → Pandoc | `PandocMappingIssue` with a `JsonPath` into the Md document | `Pandoc.mapping.ts` `mdBlockToPandoc`/`mdInlineToPandoc` |
| Md → Lexical | none at runtime; lossiness profile is documented prose in the package README and codec JSDoc | `Lexical.codec.ts` `blockToLexical`, `inlineToLexical` |
| Lexical → Md | none at runtime; total projection | `Lexical.codec.ts` `nodeToBlocks` |
| Lexical wire | `LexicalCompatibilityIssue` / `LexicalConformanceResult` classify wire acceptance, not mapping lossiness | `Lexical.model.ts`, `Lexical.conformance.ts` |

## Seam fixed for P1

- The annotation is the `po` key on Effect schema annotations, typed by a
  `PoPattern` LiteralKit through module augmentation, exactly as
  `@beep/schema/Conformance` types its `conformance` key. It rides the
  `$I.annote(...)` / `$I.annoteSchema(...)` call every constructor already
  makes, so no constructor gains a second annotation call.
- The kit, the axis table, the annotation reader, and the tagged-constructor
  walker live in `@beep/schema/PatternOntology`; all three AST packages
  already depend on `@beep/schema`.
- The exhaustiveness proof walks each package's root schema AST for tagged
  declarations and requires a decodable `po` annotation on every one, so a
  constructor added anywhere in the reachable graph fails the proof.
- Conservation is derived: a transition's source and target patterns come
  from the annotations, and a changed pattern must coincide with an existing
  `PandocMappingIssue` at that path (Pandoc) or appear in the documented
  lossiness profile asserted by the Lexical codec tests. No new issue channel.
