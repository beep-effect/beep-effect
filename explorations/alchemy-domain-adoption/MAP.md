# Map

## Candidate Goal Packets

| Slug | Mission | Depends on | Capabilities cited |
| --- | --- | --- | --- |
| `alchemy-vault-sync-slice` | Migrate `documents` vault-sync onto `@alchemy.run/domain` end to end: Postgres Platform driver + Cluster workflow engine, aggregates/sagas/policies/views, Api (HTTP, CLI, MCP views), optimistic + offline intents client, projections cutover, doctrine amendments | none | `@beep/documents-domain` (`packages/documents/domain`, migrate); `@beep/documents-use-cases`, `@beep/documents-server` (`aggregates/Sync/*`, migrate); `@beep/box` (reuse as External System adapter); `@beep/schema` LiteralKit/`$I` (reuse); `effect/cluster` (reuse); Postgres Platform driver NET-NEW; alchemy hosting Layers NET-NEW; offline intent queue client NET-NEW |
| `alchemy-epistemic-slice` (queued) | Migrate `epistemic` (claims, belief views) onto alchemy using the driver and recipe from goal 1 | `alchemy-vault-sync-slice` | `@beep/epistemic-domain` (migrate); driver (reuse) |
| `alchemy-docket-intake-slice` (queued) | Migrate law-practice DocketIntake (Muse's first pick) once the recipe is proven on a smaller slice | `alchemy-vault-sync-slice` | `@beep/law-practice-domain` (migrate); lawyer-facing review surfaces rule applies |
| `alchemy-remaining-slices` (queued) | agents, architecture-lab, documents (rest), ontology, party, workspace; delete the entity kit with the last consumer (D3); retire `@beep/effect-drizzle` | the three above | per slice |
| `document-editor-crdt-values` (gated) | CRDT-backed collaborative content values inside server-owned aggregates | `alchemy-vault-sync-slice`; product requirement for co-editing | NET-NEW; see teach workspace `local-first-sync` |

## Sequencing

1. `alchemy-vault-sync-slice` is the only bet promised now. It carries the driver, the conformance suite, the doctrine amendments and the migration recipe every later slice copies.
2. Queued slices graduate one at a time after goal 1 closes, each reopening this packet at `decompose` only if the recipe changes.
3. `document-editor-crdt-values` is gated on a co-editing product requirement, not on time.

## First Vertical Slice

When it lands, a user can register a Box destination (unique per org), start a vault sync, lose connectivity mid-way and have the queued intents replayed on reconnect, watch the scan → push → reconcile saga survive a server restart, review conflicts through HTTP, CLI and an MCP Views server, and see the same rows in the legacy sync tables rebuilt as projections. Verification: conformance suite green on InMemory and Postgres; replay-and-diff equality on the genesis import; Views-as-security-boundary tests; crash-and-resume saga test; browser QA of the optimistic/offline flow via `bun run beep qa`.

## Open Risks Inherited From The Brief

- Platform contract drift across betas; conformance suite is the contract.
- Backfill/replay is Cloudflare-shaped upstream; Postgres driver owns replay.
- LiteralKit/`$I` annotation propagation through alchemy constructors unverified.
- Envelope provenance survival through CatchUp/Backfill unverified.
- Event version slot location (constructor annotation vs driver) undecided until spike.
- ClusterWorkflowEngine on Postgres unproven in this repo.
- One-person upstream merge queue; no dependency on upstream acceptance.
