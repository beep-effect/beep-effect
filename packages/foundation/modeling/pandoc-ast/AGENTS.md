# @beep/pandoc-ast Agent Guide

Schema-first Pandoc JSON AST mirror and compatibility adapters.

| Surface | Key exports | Notes |
| --- | --- | --- |
| `@beep/pandoc-ast` | re-exports from `Pandoc.codec`, `Pandoc.mapping`, `Pandoc.model`, `Pandoc.report` | package entry point |
| `@beep/pandoc-ast/Pandoc.codec` | strict/lossless decode and encode APIs, `PandocDecodeError`, `PandocJsonWire` | strict semantic and exact lossless Pandoc JSON boundary |
| `@beep/pandoc-ast/Pandoc.mapping` | `pandocToDocument`, `documentToPandoc`, `pandocToMd`, `mdToPandoc` | Pandoc/Md compatibility projections |
| `@beep/pandoc-ast/Pandoc.model` | `PandocDocument`, recursive `PandocMeta`, `PandocBlock`, `PandocInline`, `Table` | schema-first AST models; tables store only the canonical payload |
| `@beep/pandoc-ast/Pandoc.report` | `PandocCompatibilityReport`, `PandocMappingIssue` | compatibility issue/report model with derived pointer and profile |

The known-name registry exhaustively pins every Pandoc 1.23.1 data and newtype
constructor, including names whose upstream JSON is structural rather than
tagged, and is broader than the semantic subset. Malformed supported
constructors and current-but-unmodeled constructors fail strict decoding; only
genuine future names become typed `Unknown*` nodes. Lossless decoding retains
the exact top-level JSON object and reports both failure classes through
structured, path-located issues without replacing their raw wire with synthetic
semantic nodes.
