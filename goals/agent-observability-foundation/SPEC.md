# Trustworthy agent observability foundation — specification

## Objective

Prove metadata identity, coverage and bounded durable delivery across roots and surfaces before live enrollment.

## Source hierarchy

User decisions and AGENTS.md govern; then architecture standards, this SPEC, PLAN, GOAL and research evidence. [Adopted brief](../../explorations/agent-observability-rebuild/BRIEF.md) and [decisions](../../explorations/agent-observability-rebuild/DECISIONS.md) are design provenance. Do not treat audit observations as immutable live state.

## Target surfaces

- packages/tooling/library/ai-metrics
- packages/tooling/tool/cli AI metrics and hook evidence integration
- packages/drivers/phoenix where the existing driver needs bounded query support
- dankserver monitoring/Phoenix Ansible and tests, with owned deployment parity

## Scope and constraints

This packet was explicitly launched by the operator on 2026-10-27 and is active. Preserve unrelated local work, existing source identities, the masked collector recovery hold and historical archives. Metadata plus curated sanitized examples is the approved collection boundary. Use schema-first Effect code, existing drivers/tooling and architecture observability conventions. Source changes and deployments must have owned tests and rollback. Existing subscriptions only; no new paid endpoints, quota purchases or automatic broad judge runs. Do not revive retired OpenClaw.

Do not infer that an enum, installed app, green service, transport acknowledgment, query result or canary proves every activity source was captured. Unknown and intentionally excluded populations remain explicit. Keep code fixtures synthetic and disposable; do not use real prompts or secrets to make tests convenient.

## Non-goals

- Big-bang replacement, indiscriminate raw transcript collection, or immediate mass backfill.
- New generic tracing UI, one Phoenix project per worktree, or universal productivity scores.
- Claiming deployment or goal completion from packet authoring or local tests alone.
- Deleting user data, removing recovery material or changing protected credentials as a shortcut.

## Acceptance criteria

- [ ] Publish a typed host/root/route inventory with separate capability, known-launch and expected-event denominators; unsupported/excluded/idle/stale/failed/unknown states are distinct.
- [ ] Preserve repository, clone, worktree, source session, task, attempt and event-occurrence identity separately; global Codex inputs never inherit the ingestion checkout as asserted source identity.
- [ ] Prove fair incremental discovery for N+1 sources, rotation/truncation, partial lines, copied files, oversized growth, retired worktrees and permission errors with synthetic fixtures.
- [ ] Prove event-time preservation and absence of invented durations through actual encoded OTLP, including historical replay and mixed timestamp offsets.
- [ ] Prove a bounded metadata-only native intake and journal; document the exact upstream acknowledgment boundary and pre-intake loss window.
- [ ] Derive one mutually exclusive delivery state per event from append-only receipt facts; test partial success, lost acknowledgment, crash-after-acceptance, restart, duplicate send, queue exhaustion and reclamation.
- [ ] Normalize Claude/native usage into Phoenix fields with a provider-specific cache fixture; reconcile encoded records, stored queries and UI/API totals without double counting.
- [ ] Preserve deployed transform/prom-label-collisions in dankserver source; qualify the rendered configuration before applying any deployment.
- [ ] Provide owned persistent queue bounds and health signals for lag, refusal, failed delivery, disk pressure, missing sources and missing collector self-metrics; distinguish healthy idle from stopped collection.
- [ ] Fix health-check path and backup/retention reporting weaknesses with synthetic tests; verify exact policy identity and project assignment, not the first policy returned.
- [ ] Keep the historical recovery hold intact until its resource-integrity investigation and bounded replacement proof support release; no blind restoration of old units.
- [ ] Qualify one declared host/repo with one CLI and one desktop-marked fixture against a disposable backend, then a tightly bounded canary/live route with rollback. Never claim every real session was captured.
- [ ] Record privacy/retention/dead-letter ownership, old-ID compatibility, project producers and a tested rollback. Preserve historical raw archives without reingesting them by default.

## Dependencies

Source exploration only.

For downstream work, only already-qualified routes may be used. Design/calibration fixtures can progress before full fleet enrollment; real comparisons cannot imply unqualified coverage.

## Verification matrix

| Gate | Evidence | Required result |
| --- | --- | --- |
| Packet | JSON, links, launcher <=4000 chars, no placeholders | Pass |
| Domain proof | Synthetic source/identity tests; fixed-clock actual-encoder fixture; receiver/journal/partial-ack crash tests; disposable collector/Phoenix read-back; Ansible render and backup/retention mocks; touched-package quality verification. No production disruption as a test. | Assigned acceptance demonstrated |
| Privacy | Allowlisted metadata/curated-example review and rejected-field fixtures | No raw content or secret leakage |
| Deployment | Render parity, bounded route canary, read-back, resource ceilings and rollback | Evidence identifies actual routes and receipt boundary |
| Repository quality | Required touched-package verification and Yeet/hosted gates | Current repo policy satisfied |
| Closeout | Final delivery PR readiness/merge evidence and reflection | Only then completed-retained |

## Stop/hold conditions

Missing source access remains an explicit coverage gap; do independent synthetic/design work. Hold dependent rollout on unproven integrity, identity, privacy or resource bounds. Uncertain mutation outcomes must be inspected before replay. New spend requires the operator. Preserve interrupted work and record concrete blockers; do not weaken authentication or data boundaries.

## Decision log

| Date | Decision | Reason | Reversal |
| --- | --- | --- | --- |
| 2026-10-28 | Bind export and query origins in target v2 and require exact request-metadata reconciliation before visibility | A collector acknowledgment can precede queryability; an unrelated backend or partial metadata match must not satisfy delivery evidence | Keep earlier synthetic stores intact and refuse configuration drift; remove un-enrolled APIs or migrate explicitly before any later target change |
| 2026-10-28 | Qualify the single-attempt native sender against an isolated exact-image Phoenix before production composition | Durable send receipts and actual read-back must be separate; preserve incomplete usage and document UI subtotal/zero-cost hazards | Remove the new opt-in sender; retain local evidence and the masked recovery hold; dispose only of synthetic test resources |
| 2026-10-27 | Prepare paused implementation packet | Operator adopted exploration direction and asked for packets, not execution | Revise packet before launch |
| 2026-10-27 | Activate foundation implementation on explicit operator launch | Proceed through synthetic proof, implementation and verification while preserving the recovery hold | Retain work and the hold; stop only on an explicit pause or a documented dependent rollout blocker |
| 2026-10-27 | Preserve legacy checkout IDs and add versioned Git evidence | Legacy clone IDs actually identify checkout paths; changing them would break historical joins | Remove the additive evidence field without rewriting historical IDs |
| 2026-10-27 | Probe only declared roots and leave harness transport/capability unknown | Git identity and an installed harness do not establish telemetry coverage; a retired root must not disappear | Remove the new read-only command and generated inventory, preserving source registries |
| 2026-10-28 | Keep incremental page cursors provisional until atomic local acceptance | Advancing a scan cursor before durable metadata acceptance would silently lose source events after a crash or refusal | Preserve the historical collector hold; remove the new reader/journal without changing old archives |
| 2026-10-28 | Use verified SQLite DELETE/EXTRA for the initial page journal | Bound database growth and avoid an unmanaged WAL backlog while qualifying atomic page/cursor acceptance | Revisit journal mode through an owned migration and the same crash/resource tests before rollout |
| 2026-10-28 | Persist fair scheduling separately from accepted source cursors | An unreadable or refused source must not starve other sources; a crash may delay scheduling but must not falsely advance acceptance | Remove the new sweep and its additive scheduler table only in the owned replacement journal; historical stores and held units remain untouched |
| 2026-10-28 | Admit positive native metadata and its receipt atomically under the shared journal budget | Native privacy, exact retries and capacity refusal must be established before a network acknowledgment; conflicting identities must not overwrite the canonical event | Remove the new native adapter and its owned journal tables before enrollment; retain historical stores and hold; any later deployed migration requires an explicit tested reversal |
| 2026-10-28 | Use single-admission bounded trace HTTP with post-commit OTLP responses | Prove gzip/stream/overload and precommit/lost-ACK behavior before routing native producers; distinguish local receipt from backend visibility | Remove the un-enrolled handler and disposable fixtures without touching held units or historical data; any later deployment requires tested listener/config rollback |
| 2026-10-28 | Preserve ambiguous delivery facts and derive one state per enrolled event under a fixed target | HTTP 200 can be partial; a pre-send crash or lost reply cannot identify delivered events, and later refusal cannot erase earlier evidence | Remove the unenrolled ledger/decoder; any future target or retention migration must preserve evidence and have a tested reversal before deployment |
| 2026-10-27 | Inherit metadata/curated-example policy | Operator decision D1 | Only explicit policy revision |
| 2026-10-27 | Preserve live state until bounded proof and rollout | Confirmed held collector and incomplete semantics | Revert owned configuration to captured baseline with validated data compatibility |

## Exception ledger

None. Deferred implementation details must be decided with evidence and recorded here, not treated as permission to omit acceptance.

### Verified reclamation decision (2026-10-28)

Reclaim verified payloads through a separately configured bounded service, retaining checksummed dispositions, original receipts, canonical identities, source cursors and append-only delivery facts. Every accepted event (including native duplicates) must have positive historical visibility; recent send reservations defer deletion. This frees payload capacity without inventing successful delivery. Pending and uncertain expiry remains a separate explicit implementation requirement, as does compact-evidence retention/epoch migration. Reversal before production enrollment is to leave this service uncomposed and keep the existing held forwarder masked. No historical data migration or production deletion is authorized by the synthetic fixtures themselves.

### Explicit payload expiry decision (2026-10-28)

Add an opt-in, immutable payload expiry deadline with a separate `expire` operation. Atomically retain the original receipt and a snapshot of all five delivery states when deleting payloads. Expiry is not a delivery state or a successful send. Retain canonical identity hashes and refuse renewed acceptance of expired references: HTTP 410 for an exact expired replay; precise partial rejection for expired identities alongside new events. Preserve reconstructed source cursors. The new policy version refuses drift in earlier disposable journals; those fixtures are retained, not migrated. Before production, qualify compact-evidence retention/epoch boundaries and hard worker limits. Reversal remains leaving the new route uncomposed, preserving all historical data and the masked old forwarder.

### Local evidence-window decision (2026-10-28)

Bound detailed local receipt/identity history by explicit observation epochs. Retire only a fully disposed, sufficiently old window after a send quiet period; keep the five delivery-state populations as cumulative observation counts, a latest-window summary and checksum linkage. Source cursors remain; epoch-zero receipt hashes and source IDs remain compatible. Later receipts and OTLP metadata identify the new local evidence epoch, and duplicate suppression is explicitly limited to that epoch. Current absence never proves lifetime absence. This trades per-event local detail for bounded storage while Phoenix and aggregate evidence serve separate purposes. Production policy, admission pause/drain/resume, bounded pre-retirement rollback snapshots and restoration must qualify before activation. The held collector and historical archives remain untouched.

### Bounded retirement recovery decision (2026-10-28)

Require policy v2 to retain a single checksummed logical recovery generation in the same retirement transaction before compact evidence is deleted. A copy that cannot fit fails closed; the preceding snapshot survives an aborted replacement. Restore only the exact empty successor with unchanged admission/attempt sequences, preserving source/scheduler cursors and refusing newer observations. Repeated completed restoration is idempotent. This gives an atomic, bounded undo for the latest retirement without creating another unbounded archive. It is not independent disaster recovery and does not restore disposed payloads. Qualify physical backup, worker headroom, admission coordination and production policy separately before live retirement. Reversal remains leaving these new APIs uncomposed and preserving historical stores and the recovery hold; older disposable policy stores refuse drift instead of being rewritten.

### Shared worker maintenance boundary decision (2026-10-28)

Compose the existing proven components behind one scoped controller that starts paused. Atomically cap active work and refuse overflow without queuing; pause closes admission before waiting for accepted activity to drain. Timeout/cancellation keeps admission closed. Permit evidence retirement/restore only while paused and drained, serialize control/maintenance operations without a waiting queue, and require explicit resume afterward. Scope closure forbids reopening. Keep standalone HTTP behavior compatible through its own resumed controller, while the composed worker receives a shared paused controller. This prevents maintenance from racing accepted work within the owned process; it does not replace cross-process ownership or OS resource limits. Reversal is to leave the new worker uncomposed and retain the old masked service; no production setting or historical store is changed by this synthetic composition.

### Actual process and HTTP boundary decision (2026-10-28)

Qualify the real composed worker under disposable user-systemd cgroup/process limits and an inherited advisory lock before production wiring. Use a pinned standard HTTP proxy over a private Unix socket for this proof: direct Bun idle timeout did not bound incomplete headers, and a custom socket relay lost early rejection responses despite a passing unit fixture. Remove that relay. Verify real limits, descriptor ownership, nonqueued second-owner refusal, stalled/oversized request behavior, enforced memory termination, journal integrity and exact receipt replay after explicit resume. Keep process limits distinct from aggregate storage policy and full deployment qualification. Reversal is removal of the synthetic-only fixture/proxy arrangement; no production listener or held unit has changed. Independent physical backup, owned scheduling, metadata-only proxy logs and bounded route enrollment remain prerequisites to deployment. See research/WORKER-RESOURCES.md.

### Independent physical recovery and notification decision (2026-10-28)

Capture a bounded separate SQLite database under paused exclusive maintenance and publish a checksummed manifest only after verification/sync. Restore only into a fresh private destination using a caller-retained digest and independent verification client; never overwrite later observations. Preserve failed/uncertain artifacts and prior generations. Generation retention/off-device replication and production selection remain explicit deployment work. Reversal is leaving these APIs unenrolled; historical stores and the recovery hold remain untouched. The synthetic proof's deliberate OOM triggered KDE notifications, so routine resource runs now use a controlled stop; OOM enforcement requires explicit --exercise-oom and advance explanation. Retain the prior successful OOM evidence. Reopen listener qualification after an actual intermittent upstream 502 instead of accepting earlier passing exchanges as universal proof.


### Exact retention reconciliation decision (2026-10-28)

Replace first-policy selection with an exact configured node query and verify
name, schedule, MaxDays rule and each declared project's effective assignment
before mutation and on fresh read-back. Refuse ambiguous/incomplete evidence
and assignment drift instead of silently reassigning projects. One mutation
attempt only; lost replies remain unconfirmed until a read-only check. Preserve
the weekly schedule and explicitly distinguish 14-day eligibility from actual
sweep time. Synthetic actual-image rollback is proven; production data recovery
still requires protected backups because changing the rule back cannot restore
deleted rows. Reversal before deployment is reverting the owned script/task
changes; no live retention setting or held collector was changed.


### Streaming filesystem discovery decision (2026-10-28)

Use scoped, isolated Python stdlib directory iterators through Effect managed
processes because the installed FileSystem API allocates eager directory arrays.
Alternate bounded events across explicit disjoint roots; never open retired roots
or follow symlinks. Report pending, overflow and access failures independently of
complete traversal. Preserve accepted file offsets in the journal while treating
discovery progress as restartable observation. Bind one scanner to the worker;
pause drains admitted work and suspends helper prefetch under maintenance. Keep
private paths out of reports and hold live enrollment until owned runtime/resource
qualification. Reversal is leaving discovery unenrolled; no historical source,
held service or existing accepted cursor is rewritten.


### Native collector queue and health decision (2026-10-28)

Give the native Phoenix exporter a byte-bounded persistent queue with fsync and
an independent physical file cap; remove asynchronous batching before trace
persistence. Separate collector self-metrics from harness activity and detect
missing instrumentation as well as failures. Keep transport acceptance distinct
from backend visibility and permanent rejection. Preserve stable storage IDs and
queued files during rollback. Synthetic exact-image crash, refusal and failure
proof is recorded in research/COLLECTOR-QUEUE-HEALTH.md. No live enrollment is
qualified until the positive metadata boundary, backup/restore, event/source
coverage, actual route/read-back and rollout/rollback gates are complete. The
historical forwarder hold remains intact.


### Projected native route decision (2026-10-28)

Separate internal collector intake for the worker's native-export/v1 output from
the raw harness endpoint. The legacy name filter would discard normalized
agent.* spans; the persistent queue must follow upstream positive projection.
Keep the collector guard explicitly distinct from sanitization/authentication,
count excluded spans, and bind export/query origins independently. Synthetic
journal -> collector -> Phoenix reconciliation passes with private canaries
absent from all three stores. The old trace endpoint is disabled in the new
source topology, so producer migration and private route qualification are
required before live application. No deployed endpoint changed. Reversal keeps
captured configuration, pending queues and the historical recovery hold intact.
See research/NATIVE-COLLECTOR-ROUTE.md.

### Durable native scheduling decision (2026-10-28)

Select retained native events through a checksummed singleton traversal position.
Claim one event before I/O so repeated deadlines cannot strand the tail of a
preclaimed batch. Use immutable bounded pass/backoff policy, deterministic
epoch-scoped attempt identities, and existing ledger/read-back evidence. Query
accepted/ambiguous attempts without blind resend; preserve missing, mismatch and
query failure distinctions. Share worker pause/drain admission. No automatic
production timer or source enrollment is implied. Reversal before enrollment is
leaving the scheduler uncomposed; preserve existing stores and masked recovery
hold. See research/NATIVE-SCHEDULING.md for proof scope and outstanding gates.

### Scoped native cadence and health decision (2026-10-28)

Run the verified native scheduling tick sequentially under one explicit runtime
owner, with delay after completion and a cooperative cycle deadline. Do not resume
intake on construction/start. Pause/drain on interruption. Preserve failures and
unknown progress as tagged observations, with fresh cycle/start time and explicit
stale/regressed-clock states. Latest-pass counts are gauges rather than cumulative
or fleet coverage counts, and missing counts are omitted. Use fixed metric names
and enumerated phase labels only. External availability/freshness monitoring and
source/event-lag signals remain required before production qualification. Reversal
before enrollment is leaving the runtime uncomposed and retaining the recovery
hold. See research/RUNTIME-HEALTH.md for proof scope and remaining gates.

### Private managed-process boundary decision (2026-10-28)

Add a dedicated Bun entrypoint in the existing CLI package, using explicit private
configuration and supplied redacted secrets. Require inherited exclusive ownership
and actual OS limits before database/listener startup; preserve foreign files and
active sockets. Start paused, expose control/health only on the owned Unix socket,
and require an independently qualified frontend for intake. Emit only safe refusal
reasons. Actual synthetic startup, autonomous send, missing read-back, controlled
restart and receipt replay are proven without another deliberate OOM. Installation,
source cadence, external alerting and live qualification remain separate gates.
Reversal is leaving this entrypoint uninstalled and preserving the recovery hold.
See research/WORKER-ENTRYPOINT.md.

### Explicit source cadence and traversal health decision (2026-10-28)

Connect declared roots to the owned worker through an opt-in launch declaration.
Run source and native cycles independently under one runtime owner and shared
pause/drain admission; require at least two admission slots. Retain bounded
per-root current-cycle read counters so a later empty directory page cannot erase
partial, failed or backlogged reads. Idle requires assessed completed traversals;
unconfigured, excluded, scanning, waiting, backlogged, failed, stale and unknown
coverage remain distinct. No real source or legacy unit is automatically enrolled.
Reversal before enrollment is omitting discovery configuration and retaining the
recovery hold. Reconstructed backend delivery and independent coverage/lag remain
required. See research/SOURCE-CADENCE.md.


### Reconstructed projection and shared delivery decision (2026-10-28)

Reuse the existing bounded attempt/receipt/read-back machinery for verified
transcript occurrences, with an explicit reconstructed stream and deterministic
separate trace/span IDs. Preserve source event time, mark unknown duration, omit
invented parent/provider/task identity, and keep usage snapshots non-additive so
native totals cannot double count them. Traverse retained pages with bounded
canonical event offsets, advancing past rejected-only pages. Bind both projection
versions in target v3 and new cursor semantics in schedule v2; preserve older
synthetic journals and refuse drift instead of silently migrating them. Rename
mixed pass metrics to delivery_pass and report retained empty passes as scanning.
Reversal before enrollment is leaving the new route unenrolled; native IDs and
historical data remain unchanged. Actual collector/Phoenix reconstruction proof,
coverage/lag and deployment gates are still required before live activation.


### Mixed collector guard and actual aggregate interpretation (2026-10-28)

Admit only matching version/stream/name combinations for native-export/v1 and
transcript-export/v1 on the private metadata route. Preserve exporter/storage IDs,
queue bounds and metric collision repair. Actual-image proof covers both streams,
invalid combinations, exact stored identities/times, separate session grouping and
non-additive reconstructed usage. Qualify Phoenix queries against stored semantics:
custom attribute filters use nested paths, not the REST flattened literal key.
Report native performance separately from reconstructed timestamp points and show
known token subtotals separately from complete-usage totals. Retain historical
records without new stream metadata as an explicit legacy/unknown population.
Reversal before enrollment is retaining the existing hold; any later guard rollback
must preserve queues and cannot be treated as replay authorization. No production
collector, project or historical record was changed by this proof.

### Independent coverage comparison decision (2026-10-28)

Compare independent route populations against separately evidenced launch, local
acceptance and backend visibility snapshots in the existing inventory CLI. Bind
exact population window and boundary evidence, retain partial-query flags and
unknowns, and report set differences without equating not-observed with loss.
The retained disposable native proof supplies positive backend evidence for three
independently calculated expected IDs; it supplies no actual harness launches.
Managed launch/identity and periodic query adapters remain required. Reversal is
removal of this read-only command and its synthetic reports; no live enrollment,
historical migration or recovery-hold change occurs.

### Complete ownership inventory decision (2026-10-28)

Before adding managed-launch records, fix the existing journal/backup ownership
query: the fully initialized worker already has 20 tables, so a fixed LIMIT 20
can hide an unexpected later table. Read the allowed-table population plus one
sentinel and reject excess/unowned names. Apply the same boundary to copied
snapshots and restoration, even with a valid retained checksum. Reproductions
prove all three prior acceptance failures and the repaired refusals. No historical
database is migrated or deleted; reverting source is the code reversal, while
retaining partial restore destinations preserves forensic recovery. Managed-launch
writer and identity integration remain outstanding.

### Private managed-launch transport decision (2026-10-28)

Keep one journal owner. Add an opt-in `/v1/launch-facts` route on the existing
private worker socket, with a bounded administrator route/harness/surface allowlist.
The public trace frontend must not expose it. Match explicit host, hash namespace
and epoch before writing; preserve the same immutable fact on an ambiguous response.
A local receipt follows commit and establishes neither Phoenix visibility nor an
independent all-harness launch denominator. The socket authenticates the local
owner, not the truth of each caller's process assertions; managed-driver production
integration must supply actual spawn and verified runtime-session evidence.

Use the existing worker pause/admission and byte-bounded streaming reader. Enforce
a finite body deadline, one upload at a time, no waiting queue, metadata-only
schema, and generic refusal responses. Empty or omitted enrollment disables the
endpoint. Reversal is to omit launchHttp from the private worker configuration
and perform a controlled owned-worker restart; retained launch facts remain in
the journal/recovery mechanism. Do not modify the held historical forwarder.


### Private destination context and receipt client decision (2026-10-28)

Read the current epoch through the private worker API rather than opening its
SQLite database from the producer. Treat that context as a staleable snapshot,
not a launch permit. Pin the owner-only directory/socket identities and explicit
host/hash namespace in a scoped Unix client. Verify bounded response schemas,
exact fact and deterministic receipt digest/header. Refuse socket replacement and
require a new client; preserve the submitted epoch across explicit retries.
Ambiguous responses must never initiate a second process. The existing platform
HTTP adapter is now a runtime dependency. Reversal is to remove the opt-in client
and omit launch enrollment, retaining journal/recovery state and the historical
forwarder hold. Actual driver ownership and producer recovery remain required.


### Managed driver evidence and failure ownership decision (2026-10-28)

Supply an explicit optional lifecycle observer to the managed driver instead of
adding a driver dependency on metrics tooling. Observe OS spawn before negotiation
and validated identity afterward; preserve the identity's evidence level. Expose
only a read-only process port. Bound callbacks, never retry them automatically,
and close the acquired child scope on failure/interruption before returning to a
caller that may catch the error. Explicit close also releases the child scope.
Reversal is omission of the observer and removal of the additive port; historical
journal facts remain intact. Production integration requires a separate durable
single-attempt claim and immutable reconciliation before enabling this path.


### Independent launch claim recovery decision (2026-10-28)

Keep immutable launch intentions in an explicitly enrolled, bounded owner-only
store disjoint from the collector journal. Collector backup restore must not grant
another attempt, so an idempotent Prepared receipt cannot serve as a launch permit.
Sync exclusive claims before invoking process effects; a torn record, failure,
capacity limit or same launch ID across epochs refuses rather than retries. Tests
cover actual producer termination, independent process contention and restoring a
pre-claim SQLite backup. Loss or rollback of the claim store itself requires a
recovery hold; do not silently provision a new fence. Reversal before enrollment
is to leave the API uncomposed. Retain synthetic evidence and historical stores.
Production controller/outbox wiring and full acceptance remain open.


### Immutable producer lifecycle outbox decision (2026-10-28)

Retain at most three immutable post-claim observations and four exact receipt
records in the existing independent claim store. Local durability precedes
transport. Reconciliation has no process-start capability: explicitly replay at
most four unchanged submissions with a ten-second bound, verify full prior
acknowledgments and preserve ambiguity/conflict. Do not switch epochs or infer
completion. A pre-claim collector restore can produce a new recorded-at value;
report that discontinuity and retain the original acknowledgment. The independent
claim still prevents relaunch. Reversal before enrollment is leaving these APIs
uncomposed; no old stores or held units are changed. Real controller wiring and
full acceptance remain open.


### Existing managed-owner enrollment decision (2026-10-28)

Add explicit private observation enrollment to the existing agent-message serve
owner. Bind its salted attempt to endpoint, owner, generation, repository scope,
canonical workspace and provider. Persist lifecycle callbacks locally; reconcile
only after binding, stop reconciliation before close, and retain unknown outcomes
when numeric exit evidence is unavailable. Reject insecure salt fallbacks in both
producer and collector composition. Separate receipt integrity from local fact
writes so a torn acknowledgment cannot suppress shutdown metadata. Reversal before
live enrollment is omitting the option; do not reset claim stores or held units.
Synthetic qualification is not production coverage or full packet completion.


### Managed-owner recovery command decision (2026-10-28)

Expose bounded status/reconcile under the existing agent-message observation
command. Read only existing explicit enrollment, match its entire Prepared claim,
and replay original facts without process-launch authority, epoch retargeting or
store repair. Report current liveness/backend visibility as unknown even when
historical Finished/receipt evidence exists. Scope each periodic HTTP client to
one flush. Prove paused collector capture, actual command shutdown, restarted
collector reconciliation and duplicate-launch refusal using synthetic children.
Reversal before live enrollment is omitting observation enrollment; preserve all
claims, journals and the historical recovery hold.


### Explicit owner provisioning decision (2026-10-28)

Add initialize-claims and enroll to the existing observation command. Keep fresh
store initialization separate from owner enrollment; neither normal startup nor
reconciliation may create a replacement fence. Read a bounded private request,
validate its namespace/host/provider/canonical workspace, derive the same owner
binding as serve, and exclusively sync new enrollment output. Preserve existing
and partial state. Explicit setup is not recovery permission after claim-store
loss. Operational independent-store backup/recovery and population publication
remain required before production enrollment.


### Independent managed-launch cohort decision (2026-10-28)

Publish explicit claim-creation-window cohorts from two agreeing bounded scans of
an existing independent store. Separate intentions, observed starts, unresolved
starts and historical acknowledgments. Preserve unknown event populations, current
liveness and backend visibility; never infer four events per claim. Bind evidence
to the retained fence and declared host/routes and reject copied claim IDs. This
is interval evidence, not a global or event-time population. Reversal is omitting
the read-only command; preserve existing stores and the recovery hold. Operational
claim-store recovery and live qualification remain required.


### Independent claim-store loss decision (2026-10-28)

Treat stale claim snapshots as reconciliation evidence, never automatic launch
authority. Actual registered commands must refuse missing, quarantined or torn
claims before spawning a child; preserve original outbox bytes and uncertainty.
Collector restore continues to use the independently surviving launch fence.
No automatic claim restore or fence reset is introduced. Operational backup owner,
failure-domain protection and explicit recovery reconciliation remain required.


### Bounded replacement service deployment decision (2026-10-28)

Extend the existing install command with an explicit read-only observation plan.
Render finite worker/frontend user units with pre-start artifact verification,
private flock ownership and paused startup. Expose only POST traces on loopback;
keep health and control private. Stop the dependent frontend with its worker,
disable Caddy persistence and isolate its state. Qualify the real installed units,
bundled entrypoint, socket owner, input deadlines and checksum refusal. These are
bounded canary-stage units, not automatic boot enrollment or historical hold
release. Reversal stops both units and removes only exact owned unit files,
preserving journals/configuration and historical data.


### Isolated live canary decision (2026-10-28)

Qualify the installed bounded worker and frontend against the deployed Phoenix
origin through an isolated collector rendered from the owned dankserver template.
Use a dedicated clearly described project, exactly two synthetic records, fresh
identities and no producer retries. Preserve failed-attempt journals/queues.
Docker bridge DNS cannot resolve this tailnet hostname, so pin the workstation's
resolved tailnet address only in the temporary collector while retaining TLS
hostname verification. An independent timer stops that exact container ID; normal
rollback stops services, removes only their owned files and the stopped collector,
and preserves local and backend evidence. Existing traffic and recovery hold
remain unchanged. This proves a bounded live route, not real harness coverage.

### Target-qualified ambiguous replay decision (2026-10-29)

Permit bounded replay only under an explicit immutable policy binding the exact
export/query/project target to an owner-retained duplicate-handling qualification
receipt. Inspect the backend first; only a fresh Missing result can proceed, and
only after minimum delay/backoff and within ledger attempt limits. Query errors,
metadata mismatches and unqualified targets hold. A retry preserves stable event
identity and payload and appends a fresh attempt without erasing uncertainty.
The pinned disposable Phoenix duplicate proof and dropped-transport recovery proof
are in research/QUALIFIED-REPLAY.md. The receipt digest is an owner provenance
reference, not automatic certification of arbitrary versions or targets. Reversal
before enrollment is omission of the option; existing profiles and historical
receipt facts must not be rewritten. The recovery hold remains intact.

### Bounded deployment journal sizing decision (2026-10-29)

Derive the worker file ceiling from an explicit journalMaxDatabasePages deployment
setting instead of a fixed minimum-sized ceiling. Preserve the minimum default
for existing plans and refuse page budgets beyond the installed worker's 64 MiB
per-file envelope. The worker independently checks the launch configuration
against actual process limits before opening the listener. A 1024-page installed
fixture passed with an 8 MiB file limit; frontend limits remain independently
bounded. This declares a deployment budget, not a dynamic resize of an existing
journal. Reversal is the prior minimum-sized plan for an un-enrolled minimum-sized
journal; preserve all existing data and never shrink a populated journal blindly.

### Installed credential isolation decision (2026-10-29)

Replace the shared environment-file input in the new, un-enrolled deployment
plan with dedicated hash-salt and optional Phoenix-query credential source files.
Systemd LoadCredential supplies only those names; env --ignore-environment gives
the worker PATH and CREDENTIALS_DIRECTORY and gives the frontend only its five
explicit runtime variables. No secret value appears in argv or the environment.
Credential reads are private-owner, single-link regular files, bounded to 4096
bytes, strict UTF-8 and nonempty without NUL/newlines. A present invalid credential
directory never falls back to ambient values. Existing direct process fixtures
retain their explicit environment route; no claim of universal launcher isolation
is made. Credential source paths are space-free because the installed systemd
user manager failed to deserialize a space-containing source in a minimal probe.
The unit's LoadCredential value is emitted without shell-style quoting. Reversal
stops/removes only the new owned services; do not restore shared-secret inheritance
or touch held historical units. Provision credential files through the existing
approved secret lane at any later actual enrollment, never via chat or argv.

### Atomic scanner suspension decision (2026-10-29)

Hold one control permit across closing admission, draining accepted work and
suspending the bound discovery scanner. Concurrent resume/maintenance refuses
while suspension is pending. Suspension failure leaves admission closed. This
replaces two exclusive acquisitions that allowed resume between drain and scanner
suspension. The control regression and full package audit/docgen passed; the change
neither enables sources nor releases the recovery hold.

### Private installed maintenance decision (2026-10-29)

Expose the existing worker maintenance capabilities on `POST /maintenance` at
its private owner socket. The public trace frontend continues to refuse this
route. A schema-bound request names the exact host and namespace and one finite
operation. It also binds the configured target and a random process-instance ID
returned by private context selection. Even identical same-host journals have
different instances; stale requests after restart refuse until the owner explicitly
selects fresh context. This is not authentication or persisted journal identity.
Receipt pagination returns at most 32 metadata summaries. Reclamation,
explicit expiry, backup, retirement and logical restoration require the shared
paused/drained exclusive control boundary and leave it paused. Existing age,
quiet-period, delivery-state, digest and rollback constraints remain in force.

Admit one request without a waiting queue; bound the body to 4096 bytes and one
second, and operation execution to 30 seconds. Backup destinations are four fixed
create-only slots beneath the private state directory, each bounded by the
configured journal page ceiling (maximum 32 MiB). Existing or partial generations
are held, never overwritten or automatically removed. Retain receipts separately;
physical host-loss recovery still requires external snapshot replication. Logical
retirement restore is not physical restore. No request changes policies, source
enrollment, collection admission or the historical hold. Rollback removes the
new route/wiring while preserving journal and backup generations. Fixed-clock
HTTP tests prove age-based eligibility; installed-clock proof must not claim
actual expiry from a held young or empty window.

### Explicit synthetic surface and backend time representation (2026-10-29)

The synthetic CLI/desktop distinction must survive privacy projection without
publishing session names or implying application enrollment. Add an optional
owner route policy permitting only finite `cli`/`desktop` fixture labels. It is
absent/disabled by default; ordinary producer labels are ignored. Enabled invalid
labels refuse the span. Labelled exports use `fixture.<surface>.<kind>`, explicit
synthetic/provenance attributes and unchanged event/trace/span identity. The
collector checks finite names and matching labels; this remains a route-shape
check, not authentication. Read-back includes the three fixture keys even when
absent in the expected record so unexpected backend annotations cannot pass.
Old records without the optional field retain their encoding and names. Do not
retroactively relabel or reingest old identities; changed metadata remains a
conflict until explicitly reconciled.

A bounded tailnet canary exposed Phoenix rounding source nanoseconds through
floating-point seconds into microsecond datetimes. Exact source-time attributes
were intact, but floor-only comparison incorrectly withheld visibility. Accept
only microsecond-aligned standard timestamps strictly less than one microsecond
from the exact encoded time, while preserving exact nanosecond attribute equality.
Aligned source values must match exactly. Stored endpoints must remain ordered,
and a point span must remain a point; quantization cannot create a duration.
Larger drift, unexpected sub-microsecond standard fields and altered source-time
attributes refuse verification. Far-future float precision beyond this bound is
not qualified and remains a mismatch. Reversal removes the optional route policy
and restores the earlier code/template while preserving journals and receipts;
new labelled stored data remains explicitly synthetic historical evidence.


## Decision: durable query pacing

Read-back attempts reserve a checksummed bounded per-event cooldown before I/O.
Repeated Missing, mismatch and failed/interrupted queries use capped exponential
pacing across restarts; this never changes delivery-state evidence or authorizes
replay by itself. Delay starts at reconcileDelayMillis and caps at the greater
of that value and maxRetryDelayMillis. One auxiliary row per enrolled event is
retired/restored with its compact evidence. Existing journals open forward;
older binaries refuse the new table. Rollback stops and preserves the new route
and journal. See research/QUERY-BACKOFF.md and its source-bound package receipt.


## Decision: capacity-aware expiry and ownership integrity

Explicit expiry can dispose fully validated never-enrolled event references when
delivery-event capacity is exhausted. Preserve their page-reference counts
separately from the five enrolled delivery states and retain receipt-bound native
canonical ownership checksums. Every new disposition includes enrolled canonical
ownership evidence, including zero counts; seal verifies that evidence before
retiring details. Contradictory indexes, missing registered membership, or orphan
send/query/visibility evidence remain held. Intake atomically reserves terminal
disposition capacity; exact retries remain readable at capacity. Expiry attempts
each owner registration at most once per transaction.

Old dispositions remain readable and restorable, but omission of the new enrolled
ownership evidence requires a qualified migration before sealing; do not synthesize
integrity proof from possibly incomplete remaining rows. Already overcommitted
journals refuse retention installation without discarding receipts. Physical and
recovery bounds remain unchanged. See research/RETIREMENT-CAPACITY.md for evidence
and rollback limits. This decision does not release the historical recovery hold.


## Decision: explicit collector topology migration

Preserve the legacy trace receiver and its nonpersistent pipeline by default.
Select the metadata-only persistent pipeline with explicit inventory enrollment,
exposing its receiver only on loopback. This prevents a source deployment from
silently disabling existing producers or persisting raw legacy spans. Production
cutover must qualify the worker destination, pause/drain affected producers and
compare exact read-back. Reversal restores the captured legacy destinations and
mode after pausing new producers, preserving metadata queue/journal bytes. The
synthetic legacy/metadata/legacy test proves that bounded reversal; cross-host
transport and mass producer enrollment remain outside this source qualification.

### Declared synthetic repository association (2026-10-29)

AC12 uses one retained, positively probed synthetic Git root for both disposable and
live canaries. A create-only durable pre-send plan joins its host, namespace,
repository/clone/worktree receipt to the explicit synthetic route and independently
derived event IDs. Actual installed worker configuration and journal identity are
checked against this plan; backend event/route/surface IDs must match exactly. This
is proof-side producer association, not a new real-harness capability or population
claim. Both stages retain raw proof evidence and private queues while removing only
owned temporary units/containers. Reversal is the tested pause/stop/removal path;
historical forwarders, archives and production collector configuration remain held.
