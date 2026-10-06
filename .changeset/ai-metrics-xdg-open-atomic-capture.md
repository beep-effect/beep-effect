---
"@beep/repo-ai-metrics": patch
---

Make the notifier tests' fake `xdg-open` write its capture atomically, so a
loaded runner can no longer read the file empty.
