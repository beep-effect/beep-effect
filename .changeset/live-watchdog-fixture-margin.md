---
"@beep/test-utils": patch
---

Give the real-clock watchdog regression enough time to report its diagnostic before
Vitest aborts the fixture. Isolate the controlled tiny-budget fixture from runner
scheduling delays while preserving its exact watchdog diagnostic and cleanup.
Production timeout policy is unchanged.
