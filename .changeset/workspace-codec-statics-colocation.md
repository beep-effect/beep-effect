---
"@beep/md": patch
"@beep/shared-domain": patch
"@beep/workspace-server": patch
"@beep/workspace-use-cases": patch
---

Attach the sync and Effect codec static groups to every entity id built by
`EntityId.factory`, colocate an `encodeSync` static on the Md Document class,
delete the encode helper wall and dead id re-validation in the thread store,
and use Effect predicate combinators in the thread timeline projection.
