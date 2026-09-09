---
"@beep/repo-cli": patch
"@beep/utils": patch
"@beep/test-utils": patch
---

Ratchet JSDoc metadata (required tags and canonical `@category` values) in the
full docgen proof so the main-branch `Heavy / Docgen` run enforces the same
check the PR-mode `docgen:local` run applies, fix the three inherited
re-export findings that check now surfaces, and rename the remaining internal
`@category rendering` tags to `formatting`.
