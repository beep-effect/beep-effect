---
"@beep/infra": patch
---

Disable the EC2 metadata endpoint after runner bootstrap and before job
admission. Add a self-only, disable-only role policy, a fail-closed runner shim,
guest poweroff teardown, and privileged-path red-team gates.
