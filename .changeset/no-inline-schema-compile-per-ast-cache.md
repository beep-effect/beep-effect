---
"@beep/lint-rules": patch
---

Narrow `beep/no-inline-schema-compile` to inline schema construction. Effect caches each schema's parser per AST, so a decoder or encoder over a plain schema reference inside a function body compiles once; the rule no longer reports it. A schema built inline in the call (`Schema.decodeSync(Schema.Array(Model))`) is a new AST on every call, misses that cache, and is still reported with a message that says so.
