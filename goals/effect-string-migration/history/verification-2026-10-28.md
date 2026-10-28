# Closeout verification — 2026-10-28

## Source and scope

The closeout starts from `d3c684edea26987cea6384b296d86960b0bb5d1a`.
Its edits are confined to this packet. No workspace source, compiler pin,
severity, generated compiler profile, or suppression inventory is changed.

## Completed checks

- `bun run beep quality tsgo-rules`: 130 installed rules configured; five
  declared off; 28 documented plugin options explicit.
- The original accepted head's root map and standalone profile together
  declared off exactly the current five rules: `apiStabilityLeak`,
  `experimentalApiUsage`, `preferBarrelImport`, `preferNamespaceImport`, and
  `unstableApiUsage`. The old root alone had only the three stability rules;
  comparing it without the standalone profile would give a false mismatch.
- `bun run beep lint reflection-artifacts`: zero blocking and advisory findings.
- Packet launcher size, manifest JSON, and whitespace checks passed.
- The canonical local full proof completed all 25 cheap-gates lanes with zero
  failed or skipped lanes. This includes both documentation ratchets, schema
  catalog, schema-first, Effect imports, effect-vitest, Fallow, goal doctor,
  configuration synchronization, and root lint.

## Constrained local proof

The full proof spent more than twenty minutes in preflight before reaching the
compiler census. Under AGENTS.md's ten-minute constrained-compute rule, the
agent stopped that proof, confirmed its service was inactive with no main PID,
and moved publication to the hosted path. Its full-proof result is **not a
pass**. The completed cheap-gates results remain evidence only for those gates.

A separate, admitted `bun run beep ci lane check --summarize` without affected
filtering must provide the full compiler-graph census. Hosted readiness and a
verified completion receipt for the new final PR remain required. This document
will record those results once they exist.

## Historical evidence retained

PR #2027's accepted head is `5249b167984da46755522915418cc2a34cd7c3aa`;
its merge commit is `74d3625ad0fe1a61cd2f3d003fc13191b7ba4d00`.
The hosted diagnostics job checked 375 projects and 90,238 file visits with
zero String findings and seven Array findings. Completion refresh returned
`unsatisfied` because required checks were pending at merge and GitHub's
merge-push rule suite recorded a required-status bypass. The original local
Yeet verdict is unavailable. A new closeout does not change those facts.
