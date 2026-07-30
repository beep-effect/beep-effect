---
"@beep/mcp-kit": patch
"@beep/api-transport": patch
---

Add the settlement hook to the tier gate and the reason-free egress denial vocabulary.

`TierGateShape` gains `recordOutcome(request, settlement)`: `dispatchWithTierGate` now
reports an approved dispatch's settlement to the gate in the same call frame via
`Effect.onExit`, as a bounded `TierGateSettlement` literal (`completed` / `failed` /
`interrupted`) rather than an `Exit` — so no failure payload can reach a gate
implementation by construction. A refused dispatch reports no settlement (the wrapped
effect never ran), `recordOutcome` is total, and the wrapper's error channel remains
exactly the wrapped effect's. `fromApprovedToolsPolicy` keeps no settlement record; its
`recordOutcome` is a no-op, and a ledger-backed gate implements it for real.

`@beep/api-transport` gains `EgressDenied`, a deliberately field-free tagged error: a
governed egress boundary that refuses a destination tells the caller only THAT it refused —
the bounded denial reason stays with the refusing policy, never the agent-facing channel.

This is PR 4 of goals/agent-execution-authority. Reversible; no behavior change for
existing gates beyond the no-op settlement report.
