---
"@beep/repo-cli": patch
---

`beep delete-package` now subtracts the deleted workspace's rows from the committed coverage
baseline schema-first instead of re-running repo-wide coverage (receipt 9); the dependents scan
classifies packet `history/**` and `research/**` references as historical records rather than live
packet claims and the residue probes exclude machine-local `.beep/` state (receipt 11); and
`beep lint reflection-artifacts` validates reflection frontmatter in every packet, not only
completed ones (receipt 10).
