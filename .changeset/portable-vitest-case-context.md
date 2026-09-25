---
"@beep/test-runner": patch
---

Use Vitest's public task collector to instrument parameterized Effect tests without
Node AsyncLocalStorage. Preserve native case titles, per-test context, layer
provisioning, and test options in browser and server runtimes.
