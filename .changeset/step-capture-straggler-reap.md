---
"@beep/repo-cli": patch
---

Bound every captured step's stream lifetime to its child process. `runCaptured`/`runCapturedStreams`
completed only at pipe EOF, and EOF requires every inherited write-end closed — so a step child that
exited successfully while a straggler grandchild (bunx resident wrapper, eslint worker) still held
the pipe wedged the whole lane: the fold never ended, the lane never reached its own success exit,
and the hosted job sat silent until timeout (Lint Policy jobs 94646234791 and 95354812245 — all
policy steps green, then 29-40 minutes of nothing, six orphaned bun processes reaped only by job
cleanup). The spawner group-reaps only on interrupt or nonzero exit, and spawns are detached session
leaders outside the CI wrapper's `setsid` group, so nothing else could reach the stragglers. After
the child exits, the capture now gives inherited-pipe stragglers a short drain grace, then reaps the
child's own process group so the kernel closes surviving write-ends and the capture completes with
its text intact; a descendant that escaped the group too becomes a loud defect naming the command
instead of a silent hang. The normal path pays nothing — the deadline is interrupted the moment the
stream ends.
