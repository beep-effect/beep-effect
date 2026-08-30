---
"@beep/repo-ai-metrics": patch
"@beep/test-utils": patch
---

Keep privacy-sensitive agent-effectiveness fixtures independent of a managed
home-based `TMPDIR` while preserving production private-path rejection. Share
a platform-aware system-temp resolver so the fixtures remain portable to
Windows without falling back to a private per-user temp directory.
