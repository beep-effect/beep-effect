# Schema predicate assertion migration

Migrated 339 Exit, Result and Option predicate assertions in 49 test files to
`@effect/vitest/utils` assertTrue/assertFalse using pipe form. All original
operands, predicates and expected booleans are preserved. Plain-value assertions
and structural wrapper/payload comparisons are unchanged by this pass.

A TypeScript AST comparison against the branch head checked the normalized
operand, predicate and expected boolean for every replacement: 339 of 339 match.
The first audit exposed introduced missedPipeableOpportunity diagnostics from
nested helper calls; pipe form repaired them without changing assertions.

Validation after repair:

- Full `bun run beep quality package-verify @beep/schema`: audit and docgen passed.
- Full schema Vitest run under Node: 717 tests, 78 files passed.
- Full schema Vitest run under Bun: 717 tests, 78 files passed.
- `git diff --check`: passed.
- No unacknowledged checkout inbox entries remain.

This is local Wave C preparation. No hosted proof, coverage result, timing
comparison, completed wave or canonical finding disposition is claimed.
Structural payload assertions, property migrations and runner adoption remain.

## Structural wrapper and payload follow-up

Replaced 35 Option/Result structural comparisons across ten files with pinned
assertSome/assertNone/assertSuccess helpers, preserving existing expected values.
Branded HTTP status expectations use the helper's number type parameter; the
reflective codec-static result is checked as an Option before payload comparison.
Removed imports made unused by these replacements.

Strengthened all twelve inventoried encoder wrapper checks to compare the known
encoded payload (`"42"` or `{ value: "ok" }`). Existing duplicate Result value
checks remain. All four status/cause constructor forms now retain the supplied
Error, assert the expected message, and check exact cause identity in addition to
the prior instance, schema-guard and status checks.

Final proof for this follow-up: package audit/docgen passed; all 717 tests in 78
files passed under both Node and Bun. The earlier 339-assertion parity receipt
proves the initial mechanical pass only; twelve encoder predicates and four
cause predicates were intentionally strengthened afterward.
