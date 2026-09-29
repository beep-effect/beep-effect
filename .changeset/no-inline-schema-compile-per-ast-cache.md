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

A schema derived from a module-level one inside the call is inline construction too:
`Schema.decodeSync(Model.pipe(Schema.check(...)))`, `Model.check(...)`, `Model.annotate(...)`
and `Model.annotateKey(...)` each build a new AST per call and are reported when the receiver
and every argument are module-scope bindings. The same builders over a parameter or a
body-local schema, or with a function-literal argument, are left alone, and an argument-free
`Model.pipe()` returns its receiver and still hits the cache.
