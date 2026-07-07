---
"@beep/lint-rules": patch
---

Crispen `@beep/lint-rules` for the P2 repo-crispening wave: move the rule registry and import-binding metadata into schema-backed forms, represent registry absence as `Option` while preserving the encoded `null` wire shape, route import-binding behavior through exhaustive schema-owned matching, tighten harness source-coordinate schemas to integer domains, and add package-local encoded-shape plus `S.toArbitrary` parity laws.
