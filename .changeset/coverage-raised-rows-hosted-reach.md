---
"@beep/repo-cli": patch
---

Judge pull-request coverage runs against the baseline rows they raised, so a
row a local regeneration lifted beyond what the hosted lane measures fails on
the pull request with `row raised beyond hosted reach` instead of turning main
red after the merge. Lowered and unchanged rows stay judged by the base floors.
