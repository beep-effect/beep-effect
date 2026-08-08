---
"@beep/acp": patch
"@beep/professional-desktop": patch
"@beep/oip-web": patch
"@beep/architecture-lab-proof": patch
"@beep/practice-kg-mcp": patch
---

Close the jsdoc-carrier-migration follow-ups: regenerate the acp `schema.gen.ts` from the
converted emitter (titled Example sections; upstream `S.Number` now emitted as `S.Finite`
because OpenAPI numbers are JSON-finite, clearing 45 schemaNumber governance findings and
retiring the repo's last 342 legacy `@example` carriers), and migrate all apps legacy
carriers to titled Example sections with conservation proven (272 blocks, zero residue).
The zero-legacy documentation gate now scans `apps/**/src` in both scopes and its
generated-residual allowlist is empty.
