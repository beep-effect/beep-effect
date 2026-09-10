---
"@beep/test-utils": patch
---

Add an Effect Vitest runner that records test lifecycle traces and enforces a
live-clock watchdog through the public Effect Vitest API. Keep controlled-clock
test access source-only and verify runtime behavior under Node and Bun.
