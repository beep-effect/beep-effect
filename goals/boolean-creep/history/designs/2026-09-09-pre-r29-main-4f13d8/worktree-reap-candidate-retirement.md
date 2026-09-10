# Instance
- id: `worktree-reap-candidate-retirement`
- exact source SHA: `3330f9881a50c96d3f2ec0fcad76f0f7a09027e4`
- corpus source SHA: `52fcc8d1353db9481ef9edb6cc9619500f95568d`
- file:line: `packages/tooling/tool/cli/src/commands/Worktree/Reap.schemas.ts:132`
- symbol/members: `WorktreeReapCandidate` / `retired`, `skipReason`
- evidence: E4/E1 `Reap.service.ts:391-507,532-584` and `Reap.schemas.ts:90-135`.

# Current shape
The wire row supports eligible(false/None), 15 skipped(false/Some(reason)), and retired(true/None). A removal whose checkout is already gone is retired even when follow-up cleanup failed, with a warning.

# Cardinality gap
Two retirement values times None plus 15 reasons represents 32 tuples; 17 are legal.

# Target schema
Define tagged `eligible | skipped({reason}) | retired`; keep all other candidate evidence beside it. Decode/encode the old flat fields.

# Migration inventory
- `Reap.schemas.ts:20-135,160-180` — reuse all 15 skip literals, define disposition, and preserve report nesting.
- `Reap.service.ts:391-483` — construct eligible/skipped without changing reason priority or size-probe advisory behavior.
- `Reap.service.ts:486-507,532-584` — preserve recheck, expected-head removal, still-present retirement-failed, and already-gone retired plus exact `retirement-cleanup-failed` warning.
- `Reap.service.ts:512-529` — count retired and sum bytes by tag.
- `Reap.command.ts:121-123` — preserve JSON output; update source tests and synthetic candidates at `test/worktree-reap.test.ts`.

# Guard-deletion accounting
Delete retired/skipReason coordination and all Option guards selecting disposition. Keep eligibility, recheck, filesystem presence, removal, and warning guards.

# Encoded-side impact
Tier 2 wire. Preserve exact booleans, optional reason literals, candidate/report keys, order, counts, byte totals, warnings, and JSON schema version.

# Test impact
Round-trip eligible, every reason, and retired; reject retired plus reason. Retain cleanup-failed-after-removal and still-present failure tests.

# Risk and sequencing
Land alone. Do not misreport an already removed checkout as retryable failure or lose its cleanup warning.
