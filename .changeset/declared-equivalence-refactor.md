---
"@beep/ai-provider-cli": patch
"@beep/ai-sync": patch
"@beep/anthropic": patch
"@beep/box": patch
"@beep/cosmos": patch
"@beep/discord": patch
"@beep/doc-text": patch
"@beep/drizzle": patch
"@beep/duckdb": patch
"@beep/ecfr": patch
"@beep/exiftool": patch
"@beep/face-detection": patch
"@beep/ffmpeg": patch
"@beep/firecrawl": patch
"@beep/gov-legal-mcp": patch
"@beep/govinfo": patch
"@beep/graph-3d": patch
"@beep/hubspot": patch
"@beep/libpff": patch
"@beep/m365": patch
"@beep/n3": patch
"@beep/nlp-mcp": patch
"@beep/obs": patch
"@beep/onepassword-cli": patch
"@beep/openclaw": patch
"@beep/oxigraph": patch
"@beep/pacer": patch
"@beep/pglite": patch
"@beep/phoenix": patch
"@beep/postgres": patch
"@beep/pretext": patch
"@beep/runpod": patch
"@beep/sanity": patch
"@beep/shacl": patch
"@beep/skill-contract": patch
"@beep/tailscale": patch
"@beep/tika": patch
"@beep/uspto": patch
"@beep/venice-ai": patch
"@beep/wink": patch
"@beep/xai": patch
---

Tagged errors adopt their declared struct equivalence through `$I.annoteError<Self>(...)`
instead of a hand-derived comparator, and opaque causes use `Defect` from `@beep/schema`, whose
schema declares an always-true equivalence. No field or wire shape changes; `S.toEquivalence`
over these error classes keeps comparing declared diagnostic identity and ignoring the defect
payload. Doctrine: `standards/architecture/DECISIONS.md` (2026-08-24 amendment).
