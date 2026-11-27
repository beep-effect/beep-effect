---
title: An edited value read from a string shorthand re-encodes as a string while the string can carry it
date: 2026-11-26
reversal: Encode any edited value in the canonical object form, whatever form it was read from.
governs:
  - src/Funding.ts#encodeEntry
  - src/Person.ts#Person
enforcedBy: []
---

A `Person` or `Funding` entry read from its string form and edited afterwards re-encodes as a string rebuilt from the new fields, for example `"Ann <new@x.dev>"`, not `{"name":"Ann","email":"new@x.dev"}`.
Reason: this package promises wire-shape fidelity. A manifest's field must not change representation because one value changed.
The object form is the fallback only when the string cannot carry the value: the entry gained a `type` or an unknown key. There, preserving data outranks preserving shape.
Rejected: upgrading every edited value to the object form, which rewrites a legal encoding into another.
