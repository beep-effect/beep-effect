---
path: packages/foundation/modeling/md
summary: Schema-first Markdown document modeling and rendering
tags: [effect]
---

# @beep/md

Schema-first Markdown document modeling and rendering for Beep.

## Architecture

`@beep/md` is a schema-first Markdown AST builder and renderer. The public DSL
constructs typed Markdown document nodes, while render adapters convert the AST
to Markdown, HTML fragments, or future resourceful targets. It is not a
Markdown string parser and does not depend on `marked`; `marked` is reference
material for capability, fixture, and security comparison only.

## Core Modules

| Module | Purpose |
|--------|---------|
| `index.ts` | Package entry point and named re-export surface |
| `Md.model.ts` | Effect Schema models and schema-owned plain-text and HTML AST projections for inline nodes, block nodes, and documents |
| `Md.behavior.ts` | Shared list-item run segmentation and compatibility aliases for schema-owned projections |
| `Md.ts` | Public `Md` DSL namespace and constructor helpers |
| `Md.render.ts` | Pure/effectful render adapter contracts, render APIs, and schema transformations |
| `Md.escape.ts` | Markdown/HTML escaping, URL policy sanitation, code-language sanitation, and render primitives |
| `Md.html.ts` | `SafeDocument` conformance, policy, and opaque `SafeHtml` serialization boundary |
| `Md.safe.ts` | Branded user-content refinements and path-located trust-boundary issues |

## Usage Patterns

```typescript
import { Md } from "@beep/md"
import { Result } from "effect"

const document = Md.make([Md.h1`Hello`, Md.p`World`])
const markdown = Md.render(document)

console.log(Result.getOrThrow(markdown))
```

Rendering helpers are synchronous and pure. `Md.render`, `Md.renderHtml`, and `Md.renderWith` return
`Result.Result<Output, RenderError>` so callers can handle adapter failures without introducing an `Effect` runtime
for ordinary Markdown/HTML string rendering. The unsafe mirrors intentionally call adapters directly for boundaries
that choose original thrown-error behavior.

The `Result` wrapper is adapter-failure-safe, and the default HTML renderer escapes text-like inline values including
`Md.rawHtml(...)`. Trusted HTML remains an explicit adapter boundary: custom adapters or externally-branded
`HtmlFragment` values should only carry content that was audited or sanitized upstream.

`Document` is the general persistence model. `SafeDocument` preserves its encoded wire while excluding trusted raw
nodes, user-content URLs outside the link/image allow lists, duplicate footnote definitions, and scalar strings that
cannot complete safe HTML serialization. It also excludes structures whose direct HTML projection has hard
author-conformance issues, including skipped heading levels. Use `refineSafeDocument` for decoded values and
`decodeSafeDocument` for encoded external input.

`Document.toHtml` maps directly into the `@beep/html` AST. For browser sinks,
`renderSafeHtml(SafeDocument)` proves that fragment conformant, enforces HTML
policy, and returns opaque `SafeHtml`. Preserve that marker through intermediate
code and call `safeHtmlValue` only at a final browser or framework sink.

`Md.rawMarkdown(...)` is trusted Markdown source. URL-bearing render sinks should choose
`CompatibilityUrlPolicySpec`, `BrowserSafeUrlPolicySpec`, or `StrictWebUrlPolicySpec` explicitly. `UrlPolicySpec`
is applied inside the recursive render fold.

## Design Decisions

| Decision | Rationale |
|----------|-----------|
| Result-returning pure render APIs | Keeps synchronous rendering explicit about adapter failure while avoiding `Effect.run*` at library call sites. |
| Unsafe render mirrors | Preserve direct adapter calls where original thrown-error behavior is intentional. |
| Trusted raw HTML boundaries | Default rendering escapes `rawHtml`; only custom adapters or external `HtmlFragment` values should be treated as trusted HTML boundaries. |
| General vs safe document schemas | Persistence remains lossless; editor/RPC user input uses a same-wire branded refinement with structured issues. |
| Typed safe-HTML projection | Avoids an HTML parser/string sanitizer in foundation code while retaining conformance, policy, and provenance proofs. |
| Schema-owned URL policy | A tagged canonical policy prevents nested rendering from silently reverting to built-in defaults. |
| No parser dependency | Keeps `@beep/md` as repo-owned foundation modeling substrate; external parser engines remain reference or driver concerns. |

## Dependencies

**Internal**: `@beep/html`, `@beep/identity`, `@beep/schema`, `@beep/utils`
**External**: `effect`

## Related

- **AGENTS.md** - Detailed contributor guidance
