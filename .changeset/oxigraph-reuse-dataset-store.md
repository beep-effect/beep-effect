---
"@beep/oxigraph": patch
---

Reuse the loaded Oxigraph store for repeated queries against the same immutable
dataset instance within one service Layer. This keeps dataset loading on the
rebuild path instead of silently repeating it for every interactive query.
