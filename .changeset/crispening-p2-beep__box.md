---
"@beep/box": patch
---

Crispen `@beep/box` for the P2 repo-crispening wave: model CCG subjects and error diagnostics as schema-owned `Option` fields with constructor defaults, keep SDK error construction on the existing raw options signature, add codec statics without clobbering LiteralKit helpers, tighten Box status, upload-size, part-index, and HTTPS URL schemas, update the generator template for future generated schema statics, and add package-local encoded-shape plus `S.toArbitrary` parity laws. Public encoded wire shapes remain unchanged.
