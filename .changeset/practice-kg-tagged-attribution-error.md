---
"@beep/law-practice-server": patch
---

Raise the graph-build lost-attribution invariant as a `PracticeKgProjectionError` instead of a native `Error`, so the native-runtime law passes.
