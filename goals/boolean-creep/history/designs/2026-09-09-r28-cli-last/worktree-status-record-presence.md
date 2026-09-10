# Instance
- id: `worktree-status-record-presence`
- exact source SHA: `7440cb8c4302ce64b87860069a464bafbf65f576`
- corpus source SHA: `9b7553f618b2b3ee10e11a3d6ee93606f3e40ce1`
- file:line: `packages/tooling/tool/cli/src/commands/Worktree/Fleet.service.ts:169`
- symbol/members: `StatusRecord` / `counted`, `paths`
- evidence: E3 `Fleet.service.ts:164-190`.

# Current shape
The `git status --porcelain=v1 -z` parser uses false/empty for a trailing/incomplete record and true with one ordinary path or two rename/copy paths. Stride follows that payload.

# Cardinality gap
Four counted/path-presence combinations are representable and two legal. One versus two paths is payload, not another boolean axis.

# Target schema
Use `skipped | counted({NonEmptyReadonlyArray paths, stride})`, refine stride one for one path and two for rename/copy two-path records, and derive aggregate entry count.

# Migration inventory
- `Fleet.service.ts:164-195` — replace record/constant and preserve status code parsing, NUL boundaries, rename/copy ordering, and strides.
- `Fleet.service.ts:936-949` — preserve dirtyCount and dirtyPaths projections, including successful empty status.
- Fleet parser/status tests retain ordinary, rename, copy, malformed/trailing-empty, and multi-record fixtures.

# Guard-deletion accounting
Delete counted/path-emptiness coordination. Keep record-boundary and rename/copy detection.

# Encoded-side impact
None directly. FleetCheckout JSON retains exact dirty count/path order and null only when the Git probe fails.

# Test impact
Cover skipped, one-path, and two-path records plus aggregate counts and paths.

# Risk and sequencing
Do not swap source/destination path order or count a trailing empty NUL record.
