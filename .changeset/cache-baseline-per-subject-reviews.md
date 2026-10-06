---
"@beep/repo-configs": minor
"@beep/repo-cli": patch
---

Make `standards/cache-qualification-baseline.json` merge per package. The baseline is now
`cache-qualification-baseline/v2`: it is pretty-printed with nodes sorted by computation, and the
single whole-file `review` became `reviews`, one deliberate review record per subject (a workspace
package, or `//` for root tasks and global settings). `beep cache baseline --request` stamps the new
review only on subjects whose posture changed (or that the request names under `subjects`) and
carries every other subject's prior review forward byte-for-byte, so two PRs that re-record
different packages no longer conflict when either merges. The read side fails closed on a baseline
whose reviews do not cover its subjects.
