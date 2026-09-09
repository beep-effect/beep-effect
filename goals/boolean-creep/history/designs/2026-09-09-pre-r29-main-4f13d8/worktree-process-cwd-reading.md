# Instance
- id: `worktree-process-cwd-reading`
- exact source SHA: `7440cb8c4302ce64b87860069a464bafbf65f576`
- corpus source SHA: `9b7553f618b2b3ee10e11a3d6ee93606f3e40ce1`
- file:line: `packages/tooling/tool/cli/src/commands/Worktree/Fleet.service.ts:590`
- symbol/members: `ProcessCwdReading` / `unreadable`, `cwd`
- evidence: E1 `Fleet.service.ts:587-604` explicitly separates vanished NotFound from unreadable failures and successful cwd.

# Current shape
An internal procfs reading uses a boolean plus Option to represent vanished, unreadable, or read cwd.

# Cardinality gap
Four combinations are representable and three legal: vanished(false/None), unreadable(true/None), read(false/Some).

# Target schema
Define private tagged `ProcessCwdReading = vanished | unreadable | read({cwd})` and match it when attributing process counts.

# Migration inventory
- `Fleet.service.ts:587-636` — replace the record and preserve PlatformError NotFound classification.
- `Fleet.service.ts:622-643,680-704` — keep proc and session scans, longest-path attribution, and counts.
- Fleet tests for vanished PIDs, permissions/read failures, readable cwd, and path attribution migrate to tags.

# Guard-deletion accounting
Delete the unreadable bit, cwd Option, and coordination branches. Keep proc listing, PID reuse, containment, and path guards.

# Encoded-side impact
None. The reading collapses into scan counts and is absent from FleetSnapshot JSON.

# Test impact
Exercise all three cases, especially vanished versus unreadable, and retain aggregate scan tests.

# Risk and sequencing
Land with process-scan completion. Never count a vanished process as an unreadable gap.
