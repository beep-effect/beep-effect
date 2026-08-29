---
"@beep/repo-cli": minor
---

`yeet monitor --watch` now dispatches remediation for every observed red: a failure capsule
derived from the failing check's own record (lane, job link, workflow, raw bucket/state) is
appended to `<checkout>/.beep/inbox/failures.ndjson` (`yeet-inbox/v1`, the row shape the A2 hook
adapters will consume), and a persisted wave record (`.beep/inbox/dispatch.json`,
`yeet-dispatch/v1`) counts one repair session per head — the first red starts it, later reds
queue with headSha+lane dedup, a re-run red is dropped as a duplicate, and a new push supersedes
the wave before the new baseline's reds are seeded. The watch also now polls through gh's
post-push "no checks reported" registration gap for a bounded number of ticks instead of ending
green while a push's checks are still registering, and wave freshness is keyed on
(prNumber, headSha) so a stale record from a dead PR on the same branch tip cannot swallow a new
PR's session start.
