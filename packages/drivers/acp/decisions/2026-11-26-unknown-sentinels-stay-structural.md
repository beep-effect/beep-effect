---
title: The unknown-variant sentinels are structural schemas, not branded opaque classes
date: 2026-11-26
reversal: Turn UnknownContentFields and UnknownSessionUpdateFields into S.Opaque or S.Class schemas.
governs:
  - src/AcpCompat.models.ts#UnknownContentFields
  - src/AcpCompat.models.ts#UnknownSessionUpdateFields
enforcedBy: []
---

The `_acp_unknown` sentinels sit inside open (rest) structs whose values must stay JSON-compatible.
Reason: a branded member has no implicit string index signature, so it could not be placed in a normalized update without a type assertion.
Rejected: branded opaque classes, the repository default for named schemas.
