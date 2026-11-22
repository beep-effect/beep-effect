# @beep/md

Schema-first Markdown document modeling and rendering for Beep.

## Installation

```bash
bun add @beep/md
```

## Usage

```ts
import { Md } from "@beep/md"
import * as Result from "effect/Result";
const document = Md.make([Md.h1`Hello`, Md.p`World`])
const markdown = Md.render(document)

console.log(Result.getOrThrow(markdown)) // "# Hello\n\nWorld"
```

## Package Role

`@beep/md` owns the repo-native Markdown AST, constructors, pure behavior, escaping helpers, and render adapters.
The package root is not a Markdown string parser and does not depend on `marked`; `marked` is used only as a
reference for capability, fixture, and security comparisons. Parsing text lives on two subpaths,
`@beep/md/Md.syntax` and `@beep/md/Md.parse`, which bridge the `@beep/markdown` syntax tree into an `Md.Document`
(see [Parsing Markdown text](#parsing-markdown-text)).

The AST includes common Markdown blocks/inlines plus typed extensions for JSON frontmatter, link/image titles, ordered
list starts, table alignment, TeX math, footnotes, admonitions, and generalized embeds. `Md.youtube(...)` remains as a
compatibility helper beside `Md.embed(...)`.

`Document` is persistence truth and intentionally permits trusted raw nodes. `SafeDocument` is the narrower
user-content refinement used by editor and RPC boundaries. It has the same encoded JSON representation, but rejects
`rawMarkdown`, `rawHtml`, URL destinations outside the user-content policy, duplicate footnote definitions, and NUL
or lone-surrogate strings that cannot complete the safe HTML projection. It also rejects document structures whose
direct `@beep/html` projection violates a hard author-conformance rule, such as a skipped heading level. Use
`refineSafeDocument` for an
already-decoded `Document`, `decodeSafeDocument` at a JSON/wire boundary, and `documentSafetyIssues` when UI needs
path-located conversion feedback.

For an HTML injection sink, establish that boundary and project through the
typed HTML AST:

```ts
import { Md, safeHtmlValue } from "@beep/md"
import * as Result from "effect/Result";
const document = Result.getOrThrow(
  Md.refineSafeDocument(Md.make([Md.p(Md.a("https://example.com", "Example"))]))
)
const safeHtml = Md.renderSafeHtml(document)

// Unwrap only at the final framework or browser sink.
console.log(safeHtmlValue(safeHtml))
```

`renderSafeHtml` never parses or sanitizes an intermediate string. It maps
`SafeDocument` directly to `@beep/html`, proves the fragment conformant, applies
the canonical deny-by-default policy, and returns that package's opaque,
runtime-issued `SafeHtml`.

## Parsing Markdown text

`@beep/markdown` owns parsing: positioned nodes, trivia, and offset-splice edits. `@beep/md` owns the persisted
semantic model. The bridge between them is three subpath modules:

- `@beep/md/Md.syntax` folds a parsed `MarkdownDocument` into an `Md.Document` with `fromMarkdownDocument`, and
  carries the loss, source-map, and option schemas.
- `@beep/md/Md.parse` runs the `@beep/markdown` parser with frontmatter capture on and then the fold:
  `parseResult` and `parseSafeResult` return a `Result`, `parse` and `parseSafe` are their `Effect` twins.
- `@beep/md/Md.anchors` turns a source-map span into evidence: `anchorAt` slices the node's span from a
  `@beep/text` `VerifiedSourceText` and proves it, returning `Option<VerifiedTextAnchor>`. A zero-width or synthetic
  span is `None`; a span past the end of the text or inside a surrogate pair fails with `VerifiedTextAnchorError`.

Import them by subpath. None is re-exported from `@beep/md` or from the `Md` namespace, so code that only builds
or renders documents never loads the parser or the frontmatter codecs. A test in `test/Md.import-boundary.test.ts`
holds that rule.

```ts
import { parseResult } from "@beep/md/Md.parse"
import { positionAt } from "@beep/md/Md.syntax"
import * as O from "effect/Option"
import * as Result from "effect/Result"

const bridged = Result.getOrThrow(parseResult("---\ntitle: Notes\n---\n# Notes\n\n<b>hi</b> there"))

console.log(bridged.document.children.map((block) => block._tag)) // [ "heading", "p" ]
console.log(bridged.losses.map((loss) => loss.reason))
// [ "frontmatterFormatChanged", "htmlEscapedAsText", "htmlEscapedAsText" ]
console.log(O.map(positionAt(bridged.sourceMap, bridged.document, ["children", 0]), (span) => span.start.line))
// Some(4)
```

### What the bridge reports

The fold is pure, total, and synchronous, and it never throws. Everything it could not carry unchanged comes back as
data in `losses`: each `MdLoss` names the source node kind, an `MdLossReason`, the source position, and the Md path
the content landed at (if any). `lossSeverity` sorts a reason into `lossy` (the content survives in another shape)
or `unsupported` (the content is gone). The reasons are:

| Area | Reasons |
|------|---------|
| Raw HTML | `htmlEscapedAsText`, `htmlInlinedBlock`, `htmlDropped` |
| Links and references | `autolinkLiteralAsText`, `referenceUnresolved`, `definitionUnreferenced` |
| Code | `codeLanguageDropped`, `codeMetaDropped` |
| Footnotes | `footnoteIdentifierRewritten`, `footnoteDefinitionDuplicate` |
| Lists and admonitions | `taskCheckboxDropped`, `admonitionTitleFlattened` |
| Recognizers | `recognizerSkipped` |
| Frontmatter | `frontmatterInvalid`, `frontmatterNotObject`, `frontmatterValueCoerced`, `frontmatterDropped`, `frontmatterFormatChanged` |
| MDX | `mdxElementUnwrapped`, `mdxDropped` |

Trivia (marker characters, fence lengths, heading styles, label casing) is erased by design and is never a loss:
`Md.render` writes canonical style, and positions live in the source map.

### Defaults

Every option has a default, so no options gives the documented behaviour. Options are passed as plain encoded
objects (`MdSyntaxOptions.Encoded`, `MdParseOptions.Encoded`).

| Option | Default | Effect |
|--------|---------|--------|
| `html` | `"escapeAsText"` | Raw HTML becomes escaped text. `"rawHtml"` keeps `RawHtml` nodes (never safe); `"drop"` removes them. |
| `htmlComments` | `"drop"` | HTML comments are dropped; `"asHtml"` treats them like other HTML. |
| `breakTag` | `true` | `<br>` becomes a hard break. |
| `admonitions` | `true` | `> [!NOTE]` blockquotes become admonitions. |
| `math` | `false` | `$…$`, `$$…$$`, and ```` ```math ```` stay text until the Markdown writer escapes `$`. |
| `youtube` | `false` | A paragraph holding only a YouTube link stays a link. |
| `absorbEmptyTableHeader` | `true` | An all-empty header row becomes a header-less table. |
| `autolinkLiterals` | `"link"` | GFM autolink literals become links; `"text"` keeps them as text. |
| `softBreak` | `"space"` | Soft line breaks become a space; `"newline"` keeps the newline. |
| `frontmatter` | `"decode"` | YAML, TOML, and JSON frontmatter is decoded into the JSON `frontmatter` field; `"drop"` drops it with a loss. |
| `onFrontmatterFailure` | `"loss"` | An invalid or non-object block is a loss; `"fail"` returns `MdFrontmatterError`. |
| `sourceMap` | `true` | Build the source map. |
| `dialect` (`Md.parse` only) | `"gfm"` | Markdown grammar; `"commonmark"` turns the GFM extensions off. |

Frontmatter always round-trips as JSON. A YAML or TOML block reports `frontmatterFormatChanged`, and each value the
JSON projection changed is a `frontmatterValueCoerced` loss addressed by a JSON pointer.

### Safety

`parseResult` returns a general `Document`, which may hold trusted raw nodes when you ask for them.
`parseSafeResult` narrows it to a `SafeDocument` and fails with `MdUnsafeDocumentError`, which carries every
violation and, through `locateViolations`, its source position. With the defaults the parser never produces raw
HTML, so ordinary text refines cleanly.

```ts
import { parseSafeResult } from "@beep/md/Md.parse"
import * as Result from "effect/Result"

console.log(Result.isSuccess(parseSafeResult("<b>x</b>"))) // true
console.log(Result.isFailure(parseSafeResult("<b>x</b>", { html: "rawHtml" }))) // true
```

### Source map lifetime

The bridge builds the whole document as plain data and admits it once through `MdFromSyntax.make`, so the cost is
linear in the node count. The source map is a pre-order list of spans over that exact document. Each entry also
records the Md node's `_tag` and a structural fingerprint of its subtree (a hash over tags, field values and child
fingerprints, computed bottom-up in one pass). The map is valid only for the document it came with. `positionAt`
answers only when every ancestor on the path keeps its tag and child count and the addressed node keeps its tag and
fingerprint. After an insert, a remove, a reorder or an in-place edit it returns `Option.none()` for each node whose
content no longer matches its entry, rather than the span of a different node. Untouched nodes elsewhere still
resolve.

The check compares values, not identity, so the guarantee is this: a returned span was recorded for a node
structurally equal to the one at the path. A moved node that equals the node recorded at its new place still
resolves to that recorded span. Swapping two equal siblings is one case. Swapping two siblings that differ but have
the same tag and child count is another: their descendants are checked one by one, so equal text below them (the
`foo` of `# foo` and `## foo`) resolves to the span recorded at that place. Fingerprints are 32-bit hashes, so a
changed subtree can also match its old entry on a hash collision. Each lookup recomputes the addressed subtree's
fingerprint, so it costs the path walk plus O(subtree size); looking up the document itself is O(n).

There is no `Context.Service`. Parsing has no environment, resource, or alternative implementation; a slice that
wants configured ingest can wrap `parseSafe` in its own service.

## Pattern Ontology classification

Every tagged constructor carries a `po` schema annotation naming its Pattern
Ontology content-model pattern (`atom`, `inline`, `block`, `milestone`, `meta`,
`field`, `container`, `table`, ...), read through `@beep/schema/PatternOntology`.
The pattern is part of the constructor's meaning, not a sidecar table: inline
members are flow patterns, block members are container-level patterns, and the
`Li`/`TaskItem` tight-list shorthand classifies as `container` because that is
the content it must hold. The Pandoc and Lexical packages derive their
correspondence and conservation proofs from these annotations.

## Rendering contract

`Md.render`, `Md.renderHtml`, and `Md.renderWith` are synchronous pure render APIs that return
`Result.Result<Output, RenderError>`. `Result` is intentional here: it captures adapter failures without
requiring an `Effect` runtime for pure rendering. The `renderUnsafe`, `renderHtmlUnsafe`, and `renderWithUnsafe`
mirrors are available for boundaries that deliberately call the adapter directly and allow its original exception to
throw.

The `Result` render APIs are adapter-failure-safe, and the default HTML renderer escapes text-like inline content
including `Md.rawHtml(...)`. Treat trusted HTML boundaries as explicit adapter decisions: if a custom adapter or
external branded `HtmlFragment` introduces unsafe HTML, that boundary must be audited or sanitized upstream.

The legacy string-valued HTML-fragment renderer remains a compatibility
adapter. Prefer `renderSafeHtml` for browser HTML sinks.

`Md.rawMarkdown(...)` is trusted Markdown source. Do not construct it from untrusted user content unless the caller has
already decided that Markdown injection is acceptable for that boundary.

## URL policies

URL escaping is centralized in `Md.escape`. `UrlPolicySpec` is the canonical tagged policy:

- `Compatibility` retains historical behavior while neutralizing active `javascript:`, `vbscript:`, and `data:`
  protocol tricks.
- `AllowList` carries schema-normalized lowercase schemes plus explicit relative, protocol-relative, and
  backslash-relative decisions.

Markdown output defaults to `CompatibilityUrlPolicySpec`. HTML fragments default to `BrowserSafeUrlPolicySpec`, which
allows relative links plus `http:`, `https:`, `mailto:`, `tel:`, and package-owned `artifact:` links while blocking
protocol-relative and backslash-bearing relative destinations. Custom policies are threaded through the recursive
render fold; nested links in lists, tables, footnotes, admonitions, embeds, and YouTube destinations cannot fall back
to a built-in policy.

Use `makeMarkdownAdapter({ urlPolicy })`, `makeHtmlFragmentAdapter({ urlPolicy })`, or the `*WithPolicy` escape helpers
when a sink needs stricter behavior such as `StrictWebUrlPolicySpec`.

## Projection behavior

Plain-text projection preserves content-bearing fallbacks: image nodes contribute their alt text and hard line breaks
contribute `\n`. Use `Inline.toPlainText`, `Block.toPlainText`, or `Document.toPlainText` from the schema that owns the
input. The established `renderPlainTextInline`, `renderPlainTextBlock`, and `renderPlainTextBlocks` functions delegate
to those statics.

HTML AST projection follows the same ownership: `Inline.toHtml`, `Block.toHtml`, and `Document.toHtml` return typed
`@beep/html` nodes. They do not serialize or issue trusted output. `renderSafeHtml` remains the `SafeDocument` boundary
that proves the projected fragment conformant, enforces HTML policy, and returns opaque `SafeHtml`.

`TaskListItemSpec`/`Md.taskListFromItems` is the tagged task-list input.

## Development

```bash
# Build
bun run build

# Type check
bun run check

# Test
bun run test

# Lint
bun run lint

# Documentation
bun run docgen

# Repair formatting/lint issues
bun run lint:fix
```

## License

MIT
