---
"@beep/ai-provider-cli": patch
"@beep/anthropic": patch
"@beep/cosmos": patch
"@beep/discord": patch
"@beep/doc-text": patch
"@beep/exiftool": patch
"@beep/ffmpeg": patch
"@beep/firecrawl": patch
"@beep/gov-legal-mcp": patch
"@beep/graph-3d": patch
"@beep/hubspot": patch
"@beep/libpff": patch
"@beep/n3": patch
"@beep/nlp-mcp": patch
"@beep/obs": patch
"@beep/openclaw": patch
"@beep/oxigraph": patch
"@beep/pacer": patch
"@beep/phoenix": patch
"@beep/pretext": patch
"@beep/runpod": patch
"@beep/sanity": patch
"@beep/shacl": patch
"@beep/tailscale": patch
"@beep/venice-ai": patch
"@beep/wink": patch
"@beep/xai": patch
"@beep/repo-cli": patch
---

Complete the drivers-family tagged-error declared-equivalence sweep and ratify
it as doctrine. Every remaining `S.TaggedError` in `packages/drivers/*/src`
now declares a fields-only `toEquivalence` at the class declaration (the
Uspto/Tika pattern from the platform hygiene sweep), so
`S.toEquivalence(Error)` compares declared diagnostic identity instead of
falling back to `Equal.equals` over `Error` runtime metadata — the
seed-dependent property-flake class proven in issue #677. Opaque `S.Defect`
fields stay out of comparators; each migrated package gains a
declared-field equivalence test. `@beep/repo-cli` adds the
`SFV4-tagged-error-equivalence` schema-first detector with an exception
baseline for the non-driver tail, and the error-boundary architecture doc
plus decision log record the law.
