---
"@beep/test-utils": patch
---

Give the real-clock watchdog regression enough time to report its diagnostic before
Vitest aborts the fixture. Keep production timeout policy and controlled-clock edge
cases unchanged.
