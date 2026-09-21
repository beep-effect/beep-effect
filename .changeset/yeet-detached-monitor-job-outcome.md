---
"@beep/repo-cli": patch
---

A detached `yeet monitor --until-ready`, `--until-merged`, or `--watch` job now records its
own start and outcome, so `yeet job wait` exits 0 when the loop ends green and 1 when it ends
red. Before, those loops wrote no run verdict and the finalizer read a clean exit as
`terminated` (exit 2). A stopped job still reads `terminated`.
