---
"@beep/repo-cli": patch
---

Unset unrelated unresolved `op://` references on direct Turbo spawns so a
checkout's `.env` drift cannot split the shared workstation cache.
