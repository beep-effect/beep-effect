---
"@beep/sanity": patch
---

Crispen `@beep/sanity` for the P2 repo-crispening wave: move Sanity API host normalization and config/request defaults into schemas, colocate schema decoders and statics, add field-level annotations, tighten response latency and HTTP status domains, remove heterogeneous optional compaction at the layer boundary, and add package-local encoded-shape plus `S.toArbitrary` parity laws. Public error-context Option conversion is deferred to the family-close sweep because it requires a cross-package consumer sweep.
