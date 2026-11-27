---
title: The Box generator keeps optional AST fields and its traversal state outside Option and schemas
date: 2026-11-26
reversal: Turn the optional GeneratedDeclaration fields into Option and GenerationState into a schema class in scripts/generate.ts.
governs:
  - scripts/generate.ts#GeneratedDeclaration
  - scripts/generate.ts#GenerationState
enforcedBy: []
---

`GeneratedDeclaration` keeps its optional fields schema-optional (`| undefined`), and `GenerationState` stays a plain interface over effect mutable collections.
Reason: the AST walker reads the optional fields through `?? default` and `!== undefined`, so `Option` adds wrapping without enforcing an invariant. `GenerationState` is mutable state accumulated during recursion, not a decodable data model, so a schema would misrepresent it.
Rejected: crispening both, that is `Option` fields and a schema-backed `GenerationState`.
