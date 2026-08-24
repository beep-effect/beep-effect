---
"@beep/md": patch
"@beep/shared-domain": patch
"@beep/workspace-domain": patch
"@beep/workspace-tables": patch
"@beep/workspace-server": patch
"@beep/workspace-use-cases": patch
---

Attach the canonical and Effect codec static groups to every entity id built
by `EntityId.factory`, colocate `encodeSync` statics on the Md Document class
and the workspace Thread, Turn and Message entities, delete the encode helper
walls and dead id re-validation in the thread store and table converters, and
use Effect predicate combinators in the thread timeline projection.
