---
"@beep/schema": patch
"@beep/data": patch
"@beep/m365": patch
"@beep/lexical-schema": patch
---

Retire the tstyche type-test surface (quality-speedup): remove the
dtslint-tsgo and turbo type-test lanes, per-package dtslint scaffolding, and
generator support; replace MimeType type-level category slicing with
generator-emitted per-category tuples (barrel importer check time 17.8s →
0.45s); cap hosted turbo concurrency; make the pre-push docgen lane bounded
with --allow-full self-escalation; drop dtslint-only dependency edges.
