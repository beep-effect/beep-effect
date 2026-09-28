# AI metrics assertion conservation

After the resource phase, 303 boolean and Option assertions across 25 test files
use the public `@effect/vitest/utils` helpers. Original actual values, predicate
calls, expected Some payloads and negative cases are retained. The optional
`is_interrupt` encoded field uses `strictEqual(value, false)`: narrowing or
coalescing it would hide a missing field, and `assertFalse` requires a boolean.
Existing nested pipes were flattened without changing evaluation order.

An AST conservation audit maps every original assertion through the explicit
replacement receipt and checks its occurrence count in the resulting source.
All 1,219 original assertion expressions in the touched files are retained,
including outer property checks containing migrated inner assertions. This
count includes nested expressions; it is not a count of independent test cases.
The installed public boolean helpers delegate to strict equality, and Option
helpers retain the original None or Some payload checks.

Full package verification passes audit (13.9 s) and docgen (4.7 s), and root
Oxlint passes. Initial compiler feedback found unused imports, redundant nested
pipes and the optional-boolean boundary; all were corrected and the full package
proof rerun. Property generation, explicit seed/floor contracts, native resource
boundaries, registrations and production code are unchanged in this phase.
The new harness-ledger file received the mechanical assertion conversion, but
its full human lens review remains outstanding. Package ledger reconciliation
and final Node/Bun timing remain after the later phases.
