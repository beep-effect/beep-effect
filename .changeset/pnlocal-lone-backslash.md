---
"@beep/identity": patch
---

Reject PN_LOCAL names ending in a lone backslash. The tokenizer substituted an
empty string for the missing escaped character and the string-backed escapable
set accepted it because `.includes("")` is always true; `isEscapable` now
requires a single character before probing the set.
