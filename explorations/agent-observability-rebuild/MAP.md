# Implementation map

2026-10-27. Operator adopted the design and requested implementation packets. All three are **authored but not started**; preparation does not launch any goal or production changes.

| Order / packet | Mission | Dependencies | First deliverable |
| --- | --- | --- | --- |
| 1. `goals/agent-observability-foundation` | Establish trustworthy identity, source coverage, event-time semantics and bounded durable delivery; repair owned deployment drift | This audit, preserved recovery hold and privacy decision | Synthetic two-root, two-surface flow with complete expected-ID reconciliation through a disposable backend |
| 2. `goals/harness-telemetry-enrollment` | Qualify every requested harness/surface and all declared hosts/clones/worktrees against the same contract | Foundation event/receipt schema and qualified intake | Seven-harness capability matrix with explicit supported/unsupported routes and per-route receipts |
| 3. `goals/agent-outcome-experiments` | Make telemetry understandable through outcomes, annotations, curated datasets and controlled experiments | Foundation identity/coverage; enrollment proof for routes included in each comparison | Five curated task examples, versioned deterministic rubrics and a usable task-outcome view |

Preparation can proceed in parallel. Production enrollment waits for foundation qualification. Comparative experiments wait for coverage/semantic qualification of their participant routes. No other goal packet is promised by this exploration; later expansion is work inside these packets, not a silent unbounded rollout.

## Capability check

| Component | Existing capability to compose | Replacement / net-new work |
| --- | --- | --- |
| Root identity and config | `packages/tooling/library/ai-metrics/src/identity-registry.ts`, `forwarder.ts`; existing bounded snapshots and salt guards | Fleet inventory/leases and source-root provenance; NET-NEW expected-route/launch reconciliation |
| Source ingestion | `internal/transcript-utils.ts`, `internal/jsonl-discovery.ts`, `ingest.ts`, `derived-storage.ts` | Fair persistent cursors, rotation/partial-line handling, error states; replace cwd attribution and newest-N starvation |
| Delivery | `otlp.ts` stable IDs, chunk acknowledgments, pending watermarks | NET-NEW explicit receipt state projection and native durable intake; fix historical timing, tested replay bounds |
| Hooks and managed harnesses | Existing hook-pulse evidence and `packages/drivers/ai-provider-cli/src/AiProviderCliSession.profile.service.ts` | Preserve intended telemetry in bounded child environments; missing provider/surface adapters NET-NEW |
| Phoenix access | `packages/drivers/phoenix/src/Phoenix.service.ts` and models/config | Versioned adapters for actual 20.23.0 operations; no new catch-all SDK wrapper |
| Effectiveness semantics | `packages/tooling/library/ai-metrics/src/agent-effectiveness.ts` and existing goal `agent-effectiveness-loop` | Reconcile rather than duplicate its bundle/dataset/rubric concepts; NET-NEW task/outcome receipts where absent |
| Host deployment | dankserver `ansible/roles/monitoring`, `phoenix`, backup roles and group vars | Restore deployed label-collision transform to source, durable spool, collector health, exact retention proof and canary routing |
| Human organization | Phoenix sessions, annotations, datasets, experiments and dashboards | NET-NEW minimal coverage/task report if native UI cannot express required uncertainty; avoid a second general tracing UI |

## First vertical slice

1. Freeze the audit evidence and historical IDs; retain the recovery hold.
2. Reproduce the current failure mechanics with synthetic fixtures: two roots sharing Codex home, sibling Claude directories, copied/moved session, N+1 scan, unreadable subtree, old timestamps, partial OTLP responses and crash-after-ack.
3. Define typed metadata envelope and mutually exclusive delivery-state projection; keep receipt facts append-only.
4. Prove local native intake and fallback parsing into a bounded sanitized journal, then a disposable collector/Phoenix backend. No original raw archive or real task payload enters the fixture.
5. Show explicit coverage and correct native token/cache totals for one CLI and one desktop-marked fixture. Then qualify a real supported route with a marked canary under the future implementation contract.
6. Prepare rollback, bounded cutover and a small live enrollment before fleet expansion. Gate recovery-hold release on its actual integrity evidence, not green unit tests alone.

## Gates and inherited risks

- No root/file/session denominator conflation; no unverified all-fleet completeness badge.
- No broad trace-filter removal or unbounded historical replay; scheduled backup outages and pre-intake SDK buffering are distinct loss windows.
- Preserve a versioned bridge for old IDs; do not relabel historical records with current roots/config/model identity.
- Keep native and reconstructed streams correlated without double-counting; ambiguous correlation stays unresolved.
- Store task outcomes outside short Phoenix trace retention, with expiration-aware links.
- Keep API pricing, subscription allocation and billing separate; no new spending route.
- Validate all backend writes and UI projections against actual deployed API/schema.

## Graduation check

Brief contains problem, appetite, sketch, no-gos and rabbit holes. Operator approved direction and collection policy. This map names the three packets, dependencies and first slice. Every major component above cites an existing capability or is explicitly NET-NEW. Deferred details are proof tasks in the packets, not hidden blocking product decisions.
