# Instance
- id: `worktree-process-scan-completion`
- exact source SHA: `7440cb8c4302ce64b87860069a464bafbf65f576`
- corpus source SHA: `9b7553f618b2b3ee10e11a3d6ee93606f3e40ce1`
- file:line: `packages/tooling/tool/cli/src/commands/Worktree/Fleet.service.ts:454`
- symbol/members: `ProcessScan` / `complete`, `unreadable`, `scanned`
- evidence: E4 `Fleet.service.ts:622-643`.

# Current shape
An unlistable `/proc` scan aborts false/0/0. A listed empty PID set is true/0/0. Nonempty clean is true/0/positive; unreadable gaps are false/positive/positive.

# Cardinality gap
Three zero/boolean axes represent eight combinations and four are legal.

# Target schema
Define LiteralKit/tagged cases `aborted`, `complete-empty`, `complete({scanned})`, and `gapped({scanned,unreadable})`, with positive constrained counts and unreadable no greater than scanned.

# Migration inventory
- `Fleet.service.ts:450-456,622-643` — construct cases and preserve one listing pass and cwd attribution.
- `Fleet.service.ts:913-974` — derive counts and `processScanComplete` exactly.
- Coordinate with process-cwd-reading; fleet liveness tests retain abort, empty complete, clean, and permission-gap scans.

# Guard-deletion accounting
Delete complete and zero/nonzero correlation branches. Keep directory/read failures and process attribution.

# Encoded-side impact
None. Only derived counts and processScanComplete feed liveness; scan record is not in FleetSnapshot JSON.

# Test impact
Explicitly preserve empty-but-complete versus aborted, plus clean and gapped nonempty scans.

# Risk and sequencing
Land with cwd reading. Empty `/proc` enumeration must remain complete evidence.
