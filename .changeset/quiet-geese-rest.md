---
"@beep/repo-ai-metrics": patch
"@beep/repo-cli": patch
"@beep/test-utils": patch
---

Keep privacy-sensitive agent-effectiveness fixtures portable by sharing a
platform-aware system-temp resolver that avoids private per-user temp paths,
and keep affected Docgen aggregation strict without treating intentional
non-canonical quality-analysis outputs as missing package documentation.
