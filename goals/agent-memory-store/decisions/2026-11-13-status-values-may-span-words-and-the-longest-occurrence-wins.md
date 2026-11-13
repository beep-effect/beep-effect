---
title: "Status values may span words, and an occurrence inside a longer value's is not read"
date: 2026-11-13
lane: "agent-memory-store-p2"
reversal: "Refuse lifecycles whose values are not whole tokens or overlap, by a StatusLifecycle check, and drop the longest-occurrence rule"
---

StatusValue is any nonempty string, so a manifest lifecycle can hold values such as in review or not started. Two gaps followed. A swap to a multi-word value did not read as a status move (the new token had to be one whole token), so op capture submitted it as a replace and the text path landed a backward move the lifecycle guard would have refused. And when one value is a whole-token part of another (started inside not started), the text held two occurrences, read as no single value, and every setStatus on the node was refused with statusOutsideLifecycle. statusMoveBetween now also accepts a new token that is a value of the lifecycle, so the move meets the guard; statusValueIn and the move reading drop an occurrence whose span lies inside a longer value's occurrence, so | P2 | not started | holds not started. Amends typed-status-fields-are-whole-token-values and op-capture-types-a-status-token-swap. Code: packages/tooling/library/agent-memory-store/src/StatusField.models.ts; tests: test/StatusField.test.ts, test/OperationCapture.status.test.ts and the multi-word status case of test/Admission.layer.test.ts. Rejected: refusing such lifecycles (the manifest owns the values, and StatusValue admits any nonempty string).
