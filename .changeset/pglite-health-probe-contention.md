---
"@beep/test-utils": patch
---

Keep single-query PGLite integration tests reliable by removing periodic health-probe contention and allowing scoped
client sockets to overlap during asynchronous connection handoff.
