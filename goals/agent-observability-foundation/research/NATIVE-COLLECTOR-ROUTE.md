# Projected native traces through the collector — 2026-10-28

## Routing defect and current source

The foundation's native exporter emits normalized `agent.llm`, `agent.tool` and
other `agent.*` names. The legacy collector's `claude_code.*` / `ai_metrics.*` /
`handle_responses` filter would silently exclude that output. Its newly added
persistent queue was also still connected directly to raw harness intake.

The owned dankserver template now separates the paths:

1. Raw harness traces must enter the foundation worker's positive metadata
   projection and journal. This boundary removes content before durable storage.
2. The worker's encoded `native-export/v1` output enters collector `otlp/metadata`
   on internal port 4319. This port is not published by production Compose and
   has no managed tailnet route yet. The raw 4318 receiver serves metrics only;
   `/v1/traces` there returns 404 in the exact-image test.
3. A collector route guard checks the fixed worker service/scope/version, native
   stream and normalized span-name domain. Nonconforming spans are filtered and
   counted. They can receive transport success despite exclusion, so the new
   alert detects this condition. The guard is **not authentication or a positive
   metadata sanitizer**. Private network access and owned worker composition are
   still deployment requirements; arbitrary clients must not be enrolled here.
4. Project stamping, the persistent queue and Phoenix delivery follow. The
   worker queries the explicitly bound Phoenix origin separately from the export
   origin and records visibility only after exact reconciliation.

No live configuration changed. This source topology is a coordinated migration,
not a drop-in update: all declared existing raw trace producers need route and
coverage evidence before enabling it. Applying the new template first would
break their old trace endpoint. Preserve captured live configuration and pending
queue data for rollback. The existing metrics path, including its OS-label
collision repair, remains separate; its positive label/privacy policy is not
established by this trace proof.

## Actual end-to-end proof

`ops/verify-native-collector-route.py` creates uniquely named disposable Phoenix
and collector containers on their own Docker bridge network. All published
fixture endpoints bind only to 127.0.0.1. This is not an egress-isolated network:
an initial internal-network attempt could not publish its test ports, so it was
removed; no claim of network egress denial is made. The synthetic images have no
credentials, Phoenix telemetry/assistant/sandbox integrations are disabled, and
all destinations are created and owned by the fixture.

The proof uses the exact cached digests for Phoenix 20.23.0 and collector 0.163.1.
It inspects real Docker configuration for read-only roots, dropped capabilities,
one CPU and 128 processes each, 2 GiB Phoenix / 512 MiB collector memory and no
additional swap. The projection/journal/sender/read-back fixture runs as a bounded
systemd process (768 MiB, zero additional swap, one CPU, 128 tasks, sixty-second
runtime limit). No deliberate OOM is involved.

Three synthetic observations cover complete Claude usage, complete OpenInference
usage and incomplete Claude usage. The input includes private-content markers in
resource/schema URLs, scope identity, trace state, status text, events,
exceptions, links, session, prompt, response and tool data. The existing positive
projector and native encoder remove these fields before collector delivery.
After sender/read-back completion and normal collector shutdown, the test checks
that no private marker appears in the SQLite journal, bbolt queue file or Phoenix
response. It verifies all three exact trace/span/event/session identities,
normalized kinds/names, source nanoseconds, microsecond backend time columns,
complete token totals (130 prompt + 5 completion = 135), and absent prompt/total
for incomplete Claude usage. Accepted-unverified transitions to visible only via
backend reconciliation.

A deliberately unprojected span on the internal metadata route is filtered and
increments the actual collector filter counter. It does not appear among the
three Phoenix records. A separate request confirms that the old raw trace path
returns 404. These are distinct refusal/exclusion semantics, not universal
HTTP-success delivery proof.

The final fixture passed and verified cleanup of its two containers, network and
worker process. Receipt: `ops/native-collector-route-verification.json`. The
fixture is synthetic source projection plus actual journal/export/query calls;
it is **not** actual Codex/Claude/desktop enrollment or a production listener
qualification. Those remain full-SPEC work.

## Related verification

- Six collector tests passed after the topology change (24.359 seconds),
  including queue/file-capacity refusal and exact identity crash replay.
- Ten promtool scenarios pass, adding observable excluded native-route spans to
  the earlier healthy/missing/failure cases. Nine managed alert rules now exist.
- Monitoring Ansible syntax passes, including the required new alert name.
- Full ai-metrics package verification passed: audit 119.8 seconds, docgen 11.1
  seconds. That job ran inside `agent-runs.slice` with its own resource limits.
- The original held forwarder and historical data remain untouched.

## Next integration requirements

Implement the owned runtime and route enrollment with explicit source host,
harness/surface, task/session and expected-event populations. Choose and qualify
how the worker reaches the private metadata receiver; a producer claim or route
guard is not authority. Complete bounded scheduling/retries, metrics-label policy,
health/lag/source reporting, backup-generation lifecycle, actual CLI and desktop
fixtures, bounded live route/read-back and rollback. Preserve the entire goal,
including mandatory review panel and repository delivery. The new route proof
supersedes the old topology, not these remaining requirements.

The immediate next implementation slice is automatic bounded work selection and
runtime scheduling. The current proof explicitly invokes send and read-back for
known receipt IDs. A production runtime must discover durable pending receipts
and attempts after restart, apply bounded/fair retry and reconciliation policy,
and report inactivity versus stopped progress without an unbounded in-memory
queue. This remains required work; the manual fixture is not its implementation.
