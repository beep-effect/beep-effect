# Legal Document Intake

## Status

Lifecycle: `active`

Source: [`ops/manifest.json`](./ops/manifest.json)

## Mission

Turn `apps/professional-desktop` into an intelligent legal document intake
surface: drag-and-drop files → agent classifies against a FOLIO-aligned legal
taxonomy → files into a local workspace vault mirrored one-way to the firm's
DMS (Box first, OneDrive later) → extraction plus a librarian/critic loop
populates a knowledge graph → natural-language retrieval opens the document at
the exact line in a dock panel.

This is the umbrella program packet. Each `PLAN.md` phase must ship as its own
mergeable PR per the completion gate; dependency packets are referenced, not
duplicated.

## Launch

Use this command for execution-capable sessions:

```text
/goal follow the instructions in goals/legal-document-intake/GOAL.md
```

`GOAL.md` is the compact launcher. `SPEC.md` remains the normative contract.

## Read This First

1. [`GOAL.md`](./GOAL.md) - compact `/goal` launcher.
2. [`SPEC.md`](./SPEC.md) - normative source of truth (locked decisions D1–D11).
3. [`PLAN.md`](./PLAN.md) - phased execution plan (P0 research → P6 M365 write).
4. [`ops/manifest.json`](./ops/manifest.json) - machine-readable routing.
5. [`research/exploration-findings.md`](./research/exploration-findings.md) -
   distilled 8-area codebase survey (reuse map + gap list).
6. [`research/SOURCES.md`](./research/SOURCES.md) - provenance ledger.

## Dependency Packets

| Packet | Relationship |
| --- | --- |
| [`box-driver`](../box-driver/README.md) | `@beep/box` write surface already exists in source; P3 builds sync on top. |
| [`m365-driver`](../m365-driver/README.md) | Completed read-only driver; P6 adds write verbs behind the same DMS port. |
| [`ip-law-knowledge-graph`](../ip-law-knowledge-graph/README.md) | This packet resolves its FalkorDB-vs-projection P0 question in favor of a Postgres/PGlite projection. |
| [`trustgraph-port`](../trustgraph-port/README.md) | Librarian/critic prior art to mine (adapt, not port). |
| [`file-processing-capability`](../file-processing-capability/README.md) | Extraction substrate (`@beep/file-processing`, Tika/libpff). |
| [`agentic-professional-runtime`](../agentic-professional-runtime/README.md) | Product-vision umbrella; the law-practice rung-0 loop is the proven E2E precedent this packet generalizes. |
| [`mcp-kit`](../mcp-kit/README.md) / [`mcp-host-retrofit`](../mcp-host-retrofit/README.md) | In-flight MCP host infra; skills support (P4+) is gated on their merge. |

## Current Phase

P4 Extraction → KG loop (pending P3 PR merge). P3 shipped 2026-07-11 with the
live-Box verification lanes and OAuth connect flow deferred per the SPEC
Exception Ledger — the Box test tenant is still not provisioned. To remove the
exception: provision a Box developer/test tenant, set `CLOUD_BOX_TOKEN` in
`.env`, run the env-gated live lanes
(`packages/drivers/box/test/integration/Box.live.test.ts` and a live sync
round-trip), and replace the desktop env-token setup path with the OAuth flow.

## Latest Evidence

P3 Box sync completed 2026-07-11 (PR pending merge). Evidence: schema-first
sync entities (SyncItem/SyncOperation/SyncCursor/SyncConflict) with
`@beep/documents-tables` projections and the `documents_sync_state` db-admin
migration proven on pglite; provider-neutral `DmsMirror`/`VaultSyncEngine`
use-cases ports with `VaultSyncRpcs`; outbox-driven one-way push engine with
squash/retry/leased-recovery, drift classification with echo suppression, and
restart-safe durable cursors (15 dedicated engine/drift tests incl. a
two-instantiation restart-survival proof); Box adapter over `@beep/box`
unit-verified against a fake SDK client (17 tests); desktop vault-sync panel,
sidecar RPC wiring, and env-driven connected/disconnected layer selection.
Live-Box round-trip + OAuth flow deferred per the SPEC Exception Ledger (Box
tenant not provisioned).

P2 LLM filing agent completed 2026-07-11 via PR #370 (merged to `main` as
`61aeca13b2`). Evidence per the PLAN.md P2 row: JS-native text-extraction
driver behind the `@beep/file-processing` engine contract, optional bounded
text excerpt on the FilingDecision port, LLM filing layer in
`documents/server` with typed config, auto-file with visible rationale,
uncertain → `00-inbox`, heuristic retained as the deterministic fixture Layer.

P1 Vault + deterministic intake completed 2026-07-09. Evidence: new
`documents` domain/use-cases/server packages, workspace vault table and store,
desktop vault onboarding plus DnD intake target, deterministic taxonomy
projection tests, workspace vault tests, migration/schema parity tests, full
`docgen:local --full`, affected lint/check/type-test, and targeted Vitest
lanes. `bun run beep yeet repair` / `verify` were attempted, but this managed
worktree blocks Yeet's required `git fetch` writes under `.git`.

P0 Research completed 2026-07-08. Evidence:
[`research/folder-structure.md`](./research/folder-structure.md),
[`research/taxonomy-seed.md`](./research/taxonomy-seed.md),
[`research/embedding-bakeoff.md`](./research/embedding-bakeoff.md),
[`research/librarian-critic.md`](./research/librarian-critic.md), and
[`research/sync-state-model.md`](./research/sync-state-model.md). The folder
structure note produced the D5-S1 superseding entry in
[`SPEC.md`](./SPEC.md); the other notes affirmed D10, recorded a
non-superseding P4 lifecycle nuance, or narrowed implementation without
superseding D1-D11.

## Notes

- The desktop app is single-workspace today (`DEFAULT_WORKSPACE_ID = 1`), the
  `Workspace` entity has no filesystem path, and no workspace table exists —
  P1 introduces the vault concept.
- `goals/box-driver/README.md` previously said "Pending implementation" while
  `@beep/box` source already ships uploads/folders/streaming/webhooks; the
  status was corrected when this packet was authored.
