# Trustworthy agent observability foundation

## Status

Lifecycle: `active`

Explicitly launched by the operator on 2026-10-27. Source: [manifest](./ops/manifest.json). Implementation is in progress in the dedicated foundation worktree. The original forwarder service and timer remain masked and inactive.

## Mission

Prove metadata identity, coverage and bounded durable delivery across roots and surfaces before live enrollment.

## Launch

Only on an explicit implementation launch, use:

```text
/goal follow the instructions in goals/agent-observability-foundation/GOAL.md
```

## Read This First

1. [SPEC.md](./SPEC.md) — normative scope and proof.
2. [PLAN.md](./PLAN.md) — phased implementation and dependencies.
3. [GOAL.md](./GOAL.md) — compact launcher.
4. [Sources](./research/SOURCES.md) — inherited audit evidence and provenance.
5. [Source exploration](../../explorations/agent-observability-rebuild/README.md).

## Current Phase

P0/P1 active. Timing, scan-starvation and false source-attribution regressions were reproduced and repaired. The typed inventory preserves unknown populations. Synthetic incremental readers, metadata intake/journal, delivery/read-back, expiry, reversible evidence retirement and paused worker composition have verification evidence. An actual process proof now covers enforced resource limits, exclusive journal ownership, HTTP deadlines and receipt replay after an OOM restart. Independent physical backup/restore is also proven against synthetic corruption and process crashes. Bounded streaming discovery is verified on synthetic roots. Native collector queue persistence, capacity refusal, crash replay and self-metrics alerts are also proven locally; see [queue and health evidence](./research/COLLECTOR-QUEUE-HEALTH.md). The sanitized native journal-to-collector-to-Phoenix route is proven locally; see [route evidence](./research/NATIVE-COLLECTOR-ROUTE.md). Durable native scheduling now has focused recovery tests; see [scheduling evidence](./research/NATIVE-SCHEDULING.md). Scoped native cadence and content-free health gauges are also verified; see [runtime health](./research/RUNTIME-HEALTH.md). The actual private worker entrypoint now has synthetic startup/restart and ownership proof; see [entrypoint evidence](./research/WORKER-ENTRYPOINT.md). Explicit source cadence and truthful per-traversal read health now have synthetic proof; see [source cadence](./research/SOURCE-CADENCE.md). Shared reconstructed delivery now has synthetic sender/read-back and actual-entrypoint proof; see [reconstructed delivery](./research/RECONSTRUCTED-DELIVERY.md). Both streams are now qualified through the pinned disposable collector/Phoenix images, including actual aggregate-query interpretation; see [mixed route evidence](./research/MIXED-COLLECTOR-ROUTE.md). Independent population comparison now has a read-only inventory command and a report backed by the retained native Phoenix proof; see [coverage reconciliation](./research/COVERAGE-RECONCILIATION.md). A private metadata-only launch endpoint now has actual-entrypoint restart and receipt replay proof for CLI/desktop-marked fixtures; see [private launch transport](./research/PRIVATE-LAUNCH-TRANSPORT.md). The private context/client now verifies destination and exact receipts through that worker across controlled restart; see [client verification](./ops/launch-client-verification.json). Managed adapters now expose actual child and validated-session evidence with failure cleanup, and a synthetic native child is joined to native telemetry in the worker proof; see [managed evidence](./research/MANAGED-LAUNCH-EVIDENCE.md). Independent launch claims now prevent duplicate attempts across producer failure and collector restore; see [claim recovery](./research/LAUNCH-CLAIM-RECOVERY.md). The same owner now retains immutable lifecycle observations and recovers lost acknowledgments across producer/worker restart; see [outbox recovery](./research/LAUNCH-OUTBOX-RECOVERY.md). The existing managed serve command now has opt-in owner-bound enrollment, local callbacks and conservative process closure; see [managed owner enrollment](./research/MANAGED-OWNER-ENROLLMENT.md). Real harness enrollment and end-to-end production coverage remain open. Backup generation policy, production service/frontend installation and external health publication, live collector/Phoenix enrollment, live discovery enrollment and identity reconciliation, health/deployment and repository delivery remain open. The later bounded live canary is qualified separately below; it does not establish real harness coverage. Dependencies: none beyond source exploration.

## Latest Evidence

Independent worker health now has a source-bound disposable proof: a separate
Prometheus scrape observes the actual worker and delivers a stopped-worker alert
to a local test receiver after controlled shutdown. Owned monitoring templates
and disabled-by-default enrollment cover stale observers, missing declared sources,
sampled delivery lag, refusals and journal filesystem pressure. See
[independent health](./research/INDEPENDENT-HEALTH.md). The refreshed full
AI-metrics package gate passes; broader review and repository delivery remain open.

The October27 audit is design provenance, not this goal's completion proof. See [implementation evidence](./research/IMPLEMENTATION.md) for current proof and remaining work.

The real managed-owner command now has synthetic paused-capture and restarted-collector recovery proof, plus bounded operator status/reconcile commands; see [managed-owner recovery](./research/MANAGED-OWNER-ENROLLMENT.md). This does not establish live harness coverage or complete the broader CLI gate.

Explicit initialize-claims/enroll commands now create the managed-owner enrollment used by the actual command proof; see [provisioning evidence](./ops/managed-owner-provisioning-verification.json). Independent population publication and operational claim-store recovery remain open.

Independent managed-owner claim cohorts now have a human/JSON population command
with actual synthetic paused-intake and recovery proof; see
[population publication](./research/CLAIM-POPULATION-PUBLICATION.md).
Operational claim-store recovery, broad CLI and live qualification remain open.

The actual command disaster rehearsal now refuses missing, quarantined stale and
torn claim stores without launching or repairing them; see
[disaster rehearsal](./research/CLAIM-STORE-DISASTER-REHEARSAL.md).
The live workstation root probe also captured 27 present Git roots and one
unreachable declared path, while leaving all seven harness routes unqualified;
see [workstation inventory](./research/WORKSTATION-ROOT-INVENTORY.md).

Live Phoenix now has verified purpose descriptions on all three existing projects,
with matching idempotent dankserver tasks. Both explicit seven-day and unfiltered
aggregate counts are retained in [live project evidence](./research/LIVE-PHOENIX-PROJECTS.md).
This metadata-only update does not qualify collection coverage or the full rollout.

The existing install command now renders bounded replacement worker and intake
units. Actual installed-unit qualification covers the bundled entrypoint, paused
startup, private-control isolation and checksum refusal; see
[deployment proof](./research/OBSERVATION-DEPLOYMENT.md).
The bounded live backend canary now passes through an isolated collector, with exact
event identities, worker visibility receipts and stopped-route rollback; see
[live canary evidence](./research/LIVE-CANARY.md). Production storage/health ownership,
full acceptance review and repository delivery remain open.


### Private maintenance and replay corrections (2026-10-29)

The installed worker now exposes bounded private maintenance through the shared
paused control boundary, with target/process context selection, fixed create-only
backup generations and explicit expiry/retirement restoration. Actual installed
proof covers timeout/concurrency/refusal and restart identity; the current full
AI-metrics package gate and scoped CLI compilers/tests pass. See
[private maintenance](./research/PRIVATE-MAINTENANCE.md). Qualified replay now
stops after a later permanent refusal while preserving earlier uncertainty, and
the refreshed backend receipt separates sender attempts from upstream submissions.
Whole-CLI quality, remaining review findings, exact-head repository delivery and
closeout remain open. Historical evidence retains its original scope and date.


### Visible synthetic surfaces and precise read-back (2026-10-29)

CLI/desktop-marked proof records now survive privacy projection as explicitly
synthetic names and finite attributes. A refreshed two-record tailnet canary
verifies both records and local visibility receipts, then rolls back its owned
route while preserving evidence. That proof exposed and repaired a Phoenix
microsecond-rounding mismatch; exact source times, point-event shape and endpoint
order remain mandatory. Full AI-metrics package and scoped CLI verification pass,
and independent review accepted the focused delta. See
[synthetic surface evidence](./research/SYNTHETIC-SURFACE-LABELS.md). Real harness
enrollment, remaining review items and repository delivery/closeout remain open.


Current reliability delta: durable per-event query backoff survives scheduler
reconstruction and interrupted/failed read-back, while preserving qualified
replay requirements. Full AI-metrics audit/docgen pass; see
[query pacing](research/QUERY-BACKOFF.md) and
[source-bound verification](ops/query-backoff-package-verification.json).
The legacy forwarder service/timer remain masked and inactive. Installed proof also passes with two synthetic labelled records, confirmed worker
visibility, clean owned-unit rollback and retained evidence. See
[installed receipt](ops/query-backoff-live-verification.json). Whole CLI,
remaining panel findings and delivery remain open.


Latest acceptance corrections: capacity-aware retirement is package-verified and
installed-proof qualified; legacy disposition migration remains held. The collector
now preserves its legacy route by default and has synthetic cutover/reversal proof
([migration](research/COLLECTOR-MIGRATION.md)). Actual changed-epoch replay keeps
one original Phoenix row; exact read-back conservatively leaves the later local
observation unverified, with explicit expiry accounting
([epoch qualification](research/EPOCH-BACKEND-QUALIFICATION.md)). Full CLI ended
in a runtime abort and remains a failed gate. Current review and repository
delivery/closeout remain required; no production enrollment or hold release.
