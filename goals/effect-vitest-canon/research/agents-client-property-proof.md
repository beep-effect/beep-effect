# Agents Client assertion and property proof

Twenty-seven live assertions now use public Effect Vitest helpers. AST
conservation checks preserve all 87 original assertion expressions and all
23 test registrations across the six test files. The encoded StreamingTurn
record and both status-dependent draft comparisons retain their exact operands.
Failure predicates retain their polarity without inventing a Cause payload.

The six schema domains now share one native `it.prop` registration with six
independent schema-derived inputs: CreateThreadAtomInput, StreamingTurn,
EditTarget, SendTurnRequest, EditTurnRequest and TurnRequest. Each still invokes
its own original codec round-trip law. The helper still accepts either
`Equal.equals` or schema equivalence. The original title, 10-run minimum and
`fcRuns` environment controls remain. Eight non-wrapper assertions in the
schema file are conserved, and the round-trip helper is unchanged.

A 400-run sweep with seed 20260708 passes both schema tests with no skips.
Independently negating each domain's law yields one failed test, a shrunk input
and that replay seed. All six temporary mutations were restored.

The selected-thread and unreconciled-reply retention tests now mount and mutate
an ordinary removable atom alongside the actual subject in the same registry.
After the original unmount and observation interval, the control must have reset
to its default while the subject retains its original value. The original
40 ms TTL / 200 ms selected-thread interval and 1 ms TTL / 20 ms unreconciled
interval remain. Neither test force-disposes the subject or reads registry
internals. Temporarily keeping each control alive fails its eviction assertion;
both mutations were restored.

Full package verification passes audit (10.6 s) and docgen (6.3 s). The earlier
schema-only package proof also passed audit (10.1 s) and docgen (6.2 s). These
are package proofs, not a claim of full repository or PR readiness. The saved
flake findings, runner review, final timings and inventory reconciliation for
Agents Client remain pending.
