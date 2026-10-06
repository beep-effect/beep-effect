---
"@beep/html": patch
---

Remove an unreachable empty-entry guard in source-size list parsing. The parser
continues to reject malformed lists while restoring complete branch coverage.
