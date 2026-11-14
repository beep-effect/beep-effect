---
title: "Retain the regex identity adapter and move physical ownership into the lane"
date: 2026-11-14
reversal: "Replace the adapter with the protocol-v3 session in B2; restore per-job native leases only with a policy reversal."
---

regexOwner retains only the protocol-v2 start adapter and the evaluator spawner/Clock identity guard. It no longer creates a physical regex owner or claims native capacity. The lane owns the exact children. The existing per-job wrapper confirms retirement before returning a result, while its adapter has no independent lease. The lane and its physical owner are invocation-scoped; the lane unit and physical owner are lazy. The named standalone cleaner starter stays separate.
