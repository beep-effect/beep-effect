# Native collector persistence and health checkpoint — 2026-10-28

The later [native route checkpoint](NATIVE-COLLECTOR-ROUTE.md) supersedes the raw trace intake topology described here. This report retains the initial queue proof and its limitations.

## Finding and implementation

The managed native collector template previously had no persistent exporter
storage, no explicit exporter capacity/retry policy, and no managed scrape of its
own telemetry. The trace pipeline's asynchronous batch processor could return
before durable admission. The existing harness metrics scrape (`openclaw`) cannot
prove that trace collection is alive or complete.

The owned dankserver branch now defines:

| Surface | Contract |
| --- | --- |
| Queue | Native Phoenix exporter only; 16 MiB serialized-byte capacity, one consumer, nonblocking overflow refusal |
| Storage | Private bind mount below monitoring data root, UID/GID 10001, mode 0700; one 64 MiB-capped bbolt file; fsync enabled |
| Recovery | Persistent exporter/storage IDs; no automatic corrupt-store recreation or compaction; keep files on failure and rollback |
| Retry | Ten-second request timeout, transient retries from one to thirty seconds with no elapsed-time expiry; permanent failures remain possible |
| Intake | Remove asynchronous trace batching before storage; preserve existing filtering, scrubbing, project stamp and independent metrics batching |
| Process | Compose 512 MiB memory/no additional swap, one CPU, 128 processes, read-only root, no capabilities, no new privileges; logs capped at three 10 MiB files |
| Self-metrics | Internal port 8888, separate `otel-collector` Prometheus scrape; no host publication |
| Alerts | Missing/down scrape, missing queue instrumentation, high/nonempty queue, enqueue/receiver/export failures and filesystem pressure |
| Deployment checks | Verify actual bind mount/user/resource ceilings; require healthy Prometheus scrape and the expected queue capacity; require new alert names loaded |

Queue bytes, physical database bytes and process memory are different bounds.
The file cap covers the single configured database, not an arbitrary future set
of exporters, backup generations or logs. Compaction/recreation are disabled to
avoid extra temporary or renamed stores. The backup service runs as root and
already includes the monitoring data root; a successful production queue restore
still requires its own rehearsal.

## Actual proof

The exact cached collector image was used:
`otel/opentelemetry-collector-contrib:0.163.1`, digest
`sha256:1175b03003053962012f5a231f5567f66a3e8fdb960c7835c0e48f7aa1555806`.
Its `validate` command accepts the complete rendered production configuration,
including the file-size cap. The preserved three-resource Prometheus collision
and email-scrub fixture passes.

Two disposable queue fixtures use a synthetic loopback OTLP receiver. All
collector endpoints bind to loopback in the host-network fixture. A private
calling-user-owned temporary directory substitutes for production UID 10001;
the read-only root, 512 MiB/zero-extra-swap, CPU and process bounds still apply.
No historical source, credential, live endpoint or real prompt is involved.

- Queue-capacity fixture: lower only the queue capacity to 4096 bytes. Four
  acknowledged spans survive SIGKILL/restart and drain when the backend recovers.
- Disk-capacity fixture: lower only the database limit to 65536 bytes. Eighteen
  acknowledged spans survive the same restart; the file remains within its cap.
- Both require real HTTP refusal at exhaustion, observable enqueue and receiver
  refusal counters, the exact decoded trace/span identity set at the sink, no
  refused identity, preserved project stamp and removed synthetic email markers.
- Both additionally accept a span locally while the synthetic backend rejects it
  permanently, and require the exporter failure metric. Intake success is not
  backend success. Queue capacity is observable even before any source activity.
- No OOM exercise is used. Owned containers are removed and absence checked.

The final six-test monitoring suite passed in 22.252 seconds. This includes
`promtool` evaluation of nine healthy/failed/missing/backlogged scenarios and
syntax checking all rendered alert groups. Local promtool is 3.15.1; production
Prometheus is pinned to 3.15.0, so this is not exact-image Prometheus runtime proof.
The monitoring Ansible playbook syntax check also passes. The current receipt and
source fingerprints are in `ops/dankserver-verification.json`.

Early fixture failures were corrected rather than treated as infrastructure
proof: the Docker local logger requires more than one file when compression is
enabled; internal telemetry starts before intake; protobuf field order is not
fixed. The final identity check decodes nested OTLP fields rather than searching
for adjacent byte strings. An initial successful byte-search fixture was weaker
than the final exact identity proof and is superseded.

## Boundaries and next work

This is un-deployed source and synthetic proof. A test receiver acknowledgment is
not Phoenix persistence/read-back. There is no exactly-once claim: lost replies
and restoring older queue snapshots can duplicate exports. Permanent responses
can discard data; the queue has no per-event dead-letter receipt ledger. The
foundation journal/read-back machinery remains necessary for stronger claims.

The legacy collector's email scrub is not a positive metadata allowlist. Its
remaining payload/privacy boundary must be qualified before enrolling this disk
queue against real traffic. The current branch is not a deployable approval to
persist raw harness payloads. Source/host/task identity, actual event lag and
missing-source detection still require the declared inventory and expected-event
population. Nonempty-queue duration is explicitly not oldest-event age. Rules
alone do not prove operator notifications: managed Alertmanager/Grafana contact
routing remains open.

Before any deployment: complete metadata-boundary integration, captured live
parity, backup/restore, storage/retention disposition, one CLI and desktop proof,
bounded actual route canary/read-back and rollback. Preserve the original masked
forwarder and historical stores. Keep exporter/storage IDs stable and never
clear queued data to fix an alert. Rollback pauses enrollment and preserves the
stopped queue plus captured config; inspect pending data before resuming or
replaying. No live queue, route, service or retention policy changed here.

## Primary reference checks

The version-tagged source URLs returned 404 through the browsing tool. Current
upstream documentation was used as guidance, with compatibility decided by the
actual pinned binary and restart tests:

- [Exporter helper queue and retry contract](https://raw.githubusercontent.com/open-telemetry/opentelemetry-collector/main/exporter/exporterhelper/README.md)
- [File storage extension](https://raw.githubusercontent.com/open-telemetry/opentelemetry-collector-contrib/main/extension/storage/filestorage/README.md)
- [Collector internal telemetry](https://opentelemetry.io/docs/collector/internal-telemetry/)
