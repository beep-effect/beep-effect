---
"@beep/repo-ai-metrics": patch
---

Export the shared transcript path helpers through the package barrel so the
Yeet PR provenance footer reuses the canonical `repoPathToClaudeProjectName`
converter instead of maintaining a diverging copy.
