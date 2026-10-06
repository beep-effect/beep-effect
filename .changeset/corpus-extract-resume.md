---
"@beep/repo-cli": patch
---

`beep corpus extract` now resumes: a run against an existing output tree reuses every source whose atomically written `outcomes/<sha256>.json` marker and artifacts are complete, redoes the rest (including failed and half-written sources), and reports `alreadyComplete`, `extracted`, and `failed` counts. `--overwrite` forces a full redo.
