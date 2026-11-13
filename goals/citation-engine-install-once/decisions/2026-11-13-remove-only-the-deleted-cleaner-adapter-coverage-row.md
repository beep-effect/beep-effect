---
title: "Remove only the deleted cleaner adapter coverage row"
date: 2026-11-13
reversal: "Restore CleanerOperation.ts and its coverage baseline row"
---

Remove the orphan CleanerOperation.ts file row by hand. The baseline writer exists as coverage:baseline:write, but it consumes complete measured package snapshots and has no file-row deletion command. Regenerating law-practice-server would run its whole suite, which the task explicitly forbids locally. Keep every other coverage floor unchanged and leave frozen proof references under goals/citation-extraction-engine and the eyecite fixture untouched.
