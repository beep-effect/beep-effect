---
"@beep/html": patch
"@beep/md": patch
---

Repair the inherited hosted quality regressions that blocked the shard PR: the `Md.safe`
example imports `NonNegativeInt` from the exported `@beep/schema/Number` subpath, and the
html conformance suite covers the parser's malformed-color error path.
