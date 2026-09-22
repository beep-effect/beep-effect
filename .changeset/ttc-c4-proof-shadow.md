---
{}
---

No release: proof-ledger shadow mode and `yeet proof-report` (time-to-certainty C4.1).

The Yeet verdict writer now shadows every inner lane that ran against the checkout proof ledger:
it derives the tier-independent reuse key, records what the ledger would have decided next to the
observed outcome, then records the lane's own fact. `bun run beep yeet proof-report [--json]`
prints the sample size, would-have-reused lanes, misses by reason, disagreements, and the
ruling-7 enforcement bar verdict. The reuse key's lane id widens to the wave-qualified lane id and
shadow rows carry lane, branch, stage, env profile and duration.
