# Instance
- id: `worktree-fleet-epoch-target`
- exact source SHA: `7440cb8c4302ce64b87860069a464bafbf65f576`
- corpus source SHA: `9b7553f618b2b3ee10e11a3d6ee93606f3e40ce1`
- file:line: `packages/tooling/tool/cli/src/commands/Worktree/Worktree.schemas.ts:1051`
- symbol/members: `FleetEpochTarget` / `materialized`, `sha`
- evidence: E4 `Fleet.service.ts:859-904`; E2 `Fleet.command.ts:124-128` and `Fleet.service.ts:1160-1180`.

# Current shape
The fleet snapshot stores a materialized bit beside nullable target SHA. Missing scanner/ref yields false/null, unresolved fetch yields false/SHA, and a locally available commit yields true/SHA.

# Cardinality gap
Four combinations are representable and three legal; true/null is impossible.

# Target schema
Use a LiteralKit-backed tagged union `unresolved | known-unmaterialized({sha}) | materialized({sha})`, retaining `ref` beside it. Wrap it with a codec to the existing flat object.

# Migration inventory
- `Worktree.schemas.ts:1030-1056,1100-1140` — define the union and keep FleetSnapshot nesting/export.
- `Fleet.service.ts:859-904` — construct the three cases without changing ls-remote/fetch/cat-file order.
- `Fleet.service.ts:913-1175` — match target state while deriving signals.
- `Fleet.command.ts:124-128,300-325` — preserve labels and `--json` rendering.
- Fleet source tests retain unavailable, missing ref, failed fetch, cached object, fetched object, and JSON snapshots.

# Guard-deletion accounting
Delete decoded materialized/nullable-SHA coordination and impossible true/null. Keep all Git probe and validation guards.

# Encoded-side impact
Tier 2 wire. Preserve exact `ref`, `sha:null|string`, `materialized:boolean`, snapshot nesting, JSON key order/value semantics, and human labels.

# Test impact
Round-trip all three old projections and reject true/null; retain scanner/fetch and fleet JSON tests.

# Risk and sequencing
Land alone with encoded-compat proof. Do not turn known-but-unmaterialized into unresolved.
