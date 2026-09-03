---
"@beep/repo-cli": patch
---

Make the `lint:effect-imports-markdown` policy lane advisory (report-only)
instead of blocking. #971 added the standalone-markdown per-module import pass
with `--check` even though its own comment keeps it advisory until the final
per-module import flip, so `lint policy --full` hard-failed on pre-existing repo
docs and left `main` (and every inheriting PR) red. Dropping `--check` restores
the intended report-only behavior; the check is re-added at the final flip.
