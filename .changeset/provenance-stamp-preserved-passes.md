---
"@beep/repo-cli": patch
---

Model the provenance footer stamp result as a typed outcome (`current`, `preserved`,
`skipped`, `drifted`, `yielded`) instead of an optional warning string. Preserving a
concurrent bot body edit is a success, so the `publish:pr-provenance-stamp` lane now
records it as passed with the note in its output; only the skipped, drifted, and
yielded statuses fail the lane.
