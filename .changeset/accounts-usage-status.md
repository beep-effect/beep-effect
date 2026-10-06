---
"@beep/repo-cli": minor
---

Add `beep accounts status [--json]`: poll the plan limits of every Claude,
Codex, Muse Code, and Grok Build account the local proxy holds a login for, and
rank them by how urgently the weekly quota needs use (weekly percent left per
hour until reset). Rows also carry credit balances (Claude cloud session
credits, ChatGPT credits) and unused ChatGPT limit resets. The poller only
reads the proxy's stored logins; it never refreshes or writes one. Usage that
a local collector writes as an `accounts-snapshot/v1` file is shown as a row
with its age.
