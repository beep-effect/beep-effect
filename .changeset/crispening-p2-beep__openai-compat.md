---
"@beep/openai-compat": patch
---

Crispen `@beep/openai-compat` for the P2 repo-crispening wave: move client and language-model defaults into schemas, colocate OpenAI-compatible codec statics and decoders, tighten request and usage numeric domains, add DTO annotations, replace heterogeneous request compaction with `O.getSomesStruct`, and add encoded-shape plus `S.toArbitrary` parity coverage while preserving the provider wire shape.
