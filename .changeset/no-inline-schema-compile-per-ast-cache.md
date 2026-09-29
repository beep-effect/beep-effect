---
"@beep/lint-rules": patch
---

Narrow `beep/no-inline-schema-compile` to inline schema construction. Effect caches each schema's parser per AST, so a decoder or encoder over a plain schema reference inside a function body compiles once; the rule no longer reports it. A schema built inline in the call (`Schema.decodeSync(Schema.Array(Model))`) is a new AST on every call, misses that cache, and is still reported with a message that says so.

An inline construction is reported only when it is hoistable: every leaf identifier must
resolve to a module-scope binding (an import local or a top-level `const`, `class` or
`function`), collected from the program up front. The rule no longer infers that from
capitalization, so a lowercase module-level schema such as `model` in
`Schema.decodeSync(Schema.Array(model))` is reported, and a capitalized body-local or parameter
schema is not.
