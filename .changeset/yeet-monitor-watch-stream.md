---
"@beep/repo-cli": minor
---

Add `yeet monitor --watch`: a typed transition stream for the current branch's pull request.
Each poll collects one snapshot (head, PR state, mergeability, classified check outcomes, review
thread resolution) and a pure differ emits one `yeet-watch/v1` NDJSON row per state transition —
check moved, thread opened or resolved, mergeability changed, head superseded — ending with a
`watch-ended` row whose failure census drives the exit code. Raw GitHub bucket and state
vocabulary is totalized into a closed outcome domain at the boundary, and transition detection
keys on typed snapshot diffs, never log-line matching. First half of ship-velocity A1; failure
capsules and remediation dispatch build on this stream.
