---
"@beep/repo-cli": minor
---

Add the fork-repair plan surface to the packet control-plane core:
`PacketForkRepairPlan` plus the pure `planForkRepair` derivation — a
deterministic, read-only plan for a stream's first fork (survivor by
seq-then-digest order, losing bodies rebased onto the surviving tip with
recorded history preserved, losing files listed for removal), surfaced as an
advisory summary on `beep explore --check` fork findings.
