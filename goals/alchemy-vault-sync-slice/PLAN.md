# Alchemy Vault-Sync Slice Plan

## Status

Status: `in-progress`

## Phases

| Phase | Status | Goal | Exit criteria |
| --- | --- | --- | --- |
| P0 Research | complete | Inspect source hierarchy and confirm scope. | Required facts and blockers are recorded (`research/01-p0-spikes.md`, 2026-11-06). |
| P1 Implement | in-progress | Make the smallest changes that satisfy `SPEC.md`. PR 1 (D16): pin, driver scaffold, spikes, doctrine, kit freeze. PR 2: Postgres Platform driver + conformance suite + Cluster engine. PR 3: vault-sync aggregates/views/policies/sagas, Session middleware, Api (HTTP/CLI/MCP views), genesis import, projections, single-writer cutover. PR 4: frontend offline intents + QA recording, observability catalog, PII audit. | Acceptance criteria are met. |
| P2 Verify | pending | Run required checks and capture evidence. | Verification is green or blockers are documented. |
| P3 Yeet: PR to mergeable | pending | Publish through yeet and drive the PR to mergeable: required checks green, review comments answered and resolved. | `mergeStateStatus` is `CLEAN`; zero unresolved review threads. |
| P4 Close | pending | Write the closeout reflection and flip packet state. | Packet status and evidence are updated; a closeout reflection exists. |

## Closeout Checklist

Before marking the packet closed:

1. Write a closeout reflection via the `/reflect` skill to
   `history/reflections/<YYYY-MM-DD>-<agent>.md`. Its YAML frontmatter must
   validate against `ReflectionFrontmatter`.
2. Run `bun run beep lint reflection-artifacts`.
3. Update `README.md` (status, latest evidence) and `ops/manifest.json` phase
   statuses and a typed `proposedCloseout` with status `completed-retained`
   and finalPullRequest. Keep `initiative.status` operative until completion
   evidence verifies; do not close the external execution/session ledger from a proposal.

## Execution Notes

- Preserve unrelated worktree changes.
- Keep `SPEC.md` normative and update it only when the contract changes.
- Keep this plan current; archive old run outputs under `history/`.

## Verification Commands

```sh
test "$(wc -m < goals/alchemy-vault-sync-slice/GOAL.md)" -le 4000
jq . goals/alchemy-vault-sync-slice/ops/manifest.json
rg -n "alchemy-vault-sync-slice|GOAL.md|agentLaunchers|packetAnchorDocument" goals/alchemy-vault-sync-slice
git diff --check -- goals/alchemy-vault-sync-slice
```

## Checkpoints

<!-- beep:decisions:begin -->
_Generated from [`decisions/`](./decisions/) by `bun run beep goals decisions write --slug alchemy-vault-sync-slice`; add a `kind: checkpoint` file there, never edit this block._

### PR 1 merged; PR 2a Postgres Platform for aggregates and policies, 2026-11-06

Foundations PR #2810 merged 2026-11-06 (7f7cb719ba): beta.85 pin, driver scaffold, P0 spikes, doctrine, entity-kit freeze. PR 2a ships `AlchemyPostgresPlatform.layer`: driver tables with provenance and `schema_version`, single-writer commits (instance row lock in one transaction), commandId dedupe, outbox delivery to policies, durable schedule/unschedule. Views, projections and streams fail with `AlchemyPostgresUnsupported` until PR 2b (with the Cluster workflow engine, catch-up over `Backfill`, upcasting at read, real-Postgres integration project). Conformance suite green on `Domain.InMemory` and PGlite (27 tests).

Lane `alchemy-postgres-driver worktree`

Reverse: Revert the PR 2a squash commit; no stored data exists yet

### PR 2b: views, projections, streams, Backfill catch-up, upcasting, Cluster engine, real Postgres, 2026-11-07

AlchemyPostgres.layer now provides Platform plus WorkflowEngine (effect/cluster ClusterWorkflowEngine over a SQL SingleRunner and Digest.layerWebCrypto), the same surface as Domain.InMemory. Views, projections and streams are hosted with InMemory's semantics; ModelHost.start/history run upstream Backfill over Postgres-backed Storage (advisory-locked KV) and Jobs. Upcasting: event classes may declare static schemaVersion (default 1) and static upcast(fromVersion, json), applied one version at a time on read. Saga crash-and-resume passes on PGlite. The conformance suite passes on Domain.InMemory and PGlite (79 tests) and on real Postgres 17 (32 integration scenarios, run against a throwaway container); the real-Postgres run found that @effect/sql-pg decodes int8 as native bigint, now accepted by the Int8 schema. Found along the way: in beta.85 Domain.InMemory, reading a view key before its first delivery keeps it out of the backfill directory, so a consumer added later skips that key; candidate for the D16 upstream offer.

Lane `alchemy-postgres-views worktree`

Reverse: Revert the PR 2b squash commit; driver tables are created idempotently and no product data uses them yet

### PR 2b merged; PR 3a vault-sync domain, 2026-11-07

PR 2b (#2863) merged 2026-11-07 as 97a7bb87f4: views, projections, streams, Backfill catch-up, upcasting at read, the Cluster workflow engine, real-Postgres integration, and an explicit-clock InMemory conformance suite. PR 3a lands the vault-sync domain: SyncDestination (with the folded cursor), DestinationNameReservation, SyncItem, SyncOperation (stable ids, lease with expiry and retry Deadlines), SyncConflict with a per-destination remote-event registry; the VaultSyncStatus, OpenConflicts, DestinationList and OperationQueue Views; the BoxMirror ExternalSystem contract; eight Policies. Tests run on Domain.InMemory and the @beep/alchemy-postgres PGlite layer. The saga, projections into the legacy tables, genesis, cutover and the Api follow in PR 3b and 3c.

Lane `vault-sync-domain worktree`

Reverse: Revert the PR 3a squash commit; no product data uses the new aggregates yet

### PR 4: offline intents in the desktop renderer, recorded QA green, 2026-11-07

The desktop vault-sync panel records every command as an intent before sending it, predicts it at once (pass queued, conflict reads reviewed), persists the queue in localStorage, replays it every two seconds once the sidecar answers, and reverts a prediction the server rejects with its message on the conflict row. `TriggerVaultSync` carries an optional `intentId` the Api adapter uses as request and command id, so a replay requests one pass (server test). Recorded browser QA (`bun run beep qa`, playwright lane, 5 rounds) ended with rounds 4 and 5 at zero required findings; the final inventory, capture harness and panel screenshots are in `history/qa/2026-11-07-pr4-offline-intents/`. The harness stubs only the vault-sync RPCs on a real renderer and sidecar to switch the sidecar offline, online and rejecting. Observability catalog, PII audit, genesis/cutover remain.

Lane `feat/vault-sync-offline-intents`

Reverse: Revert the PR 4 squash commit; the intent queue lives only in renderer localStorage and the intentId payload key is optional

<!-- beep:decisions:end -->
