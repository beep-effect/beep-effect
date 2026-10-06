---
"@beep/practice-kg-mcp": patch
---

Make `--self-check` read each store through a query the tools run, so a bundle
whose manifest claims the current store format over older tables is refused.
Reject an empty `--bundle-version` at CLI parsing, before `--overwrite` can
remove an existing bundle.
