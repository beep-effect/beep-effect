# Instance
- id: `worktree-branch-diff-reading`
- exact source SHA: `7440cb8c4302ce64b87860069a464bafbf65f576`
- corpus source SHA: `9b7553f618b2b3ee10e11a3d6ee93606f3e40ce1`
- file:line: `packages/tooling/tool/cli/src/commands/Worktree/Fleet.service.ts:989`
- symbol/members: `BranchDiffReading` / `probeFailed`, `count`, `paths`
- evidence: E3 `Fleet.service.ts:986-1008`.

# Current shape
Failure is true/null/empty; success stores exact path length, distinguishing measured zero/empty from positive/nonempty.

# Cardinality gap
Three presence/zero axes represent eight combinations and three are legal.

# Target schema
Use `failed | measured-empty | measured({NonEmptyReadonlyArray paths})`; derive count exactly from paths and project it only at the FleetCheckout boundary.

# Migration inventory
- `Fleet.service.ts:986-1008` — replace constant/record and preserve NUL parsing/order.
- `Fleet.service.ts:1046-1160` — match when deriving branchDiffCount/paths and overall probe failure.
- Fleet tests retain failed, empty, multiple-path, rename/path ordering, and JSON checkout projections.

# Guard-deletion accounting
Delete probeFailed/count/path-emptiness coordination and stored count. Keep Git probe, merge-base, and NUL parsing guards.

# Encoded-side impact
Internal state only; FleetCheckout JSON retains null on failure, zero on measured empty, exact positive length, and unchanged paths.

# Test impact
Assert all three states and `count === paths.length`, especially empty-but-successful.

# Risk and sequencing
Never turn empty measured diff into probe failure.
