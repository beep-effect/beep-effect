---
"@beep/schema": minor
"@beep/agents-domain": patch
"@beep/agents-server": patch
"@beep/ai-provider-cli": patch
"@beep/ai-sync": patch
"@beep/brand": patch
"@beep/chalk": patch
"@beep/dock": patch
"@beep/documents-server": patch
"@beep/editor": patch
"@beep/epistemic-domain": patch
"@beep/epistemic-server": patch
"@beep/epistemic-use-cases": patch
"@beep/exiftool": patch
"@beep/file-processing": patch
"@beep/firecrawl": patch
"@beep/html": patch
"@beep/infra": patch
"@beep/langextract": patch
"@beep/law-practice-domain": patch
"@beep/law-practice-server": patch
"@beep/law-practice-use-cases": patch
"@beep/lexical-schema": patch
"@beep/libpff": patch
"@beep/m365": patch
"@beep/mcp-kit": patch
"@beep/md": patch
"@beep/nlp": patch
"@beep/observability": patch
"@beep/ontology": patch
"@beep/ontology-domain": patch
"@beep/openclaw": patch
"@beep/pandoc-ast": patch
"@beep/professional-desktop": patch
"@beep/rdf": patch
"@beep/repo-ai-metrics": patch
"@beep/repo-configs": patch
"@beep/runpod": patch
"@beep/shared-domain": patch
"@beep/skill-contract": patch
"@beep/tika": patch
"@beep/ui": patch
---

Trim `LiteralKit` and `MappedLiteralKit` to the facets upstream
`effect/Schema` does not cover: `Enum`, `is`, `$match` and `toTaggedUnion`
stay; `Options`, `pickOptions`, `omitOptions`, `HashSet`, `thunk`, the
`enumMapping` overload with its `M` type parameter, and the collision and
coverage errors are removed. Read `.literals`, `.pick([...]).literals`,
`HashSet.fromIterable(X.literals)` and `Function.constant(X.Enum.k)` instead.
The kits now override `rebuild`, so their helpers survive `annotate`,
`annotateKey` and `check`. `withLiteralKitStatics` copies only the kept
helpers. Consumers are migrated by the `beep lint schema-parity-codemod`
rewrite.

`omitOptions` call sites become an explicit `.pick([...])` of the complement.
For `@beep/law-practice-domain`, `WipoSt13OfficeCode` now lists every ST.3
office except `US` and `XX` instead of deriving the set; a new `OfficeCode`
literal is no longer included automatically, and a domain test fails until
the pick lists it.
