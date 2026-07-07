---
"@beep/govinfo": patch
---

Crispen `@beep/govinfo` for the P2 repo-crispening wave: move config defaults and optional error context into schemas, replace manual status probing with schema-derived decoding, colocate codec statics on tagged unions, tighten pagination/count/status/checksum invariants while preserving encoded shapes, and add schema-derived encoded-shape plus `S.toArbitrary` parity laws.
