# Contradiction seed source-conflict error witness

The source-conflict case now requires a failed Result and the
`ContradictionQaSeedError` family before checking the exact `source-conflict`
reason. Direct public `assertTrue` calls narrow both values; the reason assertion
can no longer disappear behind a false guard. The original user-owned source
contents and zero candidate/evidence row assertions remain unchanged.

A mutation control ran the actual seeding operation and mapped its error to an
unrelated Error. The original test passed, proving that it accepted an unrelated
failure. The strengthened test failed at the error-family assertion. The mutation
was removed before normal execution and package verification. No run-count, seed,
timeout, fixture, or production behavior changed.

The final Desktop package audit and docgen passed. All four real seed integration
cases passed under Bun; the final source is also checked under Node. Three
existing EV002 layer-provider findings were reanchored in their original order
after the body changed; their evidence and open status were retained.

The polarity predicate is stored before assertion because the repository's
`missedPipeableOpportunity` rule rejects nesting `Result.isFailure` inside the
assertion, while piping into the assertion loses the narrowing needed below.
The local immutable boolean preserves narrowing without changing failure semantics.
