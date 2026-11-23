---
title: Integrity base64 is hand-rolled, not effect/encoding/Base64
date: 2026-11-22
reversal: Replace decodeBase64 and encodeBase64 with effect/encoding/Base64 and accept that distinct integrity strings can decode to one digest.
governs:
  - src/IntegrityHash.ts#decodeBase64
  - src/IntegrityHash.ts#encodeBase64
enforcedBy: []
---

The SRI-to-corepack bridge decodes base64 with its own canonical codec.

Core `Base64.decode` accepts several spellings of one digest (non-zero trailing
bits, embedded CRLF), so two integrity strings that differ as text decode to the
same bytes: the ambiguity an integrity check exists to deny. Core also rejects
the unpadded form this codec accepts. Neither direction is a drop-in.

Rejected: `effect/encoding/Base64`, which the package uses elsewhere
(`PackageTarball`, `RegistryCredential`) where spelling ambiguity is harmless.
