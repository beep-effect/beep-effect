---
"@beep/ffmpeg": patch
---

Crispen `@beep/ffmpeg` for the P2 repo-crispening wave: move runtime config defaults into the config schema, model ffprobe/progress/error absence as `Option` fields with constructor defaults, tighten frame, dimension, percent, and process-exit numeric domains, colocate codec/statics and schema-backed helper contracts, add field-level annotations, and add package-local encoded-shape plus `S.toArbitrary` parity laws. Public encoded wire shapes remain unchanged.
