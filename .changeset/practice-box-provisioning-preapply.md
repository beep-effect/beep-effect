---
"@beep/box": patch
"@beep/box-provisioning": patch
---

Harden Box provisioning before the first attended apply: explicit adoption
allowlist, Box-equivalent folder-name matching, strict entitlement-only
blocker contract, sanitized apply journal, dependency revalidation before
dependent writes, closed artifact string domains, and redacted driver error
context.
