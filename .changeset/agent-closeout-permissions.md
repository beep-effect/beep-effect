---
"@beep/ai-sync": patch
---

Grant agents the five Bash permissions the post-merge closeout needs without an
operator: the two timer installers (`beep research install-timers`,
`beep graft deep install-timer`) and the read-only `systemctl --user
list-timers`, `systemctl --user status beep-…`, and `journalctl --user -u
beep-…` queries that verify them; the status and journal grants are scoped to
the `beep-` unit namespace so no other unit's logs become readable. The exact
allow domain grows from 57 to 62 values; the deny domain is unchanged.
