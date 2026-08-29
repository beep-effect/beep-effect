---
"@beep/repo-cli": patch
---

Redact non-ASCII absolute paths whole in knowledge probe diagnostics. The POSIX path pattern's
segments were ASCII-only, so a path like `/home/üser/prójects/tökens.ts:3:7` in probe stderr was
redacted only up to `/home`, leaking the non-ASCII tail with its line and column. Segments now admit
Unicode letters, marks, and digits. The hostile-profile archive differential also gains the retired
ASLR control's real half: the scratch checkout sits under a deep, spaced, non-ASCII path and
archives land in a spaced output directory, so location-depth and quoting are exercised in the live
spawn path (ratified in `goals/knowledge-surface-automation/research/p3-hermetic-lane-decisions.md`).
