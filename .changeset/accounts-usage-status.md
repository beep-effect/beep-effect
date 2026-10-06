---
"@beep/repo-cli": minor
---

Add `beep accounts status [--json]`: poll the plan limits of every Claude and
Codex account the local proxy holds a login for, and rank them by how urgently
the weekly quota needs use (weekly percent left per hour until reset). The
poller only reads the proxy's stored logins; it never refreshes or writes one.
