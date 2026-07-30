# @beep/pandoc-ast Agent Guide

Schema-first Pandoc JSON AST mirror and compatibility adapters.

| Surface | Key exports | Notes |
| --- | --- | --- |
| `@beep/pandoc-ast` | re-exports from `Pandoc.codec`, `Pandoc.mapping`, `Pandoc.model`, `Pandoc.report` | package entry point |
| `@beep/pandoc-ast/Pandoc.codec` | strict/lossless decode and encode APIs, `PandocDecodeError`, `PandocJsonWire` | strict semantic and exact lossless Pandoc JSON boundary |
| `@beep/pandoc-ast/Pandoc.mapping` | `pandocToDocument`, `documentToPandoc`, `pandocToMd`, `mdToPandoc` | Pandoc/Md compatibility projections |
| `@beep/pandoc-ast/Pandoc.model` | `PandocDocument`, recursive `PandocMeta`, `PandocBlock`, `PandocInline`, `Table` | schema-first AST models; tables store only the canonical payload |
| `@beep/pandoc-ast/Pandoc.report` | `PandocCompatibilityReport`, `PandocMappingIssue` | compatibility issue/report model with derived pointer and profile |

Known constructor names with malformed payloads fail strict decoding. Future
constructor names remain typed `Unknown*` nodes. Lossless decoding additionally
retains the exact top-level JSON object and reports malformed known
constructors through structured, path-located issues without replacing their
raw wire with synthetic semantic nodes.
