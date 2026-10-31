# Historical scope revalidation — 2026-10-31

PR #1930 remains merged at `60b2c052fb72cf19403a43c79ea3a3c9b0b68a89`.
This merge is an ancestor of reviewed main
`8f619d205ca73a80135a3aa3ba7143365901a979`. The earlier source and successful
readiness-job evidence remains in `2026-10-28-cloud-refresh.md`.

All eight original namespaced Cloud IDs in `ops/triage.json` were opened
individually in the signed-in UI. Every status remains Fixed with its
October 21 update time; no historical status was mutated.

The paginated GitHub REST inventory returned 459 alert records. Exact-ID
reconciliation finds 121 of the 123 captured alerts Fixed. Alerts #426 and
#431 each return HTTP 410 with the explicit message that the alert number
has been withdrawn. They are withdrawn, not fixed or dismissed. No captured
alert remains open. This supersedes the October 28 count of 122 Fixed and
one withdrawn; the difference is the later withdrawal of #426.

The seven supplemental Cloud IDs were closed after #2333 merge and current-main
verification. The all-repository open Cloud view now shows zero. Twenty newer
GitHub dependency alerts are separately captured in the October 28 packet.
The expanded goal remains active until those updates merge and all exact
external statuses are verified, then both retained packets can close.
