---
"@beep/semantic-web": patch
---

Crispen `@beep/semantic-web` in the P2 repo-crispening wave: absorb optional
control-field constructor defaults into schemas, tighten bounded numeric
controls to existing integer domains, extract named annotated service error
reason schemas, collapse a private `A.take` passthrough helper, and add
encoded-shape parity plus `S.toArbitrary` round-trip coverage. Encoded optional
wire keys remain absent when omitted.
