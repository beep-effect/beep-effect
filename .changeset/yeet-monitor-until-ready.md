---
"@beep/repo-cli": minor
---

Add `yeet monitor --until-ready`: settle on the base ruleset's expected required
contexts (tolerating matrix parents) bounded by `--settle-timeout`, run the
read-first closeout automatically when the census settles, exit 0 on the first
merge-ready poll, and append one P1 `pr-merge-ready` inbox row per head. Plain
`yeet monitor` and `--watch` now decide their exit code and `--until-event`
trigger from required checks only.
