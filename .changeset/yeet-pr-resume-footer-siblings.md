---
"@beep/agents-client": patch
"@beep/test-utils": patch
---

Test-only hardening carried by the Yeet provenance footer PR: the agents-client
turn reconciliation tests await atom transitions instead of racing a wall-clock
poll, and the test-utils conformance runtime validator selector is expressed
with `flow`.
