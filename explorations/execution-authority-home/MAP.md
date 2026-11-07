# Map

<!--
Stage 4. Decomposition into candidate goal packets. This is the graduation
surface: the definition-of-ready in explorations/README.md is checked against
this file. Every major component cites an existing repo capability or is
explicitly marked NET-NEW.
-->

## Candidate Goal Packets

| Slug | Mission | Depends on | Capabilities cited | Status |
| --- | --- | --- | --- | --- |
| `execution-authority-slice` | Move agent execution authority out of the epistemic slice into a new `execution-authority` slice without changing behavior (P1). Then link each ontology Session change to the decision that authorized it (P2). | none | Existing code: `@beep/epistemic-{domain,use-cases,server,tables,config}` execution modules (RESEARCH §1). Ports: `@beep/mcp-kit` `TierGate`, `@beep/api-transport` `EgressDenied`. Hashing: `@beep/epistemics` `canonicalDetectionJson`. Persistence: `@beep/drizzle`, `@beep/postgres`, `@beep/pglite`. Migrations: `packages/_internal/db-admin`. Scaffolding: `bun run beep create-package`. Attach point: `OntologyChangeActor` on the Session journal (`@beep/ontology-domain/aggregates/Session`). NET-NEW: the five slice packages (shells only, the code moves), the rename migration, and the `authorizedBy` field. | promised now |
| `agent-execution-record-anchoring` | Anchor the decision chain's tip outside the store (a signed checkpoint) so truncation and a resealed tail are detected. | `execution-authority-slice` | Crosby & Wallach, RFC 9162 and C2SP witness designs (research report). In repo: `verifyExecutionDecisionChain`. NET-NEW: the checkpoint and the place it is kept. | gated: opens when `execution-authority-slice` reaches completed-retained |
| execution-authority mechanism capability | Extract the generic gate and chain mechanism into `foundation/capability`, leaving policy, tables and bindings in the slice. | `execution-authority-slice` | `07-non-slice-families.md` capability gate | gated: a second consumer imports the mechanism |

The epistemic slice's direction (A: the claim store every slice writes to,
against B: split into reusable infrastructure) is not a candidate here. It is
the next grill, and it opens its own exploration once
`execution-authority-slice` P1 has merged and the slice holds only epistemic
code.

## Sequencing

1. **`execution-authority-slice` P1: the move.** This is the first bet. It
   removes the misfiling, unblocks the epistemic direction grill, and changes
   no behavior, so its proof is a diff of observable state.
2. **`execution-authority-slice` P2: the `authorizedBy` link.** A small,
   separate PR in ontology plus one desktop wiring point. It goes second
   because it needs the decision IRI scheme that P1's package gives a home.
3. **`agent-execution-record-anchoring`.** Gated on the slice goal's closeout.
   It is a security feature with its own design space (checkpoint format and
   where the checkpoint is kept).
4. **Mechanism capability.** Waits until a second consumer exists.

## First Vertical Slice

P1 lands as one atomic PR. Afterwards:

- The desktop sidecar governs MCP mutations and publishes exactly as before.
- `rg '@beep/epistemic-config|epistemic-domain/values/Execution' packages apps`
  finds nothing.
- A PGlite database seeded before the move with decision and outcome rows
  (including a denial) migrates forward and keeps every row. The chain still
  verifies, and the migration's down step restores the old names.
- The bound address, ledger row counts and `information_schema.columns` pins
  match the pre-move recordings.
- `bun run beep quality package-verify` passes for every new package and for
  each touched epistemic package.

## Open Risks Inherited From The Brief

- Hash labels, `canonicalDetectionJson` and the manual projections must stay
  byte-identical. Prove it by replaying a chain recorded before the move.
- The rename covers tables, constraints, triggers and the guard function in one
  forward migration, with a tested down-migration.
- Behavior proof must diff observable state, not just test names (lesson from
  the `agent-execution-authority` reflection).
- `OptionalDefect`: search for an existing helper first, otherwise copy it with
  a note. Record the outcome as a decision.
- A stale `EPISTEMIC_*` env empties the allowlist and unregisters the publish
  tool. That fails closed; the PR and `.env.example` say so.
- `ValueSchemaIdentifiers.test.ts` must stay green for the remaining epistemic
  modules.
