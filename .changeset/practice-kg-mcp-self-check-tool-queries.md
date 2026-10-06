---
"@beep/practice-kg-mcp": patch
---

Make `--self-check` read the columns the tools read in each store, so a bundle
whose manifest claims the current store format over older tables is refused.
A store that will not open (held by another process, unreadable or corrupt) is
reported as such, not as a bundle to replace, and a store refusal carries the
underlying error text in a `cause` field.
Reject an empty `--bundle-version` at CLI parsing, before `--overwrite` can
remove an existing bundle.
