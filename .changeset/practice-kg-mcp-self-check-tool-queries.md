---
"@beep/practice-kg-mcp": patch
---

Make `--self-check` read the columns the tools read in each store, so a bundle
whose manifest claims the current store format over older tables is refused.
Reject an empty `--bundle-version` at CLI parsing, before `--overwrite` can
remove an existing bundle.
