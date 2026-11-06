---
title: "Bound retained reports even when dependency diagnostics refuse"
date: 2026-11-06
lane: "codex/cache-diagnostic-refusal"
reversal: "Remove the publication selector only after another gate enforces the same combined four-MiB cap; preserve all earlier failure evidence."
---

Source inspection already permits a report up to four MiB. A later refusal adds bytes, so unconditional retention can exceed the existing aggregate cap at the boundary. Run one metadata-only publication selector after diagnostics, including failure, using the same ARTIFACT_LIMIT. Retain both reports only when they fit together; otherwise retain only the individually safe report selected by policy and fail the complete-pair gate. Reject missing, symlink and special-file candidates without reading payloads, mutating reports, or repeating archive passes. Author exact-boundary, overflow, missing/special-file and fixed-output CLI controls for hosted CI. No local quality suite or source-generator entrypoint is run. No profile, signing, credential, capacity or whole-goal acceptance change.
