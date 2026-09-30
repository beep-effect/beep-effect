---
"@beep/schema": minor
"@beep/acp": patch
"@beep/ai-provider-cli": patch
"@beep/ai-sync": patch
"@beep/drizzle": patch
"@beep/duckdb": patch
"@beep/ecfr": patch
"@beep/editor": patch
"@beep/epistemic-use-cases": patch
"@beep/exiftool": patch
"@beep/face-detection": patch
"@beep/ffmpeg": patch
"@beep/file-processing": patch
"@beep/govinfo": patch
"@beep/html": patch
"@beep/hubspot": patch
"@beep/law-practice-server": patch
"@beep/law-practice-use-cases": patch
"@beep/lexical-schema": patch
"@beep/md": patch
"@beep/nlp-mcp": patch
"@beep/nlp-processing": patch
"@beep/obs": patch
"@beep/observability": patch
"@beep/onepassword-cli": patch
"@beep/openclaw": patch
"@beep/pandoc-ast": patch
"@beep/phoenix": patch
"@beep/postgres": patch
"@beep/practice-kg-mcp": patch
"@beep/professional-desktop": patch
"@beep/qa-capture": patch
"@beep/repo-ai-metrics": patch
"@beep/runpod": patch
"@beep/sanity": patch
"@beep/shared-domain": patch
"@beep/tailscale": patch
"@beep/test-utils": patch
"@beep/wink": patch
"@beep/xai": patch
---

Add `SchemaUtils.alwaysEquivalent` (`@beep/schema/SchemaUtils/toEquivalence`),
a named always-true equivalence thunk for `S.overrideToEquivalence`. The
consumers of the retired `Defect` and `OpaqueUnknown` wrappers now write
`S.overrideToEquivalence(SchemaUtils.alwaysEquivalent)` instead of repeating
`S.overrideToEquivalence(() => () => true)` at every field. Behavior is
unchanged: the opaque field still travels with its owner and still stays out
of `S.toEquivalence` of the owning schema. The shared value is covered once in
`@beep/schema`, so consumer packages no longer carry two uncovered functions per
opaque field.
