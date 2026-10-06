---
"@beep/repo-cli": minor
---

`yeet ready` now flips a draft at content-final: it refuses only on a closed
pull request, a required check that is already failing (`no-required-red`), or
an unanswered review thread, so pending hosted checks and optional `Heavy / *`
lanes no longer hold the flip. Merge readiness gains the hard criterion
`review-window-elapsed`: `merge-ready: yes` waits 20 minutes after the later of
the latest ready-for-review event and the latest push to the head, read over
REST once every other criterion holds, with `Clock` time and
`BEEP_YEET_REVIEW_WINDOW` as the override. A failed read reports
`review window unknown` and blocks. Status and monitor print
`review window open: N min left`, and `ready-pending-flip` tells the owner to
flip.
