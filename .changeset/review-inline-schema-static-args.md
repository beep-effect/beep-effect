---
"@beep/lint-rules": patch
---

Classify nested schema-constructor arguments recursively so runtime-dependent
object and array literals are not reported as hoistable compiler calls, while
static unary numeric literals remain enforceable.
