---
"@beep/ontology-client": patch
---

Requeue the in-flight graph projection after a worker failure so the
visualizer recovers without user interaction, with a single-retry guard
against failure storms.
