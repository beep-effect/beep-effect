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
list starts, table alignment, TeX math, footnotes, admonitions, and safe generalized embeds. `Md.youtube(...)` remains
as a compatibility helper beside the generalized `Md.embed(...)` node.

## Rendering contract

`Md.render`, `Md.renderHtml`, and `Md.renderWith` are synchronous pure render APIs that return
`Result.Result<Output, RenderError>`. `Result` is intentional here: it captures adapter failures without
requiring an `Effect` runtime for pure rendering. The `renderUnsafe`, `renderHtmlUnsafe`, and `renderWithUnsafe`
mirrors are available for boundaries that deliberately call the adapter directly and allow its original exception to
throw.

The `Result` render APIs are adapter-failure-safe, and the default HTML renderer escapes text-like inline content
including `Md.rawHtml(...)`. Treat trusted HTML boundaries as explicit adapter decisions: if a custom adapter or
external branded `HtmlFragment` introduces unsafe HTML, that boundary must be audited or sanitized upstream.

`Md.rawMarkdown(...)` is trusted Markdown source. Do not construct it from untrusted user content unless the caller has
already decided that Markdown injection is acceptable for that boundary.

## URL policies

URL escaping is centralized in `Md.escape`. Markdown output keeps the compatibility policy by default: active
`javascript:`, `vbscript:`, and `data:` protocol tricks are neutralized. HTML output defaults to `BrowserSafeUrlPolicy`,
which allows relative links plus `http:`, `https:`, `mailto:`, and package-owned `artifact:` links while blocking
protocol-relative and backslash-bearing relative destinations.

Use `makeMarkdownAdapter({ urlPolicy })`, `makeHtmlFragmentAdapter({ urlPolicy })`, or the `*WithPolicy` escape helpers
when a sink needs stricter behavior such as `StrictWebUrlPolicy`.

## Development

```bash
# Build
bun run build

# Type check
bun run check

# Test
bun run test

# Type tests
bun run type-test

# Type tests through Turbo
bunx turbo run type-test --filter=@beep/md

# Lint
bun run lint

# Documentation
bun run docgen

# Repair formatting/lint issues
bun run lint:fix
```

## License

MIT
