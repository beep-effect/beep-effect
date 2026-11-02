# Independent observation health qualification

The worker's private metrics now have a separate, bounded observer owned by the
dankserver monitoring role. It makes one GET `/metrics` over the declared private
Unix socket, projects fixed metric names and enumerated labels, and independently
measures the filesystem containing the journal directory. It never opens journal
rows, source files, credentials or control routes. Unknown source coverage remains
unknown. A failed worker probe replaces old worker samples with `worker_up=0`;
an observer that stops publishing leaves a timestamp that independently becomes
stale. Disk observations continue when the worker is unavailable.

The textfile is atomically replaced for an existing node_exporter scrape. The
snapshot has a 32 KiB input bound, two-second socket timeouts and a five-second
whole-program deadline. The optional role renders a separate 15-second timer and
an eight-second oneshot service with 64 MiB memory, zero swap, eight tasks and a
64 KiB per-file ceiling. It is disabled by default, requires explicit same-host
paths and the root identity that owns the existing textfile directory, and installs no
new worker or source. Disabling enrollment stops/disables the owned timer while
preserving snapshots and configuration. No current host enrollment was applied.
Other identities are explicitly refused; the role does not broaden access to the
shared textfile directory. Independent review caught and corrected the earlier
configurable-identity assumption before deployment.

The conditional Prometheus rules cover missing/stale observer, unreachable
worker, degraded runtime, independently expected but unconfigured sources,
unavailable roots/read failures, sampled acceptance-age lag, intake refusals and
journal filesystem pressure/probe failure. Healthy idle is a distinct quiet
case. Historical source age is not the delivery-lag threshold. Neither pass-age
maxima nor root counts are fleet denominators. Counter resets and the pre-intake
loss window remain explicit; counters are response decisions, not lost-event
counts. No raw dead-letter store or replay permission is introduced.

## Verification

- `ansible/roles/monitoring/tests/test_observation_health.py`: four passing
  Python tests, including an actual Unix-socket exchange, stopped-worker and
  filesystem-failure observations, metadata rejection, atomic replacement, and
  eleven promtool scenarios against rendered rules, including intermittent high
  lag samples separated by missing/zero samples. Existing collector alert tests
  remain passing.
- Rendered service/timer verification exits zero. The local systemd verifier
  also reports an unrelated unreadable `semantica-secure.service`; this is not
  claimed as validation of that unrelated unit. Ansible task/settings YAML parses.
- `ops/history/independent-health-verification.json`: fresh actual installed worker and
  frontend proof with the current bundled worker, independent Prometheus 3.15.1,
  an actual metrics scrape, controlled worker shutdown and receipt of
  `BeepObservationWorkerUnavailable` at a disposable local Alertmanager-v2 API
  receiver. The actual rule retains its one-minute pending period. Probe and
  rule hashes remain unchanged through qualification. The monitor and both owned
  worker/frontend processes stop; only the two exact proof unit files are removed.
- The first attempt checked for a scrape before Prometheus had discovered its
  target. It failed, cleaned up and retained its incomplete receipt. The verifier
  now waits a bounded 15 seconds for a positive scrape. An intermediate success
  overlapped a source validation edit and is not the final source-bound proof.
- `ops/review-health-package-verification.json`: the full AI-metrics package
  audit and docgen gate pass after the multi-event order, source-age boundary,
  refusal instrumentation and fixture serialization corrections. The guard
  observed 5,873,324,032 bytes peak and at least 35,363,774,464 bytes host headroom,
  with no forced stop or additional allowed swap.
- `ops/review-health-cli-verification.json`: scoped tsgo and tsrs checks plus
  28 CLI tests pass with 2,530,803,712 bytes observed peak. This is not the broad
  CLI package gate.
- `ops/history/independent-health-archive.json`: all 19 regular files from the final
  proof were copied, hash-compared and synced into the private same-host proof
  archive (53,484,755 bytes). This is not off-device recovery. The archived worker
  bundle was deliberately modified after shutdown for checksum-refusal proof
  and must not be restarted.

This proves the independent alert path in a disposable deployment. It does not
claim a production observer, remote workstation scrape, real-source enrollment,
or delivery to a human notification channel. The existing recovery-held forwarder
service and timer were freshly checked masked/inactive. Remaining review,
acceptance adjudication and repository delivery gates remain open.

## Credential and atomic-pause refresh — 2026-10-29

The current installed entrypoint was rebuilt after the credential isolation and
atomic-pause repairs. `ops/history/credential-health-installed-verification.json` proves
its actual private scrape and stopped-worker alert through the independent
monitor, plus positive environment isolation, a non-minimum journal budget and
four malformed-credential startup refusals. The monitor and worker/frontend
processes were stopped and the exact owned service files removed. The retained
same-host copy is described by `ops/history/credential-health-archive.json`; it is not
an off-device backup, and its integrity-test-tampered bundle must never be run.
The prior independent-health receipt remains historical evidence for its earlier
source snapshot. Root timer/node_exporter enrollment and human notification
qualification are still outside this bounded canary-stage proof.
