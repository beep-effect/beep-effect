---
"@beep/epistemic-config": patch
---

Classify unparseable destinations as external network audience, including bare
loopback names and addresses. Require successful URL parsing before assigning
the local workspace audience while preserving valid URL classifications.
