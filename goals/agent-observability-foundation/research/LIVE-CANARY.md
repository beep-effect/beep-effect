# Bounded installed-worker to tailnet Phoenix canary

The bounded live route passed on 2026-10-28 at approximately 23:45 CDT. This is
synthetic metadata sent to the actual deployed Phoenix application. It is not
real harness enrollment, complete fleet coverage, or a production collector rollout.

## Actual route and boundary

Two synthetic AGENT records with separate CLI/desktop-marked source session names
entered the installed loopback Caddy frontend, then the bundled worker's private
Unix socket. The worker positively projected metadata, persisted its journal,
and scheduled OTLP through an isolated collector rendered from the owned dankserver
template. That collector exported over verified HTTPS to the tailnet Phoenix.
The worker independently queried that backend and recorded two positive visibility
receipts. The source session names are synthetic labels, not evidence of actual
CLI/desktop application instrumentation.

The exact-image collector preserves the template's private projected receiver,
filter, queue storage identity, fsync, byte/file bounds, label-collision repair and
self-metrics. The explicit configuration differences are the dedicated canary
project, HTTPS endpoint and a 30-second exporter retry window. Its memory ceiling
is 512 MiB, extra swap is zero, CPU is one core, and task limit is 128. Only
loopback receiver/self-metric ports are published. An independent user timer
stops its exact container ID after 150 seconds even if the verifier exits.

The worker/frontend retain the installed proof's 512/128 MiB ceilings, zero extra
swap, finite lifetimes, checksum verification, private controls and paused startup.
No raw source paths, provider credentials or historical stores are enrolled.
The single producer POST is not retried after ambiguity. Its empty successful
OTLP response is only the intake acknowledgment; exact local and backend event
sets plus the worker's visibility receipts supply the stronger delivery evidence.

## Evidence and failure retained

- [Successful installed proof](../ops/history/live-canary-installed-verification.json):
  two backend records, exact source nanoseconds, separate hashed sessions, matching
  event IDs and two worker visibility receipts. Synthetic private input/name text
  and original session strings are absent from the backend response.
- [Initial failed canary](../ops/history/live-canary-dns-failure.json): the collector
  accepted two records but failed delivery; the project remained absent during
  bounded read-back. Preserve the journal and queue rather than claiming success
  or repeating the producer request.
- [Private evidence archive manifest](../ops/history/live-canary-evidence-archive.json):
  both runs copied outside temporary storage, every file hash compared, files and
  directories synced. This is a same-host retention copy, not off-device backup.

The failed route exposed a network-namespace difference. Host Phoenix health was
reachable, but a bounded probe inside the pinned Phoenix image on Docker's default
bridge failed hostname resolution. The host-resolved tailnet address pinned with
Docker's per-container host mapping made the same HTTPS health probe return 200.
TLS verification was never disabled. The successful collector uses that isolated
mapping; no machine DNS, firewall or deployed collector setting changed.

The new project is `foundation-canary-662884114b02`, with a verified description
identifying its synthetic purpose and limited coverage. The earlier failed attempt
used different identities and did not create its project during the observation
window. Its retained records were not replayed. Existing projects and their records
were not deleted or rewritten. Canary retention remains under the deployed policy;
this proof does not claim a new project retention assignment.

## Rollback actually executed

The successful worker was paused, and a subsequent intake request returned 503.
Stopping the worker stopped its dependent frontend. Both processes had MainPID=0;
only the exact installed unit files were removed. The collector was stopped,
confirmed not OOM-killed, and removed; its 32 KiB queue file was retained. The
independent expiry guard was stopped and released. A fresh backend query after
cleanup still returned exactly the same two event IDs. A subsequent service and
container inventory found no owned canary resources running or loaded.

The installed proof also deliberately modified its bundle after shutdown to prove
checksum refusal without journal changes. Its archived bundle therefore contains
that deliberate tamper suffix and is not a ready-to-run deployment artifact.
The receipt separately records the original verified bundle digest. Rebuild from
the recorded source for a future installation; do not blindly restart archived units.

The historical forwarder service and timer remain masked/inactive. The current
boot still has only the two previously documented service-local OOM events; this
canary did not run a deliberate exhaustion scenario or add an OOM kill.

## Reproduction and remaining scope

Use system Python with the existing Jinja2/PyYAML dependencies:

```text
/usr/bin/python goals/agent-observability-foundation/ops/verify-observation-deployment.py \
  --workspace <foundation-worktree> --caddy <checksum-pinned-caddy> \
  --dankserver <dankserver-foundation-worktree> --live-canary
```

This explicit option makes a new bounded live mutation; do not rerun it as a
routine unit test. Omitting it retains the local installed-unit proof behavior.
This milestone does not replace the broader CLI gate, required review panel,
operational storage/health ownership evidence, or repository delivery and closeout.
All SPEC acceptance items still require a requirement-by-requirement audit before
claiming the foundation complete.
