---
"@beep/file-processing": patch
---

Crispen `@beep/file-processing` for the P2 repo-crispening wave: colocate schema-derived statics on artifact identifiers, result unions, strategy helpers, and JSON codecs; derive `FileProcessingOperationError.fromReason` input from the error schema; replace fixed-struct `R.getSomes` payload spreads with `O.getSomesStruct`; tighten `TextSpan` offsets into schema-owned non-negative/order invariants; and add `S.toArbitrary` parity laws for the absorbed invariants and file-processing JSON codecs. Public wire shapes are unchanged for valid values; cross-family public-form migrations are inventory exceptions for the family-close sweep.
