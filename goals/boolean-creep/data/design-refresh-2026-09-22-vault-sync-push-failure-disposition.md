# Vault push failure P2 audit

Source/main `0be1f13d62fa00cb65e34ff69ec99043380f8d81`.

## Findings

Full transient pair remains4/3. Numeric budget is full numeric input, not stored Boolean. Error retryability remains independent adapter policy. Queued/failed status is the direct output projection; other global operation statuses are not admitted into this scoped failure writer. Existing LiteralKit output reuse removes the redundant Boolean without losing the error source fact.

Writer1057; reads1063/1066. Two call paths: adapter DmsMirrorUnavailable and VaultScanFailed normalized retryable false. Existing source uses full object spreads and returned item ref update. Pump repeats queued work within the same pass; revival later is a separate policy. Preserve failure propagation and all optional payloads/defaults. No wire/schema change.

## Evidence scope

Inspected current source and default-three retry, terminal, exhaustion fixtures; explicit max-one test remains to implement. Finite projection supplies bounded witnesses only. No network, adapter, secret, sync/push or database operations performed. No product edit or package verification. Graft first query accidentally scoped CLI and returned unrelated matches; discarded those results, then queried exact documents source. No unrelated source read. Coordinated status owner separately.

## Inputs

- `packages/documents/server/src/aggregates/Sync/VaultSyncEngine.service.ts`: `abba2373867fa544580b30ed6e99b43b21fdbdb47d3c5e49199ebd80244b4249`
- `packages/documents/server/src/aggregates/Sync/VaultSync.config.ts`: `8a7bb49865db9c31860b0a3b3933d7eaab925d142be3878433c140da9e21b9e7`
- `packages/documents/domain/src/entities/SyncOperation/SyncOperation.model.ts`: `6d3b53dbd83f63f62e1f3e896c05b000f0e52b4cda75e2b617f35892f524658c`
- `packages/documents/domain/src/entities/SyncOperation/SyncOperation.values.ts`: `8860fab7736c919482fd90547177b155972041c3b3475182633fb4eb8f119cc4`
- `packages/documents/domain/src/entities/SyncOperation/index.ts`: `20f28280f645ea0a3e9e101a7010b171f6b921d26757e7ed443514ac29e2c1ec`
- `packages/documents/server/src/aggregates/Sync/index.ts`: `2ca6dbcd850b20bf36bdd66dc930aa0b2aa4152b1a4198cf2c0979ab4d2ad8db`
- `packages/documents/use-cases/src/aggregates/Sync/server.ts`: `fa1e9218fe5bda16976dd561050eff5dad991bd82356659b067e5d7fd739b160`
- `packages/documents/use-cases/src/aggregates/Sync/Sync.errors.ts`: `ab2c8419e27a52028e48d64bd95404419c15d48dc4324dbc07fe7ad96528ce48`
- `packages/documents/server/test/VaultSyncEngine.test.ts`: `aaf69f5902a8d1430dcde8b5f4bf47daa47f0ad188457d6d77f0a047c0d91d44`
- `packages/documents/server/test/VaultSyncReviewRegressions.test.ts`: `a5fb3c7445adc1aaed681a531d2c71d89b69778d36f20f7ffea6b53ff56493a3`
- `inventory.before.jsonl`: `54567b68b5b6349d42f854462321583f5e626e63639b9835ddeb65f63eb59372`
- `design.before.md`: `4a47803a6bf78bb984655bee6378f96aa29e3ee9958f4ec29b49eceae406e345`

## Outputs

- `proposed-design.md`: `7bd699443e2b1bb317620d557bb6a2dcf7f137205d10f5da12d459772602a9af`
- `proposed-row.json`: `3dae4ef94566f3e8430c8143409663676fe25afefa52344b9c69ac10e461c5cf`
- `finite-projection.json`: `b2130ea7d01342380409b8f6df00a07b013f7092d97279b359b9b1137c141ac6`

Useful Graft savings17933 tokens (three useful retrievals); unrelated scope estimate54929 excluded.
