# Instance
- id: `worktree-policy-reading`
- exact source SHA: `7440cb8c4302ce64b87860069a464bafbf65f576`
- corpus source SHA: `9b7553f618b2b3ee10e11a3d6ee93606f3e40ce1`
- file:line: `packages/tooling/tool/cli/src/commands/Worktree/Fleet.service.ts:1015`
- symbol/members: `PolicyReading` / `probeFailed`, `movement`, `reason`, `paths`
- evidence: E1/E3 `Fleet.service.ts:1011-1043`.

# Current shape
The internal record has three outcomes: failed/unknown/probe-failed/empty, successful unmoved/null/empty, or successful moved/null/nonempty.

# Cardinality gap
2 probe values × 3 movements × 5 reason states × 2 path-presence states = 60 representable; three legal.

# Target schema
Define `probe-failed | unmoved | moved({NonEmptyReadonlyArray paths})`. Project existing movement/reason/paths into FleetCheckout; other unknown reasons belong to later PolicyDerivation, not this reader.

# Migration inventory
- `Fleet.service.ts:1011-1043` — construct cases, preserving policy surface and NUL path order.
- `Fleet.service.ts:1046-1160` — project exact values and propagate probe failure without conflating later unknown reasons.
- Fleet policy tests retain failed, moved, unmoved, multi-path, and JSON signal behavior.

# Guard-deletion accounting
Delete four correlated fields and their emptiness/nullable checks. Keep Git probe and later policy-derivation guards.

# Encoded-side impact
None directly. FleetCheckout JSON retains `unknown/probe-failed/[]`, `unmoved/null/[]`, or `moved/null/paths` exactly.

# Test impact
Cover three outcomes and ensure other FleetUnknownReason literals remain reachable through their existing owners.

# Risk and sequencing
Do not absorb PolicyDerivation or change policy-surface path filtering.
