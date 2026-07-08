---
"@beep/box": patch
---

Make `BoxApiFailureContext.values` JSON-typed (`JsonObject`) instead of `S.Unknown` so sanitized `BoxError` context round-trips deterministically across the driver boundary. `S.Unknown` allowed non-serializable values (Errors, functions, symbols) into a wire-crossing error, whose encode/decode equivalence depended on host-sensitive structural equality. SDK `contextInfo` that is not JSON now sanitizes to `None` on the error path instead of throwing.
