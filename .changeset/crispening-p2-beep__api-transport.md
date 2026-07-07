---
"@beep/api-transport": patch
---

Crispen `@beep/api-transport` (P2 repo-crispening-orchestration): colocate rate-limit header parsing on `RateLimitSnapshot`, return `Option` from the private numeric parser, add field-level schema annotations, eta-reduce the rate-limiter defect handler, and add package-local wire-shape plus `S.toArbitrary` parity laws. Public data wire shape remains unchanged.
