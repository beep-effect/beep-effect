---json
{"generator":"scratchpad/temp"}
---

# Schema\-first Markdown projections

This document was built as a **Markdown AST** with `@beep/md` and projected onto a target model before serialization\.

## Targets

1. `@beep/html` via `Document.toHtml`
2. `@beep/lexical-schema` via `documentToEditorState`
3. `@beep/pandoc-ast` via `documentToPandoc`
4. Markdown text via `Md.render`

## Stages

| Stage | Package | Output |
| :--- | :--- | :--- |
| Model | @beep/md | Document |
| Projection | target package | target model |
| Serialization | target package | text |

## Example

```ts
import { Md } from "@beep/md/Md"

const doc = Md.make([Md.p(["Hello, ", Md.em("world")])])
```

> [!TIP] Safety
>
> Raw HTML and raw Markdown nodes never enter a safe projection\.

> Each target owns its own *conformance* and serialization rules\.

***

Source: [beep\-effect](https://github.com/beep-effect/beep-effect)\.