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
| `Md.model.ts` | Effect Schema models for inline nodes, block nodes, and documents |
| `Md.ts` | Public `Md` DSL namespace and constructor helpers |
| `Md.render.ts` | Pure/effectful render adapter contracts, render APIs, and schema transformations |
| `Md.escape.ts` | Markdown/HTML escaping, URL policy sanitation, code-language sanitation, and render primitives |

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

`Md.rawMarkdown(...)` is trusted Markdown source. URL-bearing render sinks should choose the default compatibility
policy, `BrowserSafeUrlPolicy`, or `StrictWebUrlPolicy` explicitly when the sink is security-sensitive.

## Design Decisions

| Decision | Rationale |
|----------|-----------|
| Result-returning pure render APIs | Keeps synchronous rendering explicit about adapter failure while avoiding `Effect.run*` at library call sites. |
| Unsafe render mirrors | Preserve direct adapter calls where original thrown-error behavior is intentional. |
| Trusted raw HTML boundaries | Default rendering escapes `rawHtml`; only custom adapters or external `HtmlFragment` values should be treated as trusted HTML boundaries. |
| No parser dependency | Keeps `@beep/md` as repo-owned foundation modeling substrate; external parser engines remain reference or driver concerns. |

## Dependencies

**Internal**: `@beep/identity`, `@beep/schema`, `@beep/utils`
**External**: `effect`

## Related

- **AGENTS.md** - Detailed contributor guidance
