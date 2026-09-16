---
"@beep/repo-cli": patch
---

Coverage ratchet: a pull request may lower a floor on a package it could not
have moved, and a scoped baseline write holds every measured package the change
set never touched.

A base-pinned run now judges a row the branch lowered relative to the merge base
at the lowered value, but only when the package owns no changed file, is not a
dependent of one, and no global coverage input changed. Every other lowered row
keeps the base floor and names the witness that withheld it. Scoped and unscoped
`--write-baseline` runs share one plan, `--replace-all` becomes the scoped
re-measure path, and the shards, the writer, and the narrow ratchet invocation
share one Vitest worker topology.
