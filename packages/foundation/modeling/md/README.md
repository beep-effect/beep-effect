# @beep/md

Schema-first Markdown document modeling and rendering for Beep.

## Installation

```bash
bun add @beep/md
```

## Usage

```ts
import { Md } from "@beep/md"
import { Result } from "effect"

const document = Md.make([Md.h1`Hello`, Md.p`World`])
const markdown = Md.render(document)

console.log(Result.getOrThrow(markdown)) // "# Hello\n\nWorld"
```

## Package Role

`@beep/md` owns the repo-native Markdown AST, constructors, pure behavior, escaping helpers, and render adapters.
It is not a Markdown string parser and does not depend on `marked`; `marked` is used only as a reference for
capability, fixture, and security comparisons.

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
import { Result } from "effect"

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
