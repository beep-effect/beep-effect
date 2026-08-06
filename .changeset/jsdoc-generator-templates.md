---
"@beep/box": patch
"@beep/acp": patch
"@beep/runpod": patch
"@beep/ecfr": patch
"@beep/gov-legal-mcp": patch
"@beep/html": patch
"@beep/rdf": patch
"@beep/data": patch
"@beep/ai-sync": patch
"@beep/repo-cli": patch
"@beep/professional-desktop": patch
---

Convert every repo-owned generator to emit titled `**Example** (Title)` sections instead of
the retired `@example`/`@remarks` carriers (P2 of `goals/jsdoc-carrier-migration`), and
regenerate their outputs: box, acp (meta only), runpod, ecfr, gov-legal-mcp, html (including
the lone generated `@remarks` routed to a section), the `sync-data-to-ts` targets
(iso4217, cldr-territories, iana-timezones, vocab-terms), ai-sync, and the
professional-desktop migration bundle. Also fixes the `sync-data-to-ts` archive entry
matcher whose bare suffix match (`australasia` ends with `asia`) had made the
iana-timezones target unregenerable since it landed, refreshing tzdb 2026b → 2026c with
zero identifier changes. acp `schema.gen.ts` is intentionally not regenerated: doing so
materializes a pre-existing stale rewrite (S.Unknown → S.Json, schemaNumber governance
failures) that belongs to its own acp-resync PR.
