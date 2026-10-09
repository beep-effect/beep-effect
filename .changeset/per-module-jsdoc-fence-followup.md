---
"@beep/repo-cli": patch
"@beep/oip-web": patch
---

Keep the JSDoc migration extraction example's nested Markdown fence intact.
The example now constructs its backticks at runtime so the surrounding JSDoc
fence parses cleanly under the repository's TSDoc lint policy.
Cover the OIP home metadata path so the coverage floor remains enforced.
Cover root re-export cases that require manual review in the import-law runner.
