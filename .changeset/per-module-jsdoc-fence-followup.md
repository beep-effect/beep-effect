---
"@beep/repo-cli": patch
---

Keep the JSDoc migration extraction example's nested Markdown fence intact.
The example now constructs its backticks at runtime so the surrounding JSDoc
fence parses cleanly under the repository's TSDoc lint policy.
