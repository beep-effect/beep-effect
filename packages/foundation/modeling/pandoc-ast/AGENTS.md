# @beep/pandoc-ast Agent Guide

Schema-first Pandoc JSON AST mirror and compatibility adapters.

| Surface | Key exports | Notes |
| --- | --- | --- |
| `@beep/pandoc-ast` | re-exports from `Pandoc.codec`, `Pandoc.mapping`, `Pandoc.model`, `Pandoc.report` | package entry point |
| `@beep/pandoc-ast/Pandoc.codec` | `decodePandocJson`, `decodePandocJsonString`, `encodePandocJsonString`, `PandocJsonWire`, `PandocJsonFromString` | Pandoc JSON wire boundary |
| `@beep/pandoc-ast/Pandoc.mapping` | `pandocToDocument`, `documentToPandoc`, `pandocToMd`, `mdToPandoc` | Pandoc/Md compatibility projections |
| `@beep/pandoc-ast/Pandoc.model` | `PandocDocument`, `PandocBlock`, `PandocInline`, `Table`, `UnknownBlock` | schema-first AST models |
| `@beep/pandoc-ast/Pandoc.report` | `PandocCompatibilityReport`, `PandocMappingIssue` | compatibility issue/report model |
