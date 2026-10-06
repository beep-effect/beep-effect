---
"@beep/repo-cli": patch
---

`yeet publish` titles the draft pull request from the `--message` first line
whenever one is given, falling back to the branch's first non-merge commit
subject, never the head commit's subject. A re-publish that finds an open pull
request still titled with a merge-commit subject renames it the same way
(`gh pr edit --title`, REST PATCH under GraphQL rate limiting), so the
squash-merge commit no longer inherits "Merge remote-tracking branch ..." from
a merge head. `GhPrView` now decodes the optional `title` field.
