---
"@beep/repo-cli": patch
---

Tag the catalog diff of a `beep models check` run with its scope.

`ModelsCheckReport` now carries `diffScope`, a `full` / `suppressed-offline`
literal domain that decodes to `full` when absent. An offline run suppresses
the catalog diff — the availability overlays report different effort ladders
than upstream, so a projected diff would be a wall of phantom `levelsChanged` —
and an empty diff was previously indistinguishable from "the catalog did not
move". The check report now prints a `catalog diff:` line that reads
`suppressed (offline run)` for an offline run and the added / removed /
effort-ladder counts otherwise.
