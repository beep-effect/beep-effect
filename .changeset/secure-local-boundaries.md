---
"@beep/documents-server": patch
"@beep/file-processing": patch
"@beep/schema": patch
---

Harden local file materialization and protobuf 64-bit integer decoding.

Document intake now writes through a containment-checked, unpredictable,
exclusive temporary file before atomic promotion. Protobuf 64-bit decimal
inputs are rejected before `BigInt` conversion when they exceed the valid
encoded length or a Long-like object returns a non-string representation.
