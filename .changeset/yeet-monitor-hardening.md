---
"@beep/repo-cli": patch
---

Harden the Yeet monitor loop and the reply verdict (ship-velocity A7).

`yeet reply` now exits non-zero when any drafted reply is `failed`. The batch
still runs to completion and the report is still written, but an unwritten
reply leaves its review thread open — a hard merge gate — so a
`yeet reply && yeet monitor` chain no longer walks past it on a false green.
`stale` outcomes wrote nothing because there was nothing to write and are not
failures.

Monitor comment cursors persist across runs in a schema-versioned
`monitor-comments.json` beside the other branch-scoped Yeet artifacts. A
session resumes from the saved position instead of its own clock, so a comment
posted while no monitor was attached is printed by the next run rather than
falling into the gap between two processes. Anything unusable — no artifact, a
different pull request, an older schema version, a torn file — reads as "start
from now".

A failing comment poll can no longer cancel the check watcher it is raced
against: the poller's error channel is `never` by construction. Each failed
poll is reported with gh's own words and numbered against a bound, and a
stream that exhausts the bound parks instead of completing, because completing
the race is what would take the checks down.

Post-push check watching distinguishes "no checks registered yet" from
"terminal empty". `gh pr checks --watch` reports a head GitHub has not wired
up yet as exit 1 with `no checks reported`, seconds after the push that
created it; that answer is now re-attempted on a bounded backoff (six
attempts, ~95s). An exhausted backoff is still a failure naming the condition,
never a pass.
