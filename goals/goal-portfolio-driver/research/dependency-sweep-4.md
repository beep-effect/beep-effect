# Dependency Sweep 4

## epistemic-bitemporal-edge-core

- **Slug:** `epistemic-bitemporal-edge-core`
- **Remaining phases:** P0 storage/concurrency/provenance spike; P1 implement; P2 verify; P3 close. All four are pending ([PLAN.md:9-14](../../epistemic-bitemporal-edge-core/PLAN.md#phases); [manifest:50-70](../../epistemic-bitemporal-edge-core/ops/manifest.json)).
- **Proposed PR units:** 3.
  1. P0 evidence unit: provenance/license inventory plus Postgres/PGlite storage, migration, identity, endpoint, index, and concurrency proof ([PLAN.md:16-40](../../epistemic-bitemporal-edge-core/PLAN.md#p0--storage-concurrency-and-provenance-spike)).
  2. P1 implementation unit: schema-first domain/tables/use-cases/server repository and generated migration ([PLAN.md:42-56](../../epistemic-bitemporal-edge-core/PLAN.md#p1--implement)).
  3. P2/P3 proof-and-close unit: temporal/race/restart tests, Yeet verification, reflection, packet-state synchronization, and Graphiti-retirement trigger record ([PLAN.md:58-81](../../epistemic-bitemporal-edge-core/PLAN.md#p2--verify)).
- **Frontend:** no. The target surfaces are `packages/epistemic/{domain,tables,use-cases,server}`, `packages/_internal/db-admin`, tests, and packet evidence; no `apps/**`, `packages/**/ui/**`, or `.tsx` surface is named ([SPEC.md:36-43](../../epistemic-bitemporal-edge-core/SPEC.md#target-surfaces)).
- **dependsOn:** none. Neither the spec nor manifest names another goal packet as a prerequisite.
- **Special execution notes:** P0 is a hard gate: if production Postgres and the PGlite proof lane cannot preserve every invariant, stop and reshape the storage backstop before P1 ([PLAN.md:38-40](../../epistemic-bitemporal-edge-core/PLAN.md#p0--storage-concurrency-and-provenance-spike)). Complete the donor/license inventory before code and add no donor runtime dependency ([SPEC.md:65-67](../../epistemic-bitemporal-edge-core/SPEC.md#constraints)). Stop if verification requires unnamed credentials, cost, destructive side effects, or policy approval ([SPEC.md:112-118](../../epistemic-bitemporal-edge-core/SPEC.md#stop-conditions)).

## projection-dispatch-core

- **Slug:** `projection-dispatch-core`
- **Remaining phases:** P0 atomic-handoff and `DurableQueue` store-integration proof (blocked); P1 implement; P2 verify; P3 close ([PLAN.md:9-14](../../projection-dispatch-core/PLAN.md#phases)).
- **Proposed PR units:** 3, sequenced after the workflow prerequisite lands.
  1. P0 evidence unit: consume and archive the workflow adapter/crash contract, then freeze atomic handoff, recovery, key, cursor/status, worker, and authorization contracts ([PLAN.md:16-31](../../projection-dispatch-core/PLAN.md#p0-proof-contract)).
  2. P1 implementation unit: epistemic persistence/ports/RPC, isolated durable worker/projector, scoped hint path, and desktop auth/re-query integration ([PLAN.md:11-12](../../projection-dispatch-core/PLAN.md#phases)).
  3. P2/P3 proof-and-close unit: transaction/retry/stale/auth/dropped-hint/two-window restart proof, Yeet/hosted checks, reflection, and packet-state synchronization ([PLAN.md:13-14](../../projection-dispatch-core/PLAN.md#phases); [PLAN.md:38-44](../../projection-dispatch-core/PLAN.md#p3-closeout-checklist)).
- **Frontend:** yes. The packet explicitly targets `apps/professional-desktop` for RPC merge, subscription, authorized scope, re-query, and app integration proof ([SPEC.md:42-54](../../projection-dispatch-core/SPEC.md#target-surfaces)).
- **dependsOn:** `effect-v4-workflow-engine-spike`. Quoted evidence: “`goals/effect-v4-workflow-engine-spike` is a hard prerequisite. P0 begins only after its persistence adapter, store atomicity limits, ambiguous completion, competing-worker, and real kill/restart evidence are available” ([SPEC.md:62-65](../../projection-dispatch-core/SPEC.md#constraints)). The manifest also records `"blockedBy": ["goals/effect-v4-workflow-engine-spike"]` ([manifest:21](../../projection-dispatch-core/ops/manifest.json)).
- **Special execution notes:** P0 and P1 must not begin until the prerequisite evidence lands ([PLAN.md:33-36](../../projection-dispatch-core/PLAN.md#blockers)). Ratify the proposed appetite before commit ([SPEC.md:58-61](../../projection-dispatch-core/SPEC.md#constraints)). Do not claim exactly-once delivery, invent a user principal, trust client-supplied scope, or create a second durability adapter. Stop if the handoff cannot be lossless/recoverable, authorization requires invented identity, or verification needs unnamed credentials, cost, destructive effects, or policy approval ([SPEC.md:173-188](../../projection-dispatch-core/SPEC.md#stop-conditions)).

## identity-iri-fold

- **Slug:** `identity-iri-fold`
- **Remaining phases:** P0 contract/donor audit; P1 fold and projections; P2 FOLIO migration and verification; P3 close. All four are pending ([PLAN.md:9-14](../../identity-iri-fold/PLAN.md#phases); [manifest:58-66](../../identity-iri-fold/ops/manifest.json)).
- **Proposed PR units:** 3.
  1. P0 evidence unit: live core compatibility, donor and FOLIO inventory, tuple grammar, diagnostics/profile fixtures, and frozen fold/projection boundary ([PLAN.md:11](../../identity-iri-fold/PLAN.md#phases)).
  2. P1 implementation unit: nominal composer entrypoints, validated tuple fold, assembled ontology/errors/profiles, and four deterministic projections ([PLAN.md:12](../../identity-iri-fold/PLAN.md#phases)).
  3. P2/P3 migration-and-close unit: idempotent FOLIO/address migration, focused/repo proof, Yeet/hosted checks, reflection, and packet synchronization ([PLAN.md:13-22](../../identity-iri-fold/PLAN.md#phases)).
- **Frontend:** no. The only target surfaces are foundation identity, ontology, and RDF TypeScript modules, with no `apps/**`, `packages/**/ui/**`, or `.tsx` target ([SPEC.md:41-50](../../identity-iri-fold/SPEC.md#target-surfaces)).
- **dependsOn:** `identity-iri-core` (satisfied). Quoted evidence: “`identity-iri-core` is a satisfied completed-retained dependency” ([SPEC.md:54-56](../../identity-iri-fold/SPEC.md#constraints)); the manifest lists `"dependencies": ["goals/identity-iri-core"]` and no blockers ([manifest:21-22](../../identity-iri-fold/ops/manifest.json)).
- **Special execution notes:** P0 is a hard compatibility/donor gate; live paths win and old donor availability must not be inferred ([PLAN.md:24-28](../../identity-iri-fold/PLAN.md#execution-notes)). Preserve the shipped identity-core contract and keep `identity-iri-fibered` held until this packet lands. Stop on an incompatible core change, divergent authoring grammar/diagnostics, a FOLIO mapping requiring new domain authority, or expansion into Fibered/store/SHACL/dependency/auth/infra/migration scope ([SPEC.md:107-113](../../identity-iri-fold/SPEC.md#stop-conditions)). No credentials or external infrastructure are called for by the packet.

## ingestion-secret-scrub

- **Slug:** `ingestion-secret-scrub`
- **Remaining phases:** P0 pattern-bank consolidation audit/fixtures; P1 implement; P2 verify; P3 close. All four are pending ([PLAN.md:9-14](../../ingestion-secret-scrub/PLAN.md#phases); [manifest:49-69](../../ingestion-secret-scrub/ops/manifest.json)).
- **Proposed PR units:** 3.
  1. P0 evidence unit: rule/consumer inventory, bank deduplication/version ownership, and synthetic fixture matrix ([PLAN.md:16-28](../../ingestion-secret-scrub/PLAN.md#p0-audit-contract)).
  2. P1 implementation unit: file-processing scrub/proof envelope, coverage/residue and retention behavior, canonical-bank consumers, and one real prompt-boundary gate ([PLAN.md:12](../../ingestion-secret-scrub/PLAN.md#phases)).
  3. P2/P3 proof-and-close unit: canary-absence, prompt-gate, retention and repo proof, non-secret evidence, Yeet/hosted checks, reflection, and packet synchronization ([PLAN.md:13-14](../../ingestion-secret-scrub/PLAN.md#phases); [PLAN.md:30-38](../../ingestion-secret-scrub/PLAN.md#p3-closeout-checklist)).
- **Frontend:** no. Named targets are file-processing, ai-metrics, observability, one prompt-producing consumer boundary, fixtures, tests, and evidence; the packet does not require `apps/**`, `packages/**/ui/**`, or `.tsx` ([SPEC.md:45-57](../../ingestion-secret-scrub/SPEC.md#target-surfaces)).
- **dependsOn:** none. Neither the spec nor manifest names another goal packet as a prerequisite.
- **Special execution notes:** Use synthetic canaries only; never archive or persist raw secrets, including `TextAnchor.quote`, logs, errors, snapshots, or packet evidence ([SPEC.md:68-78](../../ingestion-secret-scrub/SPEC.md#constraints); [PLAN.md:40-47](../../ingestion-secret-scrub/PLAN.md#execution-notes)). P0 must consolidate the two live banks before public contracts freeze. Stop if ownership/semantics cannot be consolidated, any raw match survives, blocked/unknown content reaches prompt construction, the real prompt boundary is unavailable, or verification needs unnamed credentials, cost, destructive effects, or policy approval ([SPEC.md:172-184](../../ingestion-secret-scrub/SPEC.md#stop-conditions)). No credential retrieval or 1Password work is in scope.

## secure-document-delivery

- **Slug:** `secure-document-delivery`
- **Remaining phases:** P0 threat model and packaged-keyring spikes; P1 implement; P2 verify; P3 close. All four are pending, and deterministic fixture-backed P0-P3 may proceed ([PLAN.md:9-14](../../secure-document-delivery/PLAN.md#phases); [PLAN.md:31-35](../../secure-document-delivery/PLAN.md#blockers)).
- **Proposed PR units:** 3.
  1. P0 evidence unit: threat model, envelope/tamper/AAD/version/rotation vectors, packaged OS-keyring probes, and explicit webview/HTTP/Range/HEAD policy ([PLAN.md:16-29](../../secure-document-delivery/PLAN.md#p0-spike-contract)).
  2. P1 implementation unit: incubated capability, mapping persistence/migration, custody adapter, product/provider adapters, and authenticated desktop route for the fixture ([PLAN.md:12](../../secure-document-delivery/PLAN.md#phases)).
  3. P2/P3 proof-and-close unit: denial/store/route/restart/packaged-runtime proof, Yeet/hosted checks, non-secret reflection/evidence, and packet synchronization ([PLAN.md:13-14](../../secure-document-delivery/PLAN.md#phases); [PLAN.md:37-43](../../secure-document-delivery/PLAN.md#p3-closeout-checklist)).
- **Frontend:** yes. The target surfaces explicitly include `apps/professional-desktop/server` plus desktop PGlite runtime/migrations ([SPEC.md:40-55](../../secure-document-delivery/SPEC.md#target-surfaces)).
- **dependsOn:** none. The only recorded blocker is an exploration-level guarded-fetch proof, not another packet slug; it blocks live origin fetch only, while fixture-backed P0-P3 remains executable ([SPEC.md:159-163](../../secure-document-delivery/SPEC.md#blocked-by)).
- **Special execution notes:** Requires packaged Windows/macOS/Linux keyring behavior proof for the installed `@azure/msal-node-extensions` adapter, but forbids `@beep/m365`, new crypto/keyring dependencies, and 1Password recovery ([SPEC.md:22-23](../../secure-document-delivery/SPEC.md#non-goals); [SPEC.md:86-97](../../secure-document-delivery/SPEC.md#constraints)). Routine acceptance is deterministic and network-free; do not substitute credentialed live USPTO fetch until guarded-fetch proof lands. Stop if envelope/custody/Range/HEAD posture is unresolved, prohibited data leaks, denial surfaces diverge, scope widens, or verification requires unnamed credentials, cost, destructive effects, or policy approval ([SPEC.md:165-178](../../secure-document-delivery/SPEC.md#stop-conditions)).

## effect-v4-workflow-engine-spike

- **Slug:** `effect-v4-workflow-engine-spike`
- **Remaining phases:** P0 engine feasibility spike; P1 adapter/restart harness/upgrade guard (blocked by P0); P2 verify; P3 close/handoff. All four are pending ([PLAN.md:8-15](../../effect-v4-workflow-engine-spike/PLAN.md#phases); [manifest:51-71](../../effect-v4-workflow-engine-spike/ops/manifest.json)).
- **Proposed PR units:** 3.
  1. P0 evidence unit: store selection, 14-row durability parity matrix, kill-point matrix, deterministic identity/idempotency contract, and proceed/fail disposition ([PLAN.md:17-31](../../effect-v4-workflow-engine-spike/PLAN.md#p0-feasibility-contract)).
  2. P1 implementation unit: minimal workflow driver adapter, representative workflow, fresh-process kill/restart harness, and compile-time/behavioral Effect-upgrade guard ([PLAN.md:13](../../effect-v4-workflow-engine-spike/PLAN.md#phases)).
  3. P2/P3 proof-and-close unit: crash/control/competing-worker/failure-domain and repo proof, pass/fail record, docketing handoff, Yeet/hosted checks, reflection, and packet synchronization ([PLAN.md:14-15](../../effect-v4-workflow-engine-spike/PLAN.md#phases); [PLAN.md:33-46](../../effect-v4-workflow-engine-spike/PLAN.md#p3-closeout-checklist)).
- **Frontend:** no. The target surfaces are `packages/drivers/workflow`, integration fixtures/process harness, and packet history; no `apps/**`, `packages/**/ui/**`, or `.tsx` target is named ([SPEC.md:40-47](../../effect-v4-workflow-engine-spike/SPEC.md#target-surfaces)).
- **dependsOn:** none. The packet produces downstream handoff evidence for `law-docketing-reliability`; it does not identify that packet or another packet as its own prerequisite ([SPEC.md:3-11](../../effect-v4-workflow-engine-spike/SPEC.md#objective)).
- **Special execution notes:** P0 is the only authorized next phase and must select a persistent store, map all 14 constraints, and record explicit parity limits before P1 ([PLAN.md:3-6](../../effect-v4-workflow-engine-spike/PLAN.md#status); [PLAN.md:17-31](../../effect-v4-workflow-engine-spike/PLAN.md#p0-feasibility-contract)). Use real process kill/restart against the same store; `layerMemory` is negative control only. Treat `effect/unstable/workflow` drift as fail-closed and rerun both compile and behavioral guards on Effect upgrades. Stop on an incapable store/engine contract, unsafe duplication or ordering, bespoke-orchestration scope, or any unapproved dependency, lockfile, public API/schema, auth, infrastructure, destructive-state, credential, cost, or policy change ([SPEC.md:171-185](../../effect-v4-workflow-engine-spike/SPEC.md#stop-conditions)).

## Summary

| slug | remaining | prUnits | frontend | dependsOn |
| --- | --- | ---: | :---: | --- |
| `epistemic-bitemporal-edge-core` | P0, P1, P2, P3 | 3 | no | none |
| `projection-dispatch-core` | P0 (blocked), P1, P2, P3 | 3 | yes | `effect-v4-workflow-engine-spike` |
| `identity-iri-fold` | P0, P1, P2, P3 | 3 | no | `identity-iri-core` (satisfied) |
| `ingestion-secret-scrub` | P0, P1, P2, P3 | 3 | no | none |
| `secure-document-delivery` | P0, P1, P2, P3 | 3 | yes | none |
| `effect-v4-workflow-engine-spike` | P0, P1 (blocked by P0), P2, P3 | 3 | no | none |
