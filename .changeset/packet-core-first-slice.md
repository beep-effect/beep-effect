---
"@beep/repo-cli": minor
---

Packet control-plane core first vertical slice: versioned per-event CAS
streams under `goals/<slug>/ops/events/` (`packet-event/v1` with parent
digests and expected revisions), a deterministic fold deriving
`furthestStage`/`resumeStage`/tip with first-class fork verdicts, a guarded
`beep goals set-status --preview`/write path that appends events and
regenerates the derived `ops/trace.json` projection, and a read-only
`beep explore --check` reporting forks, integrity issues, and stale traces
through the goals-doctor finding shape (advisory).
