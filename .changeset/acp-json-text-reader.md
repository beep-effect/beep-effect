---
"@beep/acp": patch
---

Decode inbound ACP wire frames through a package-owned JSON text reader. `JSON.parse` on V8 12.8
through 13.7 (Node 24, Electron 36 and 37) resolves an escaped object key through an existing map
transition when the raw source prefix matches it, so `_meta` keys such as `"\n"` decoded as `"\\"`
and the protocol round-trip property flaked. Texts without an escaped property key still parse
natively; the rest go through a strict reader, and `Json.fromJsonText` exposes the same boundary as
a schema codec.
