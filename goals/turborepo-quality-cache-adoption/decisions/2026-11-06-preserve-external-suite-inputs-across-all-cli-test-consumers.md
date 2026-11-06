---
title: "Preserve external suite inputs across all CLI test consumers"
date: 2026-11-06
reversal: "Restore the prior property-test and coverage input arrays while retaining the diagnostic Python inputs, metadata receipt and unchanged coverage cache false policy."
---

All three CLI test consumers execute the architecture proof suite, which reads
the live external proof trees. Property tests lacked these inputs; coverage
also lacked the two economics reports consumed by its gate-order suite. Extend
the already reviewed input set consistently across all three tasks, retaining
package inheritance and generated-output exclusions. Native Turbo metadata
confirms seven actual external files are selected for each task, and coverage
still inherits cache false. This repairs invalidation and affected selection;
it grants no computation qualification or production trust. Hosted CI remains
authoritative, with no local task bodies or quality suites executed.
