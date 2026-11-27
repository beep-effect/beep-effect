---
title: A remembered wire value is replayed only while it still describes the decoded value
date: 2026-11-26
reversal: Replay the remembered wire value whenever one exists, without comparing it to the current fields.
governs:
  - src/Funding.ts#isFaithfulObject
  - src/Person.ts#isShorthandExpressible
  - src/Person.ts#isFaithful
  - src/Repository.ts#isStringExpressibleRepository
  - src/Repository.ts#Repository
enforcedBy: []
---

`Person`, `Repository`, `Bugs` and `Funding` replay their remembered wire value on encode only while it still matches the fields; otherwise they re-encode from the fields.
Reason: `Schema.Class` instances are not frozen. An instance edited in place keeps its provenance, and an unguarded replay writes the original bytes back and silently drops the edit. Upstream guarded `Person` only; `Repository` and `Bugs` replayed unguarded.
A string shorthand has no syntax for `type`, `directory`, `email` or an unknown key, so the string branch also requires that the value gained none (`isShorthandExpressible`, `isStringExpressible*`). `directory` is the live case: `Repository.directoryUrl` invites a caller to add one to a bare-string repository.
`Person` uses one predicate for both the replay guard and the shorthand re-encode fallback. Two predicates could refuse the replay yet still hand back shorthand, dropping the keys the refusal found.
Rest records compare through `sameRest`, by JSON spelling. An object-form `Person` encodes back through `Person.schema`, which applies its own guard.
Rejected: unguarded replay, the upstream behaviour for `Repository` and `Bugs`.
