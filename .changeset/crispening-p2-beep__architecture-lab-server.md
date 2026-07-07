---
"@beep/architecture-lab-server": patch
---

Crispen `@beep/architecture-lab-server` for the P2 repo-crispening wave: attach WorkItem HTTP status literal/decode statics without changing its numeric wire shape, route WorkItem action failures through exhaustive tag matching, annotate the response envelope fields through the package identity composer, decode unknown HTTP failure bodies through the schema in tests, and add package-local encoded-shape plus `S.toArbitrary` parity laws. Public encoded HTTP response shapes remain unchanged.
