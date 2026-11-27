---
title: Field codecs that remember their wire value build the instance in a transformEffect over a plain fields Struct
date: 2026-11-26
reversal: Decode the object form straight into the class with S.decodeTo(Class) and drop the per-instance wire memory.
governs:
  - src/Funding.ts#FundingFields
  - src/Funding.ts#Funding
  - src/Person.ts#PersonFields
  - src/Person.ts#Person
  - src/Repository.ts#RepositoryFields
  - src/Repository.ts#Repository
  - src/Repository.ts#Bugs
enforcedBy: []
---

`Funding.FromValue`, `Person.schema`, `Repository.FromValue` and `Bugs.FromValue` construct the instance themselves inside `SchemaTransformation.transformEffect`, after validating the documented keys through a plain `S.Struct` (`FundingFields`, `PersonFields`, `RepositoryFields`, `BugsFields`).
Reason: constructing the instance in the transform is the only way to attach the raw wire value to it. Validating through the Struct first keeps the issue tree identical to a direct class decode, so a missing or non-string `url` (or a malformed `type`, `directory` or `email`) fails as a schema issue, not as a defect from `make` or a silent drop.
A value the model cannot hold must not decode to one it can; `LenientManifest` is the tier that keeps such a field verbatim.
Rejected: a plain `transform` into the class, which cannot remember the wire value; constructing without the Struct, which turns bad input into a thrown defect.
