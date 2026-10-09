# Proposed communication contract

2026-10-09. Design proposal, not an implemented API. Apply schema-first and
Effect-first skills when implementation begins; use existing package topology.

## Ownership and address model

Separate durable participant identity, runtime session identity, run/turn identity,
repo/lane identity, app host/backend identity and role address. A role such as `orchestrator` resolves to
one current owner; a direct message to a specific run stays with that run.
A new role holder cannot impersonate the old session and a restarted adapter
cannot claim it still owns an old turn.

Use the existing session ledger and register as fleet facts. Add endpoint
registration and a generation-fenced lease in the communication service. The
ledger's newest-row projection is not itself a distributed lock. Lease claims
must be atomic; role handoff advances an epoch and fences the previous sender's
control actions. Detect PID reuse and stale process identity through existing
scheduler patterns, while keeping message and process leases distinct.

The broker's committed role epoch is authoritative only for communication
control. Existing ledger/register facts authorize enrollment of the holder;
the broker does not elect a different orchestrator. A mismatch puts role routing
and control in `reconciling`, while direct session messages remain addressable.
Handoff uses a durable operation ID: record intent, fence the old epoch, append
idempotent ledger/register projections, then activate the successor only after
reading matching ownership back. A crash at any step resumes that same operation;
it cannot activate both holders. Competing claims serialize in the broker store.

Control execution validates the active epoch immediately before dispatch in the
same serialized executor that processes handoff. Handoff waits for an accepted
in-flight control action to reach a recorded outcome before activating a successor;
queued predecessor actions are rejected. Unknown external outcomes require
reconciliation, not a second merge attempt. The final Yeet merge gate still runs.
A role-addressed pending message follows the committed successor. A direct reply
to an original run stays with that run, or is explicitly forwarded with provenance.

## Message and receipt shapes

Model a versioned envelope with message ID, conversation ID, causation/reply ID,
sender participant, target role/session/group, repository and task/PR scope,
creation/expiry, priority, requested delivery mode, bounded payload or artifact
reference, and authenticated capability grant reference. Attach a per-recipient
sequence and attempt ID after routing. Snapshot group membership at acceptance
so retries have a defined recipient set.

Kinds should cover peer request/reply, progress, blocker, review finding,
final-head announcement, operator ruling reference, cancellation and handoff.
Text is data within that envelope. An operator ruling carries provenance; a peer
cannot manufacture one by writing "operator says".

Durable acceptance precedes delivery. Track `accepted`, `dispatched`,
`context-received`, `acknowledged`, `completed`, `deferred`, `expired`, `failed`,
`ambiguous` and `cancelled` as events with typed reasons and valid transitions. Receiving a
request is different from finishing its assigned task. Adapter acceptance is
not model receipt, and model receipt does not imply authority to execute it.

Provide durable broker acceptance and at-least-once retryable dispatch with
stable IDs and idempotent reconciliation. Confirmed context delivery depends on
the adapter being able to prove or reconcile consumption.
Do not promise exactly-once model side effects. After a crash between provider
consumption and acknowledgement, reconcile the original attempt against provider
history/receipt state; otherwise expose ambiguous delivery rather than silently
repeating a mutation. The ambiguous receipt names the recovery owner and the
next reconciliation action. A non-reconcilable adapter retains the message and
holds unsafe retries; it cannot promise eventual model consumption. Ordering is
per recipient/conversation, not global.

## Session capabilities and delivery modes

Record observe, send, queued follow-up, idle wake, active steer, targeted cancel,
live attach, history resume, fork, permission events, artifacts and remote access
individually. Include evidence level, runtime version and expiry. Advertised
support and measured support are separate fields.

Delivery modes: native active steer; next safe boundary; next turn; pull-only.
A caller chooses acceptable fallback modes. Never silently turn steer into
interrupt-and-restart. Preserve provider-specific extension payloads through
namespaced schema versions. Do not flatten all content into plain strings when
a provider can receive images, files or structured context.

Existing apps own their runtime. A bridge asks that owner to deliver; it does not
start a second process writing the same conversation. Managed workers have one
supervised owner connection. Persist the enrolled model/effort and permission fingerprint. Apply explicit
server defaults and resume/queue policy, then compare the effective settings
before inference. A mismatch fences delivery for reconciliation. This requirement
comes from the [observed Codex restart failure and mitigation](spike/README.md),
not a hypothetical risk.

Protocol permission requests are answered through
the existing policy path; they are not delegated to arbitrary message senders.

## Browser-mediated conversation bridge

The [visible-app experiment](spike/APP-PROOF.md) qualifies one controller-mediated
Claude web idle exchange and reload continuity. Model selection is observed in
the UI; a Manual label does not prove the effective tool or local sandbox policy.
Treat this as a separate adapter family from native channel/app-server control.
Its initial capabilities are visible idle send, assistant-reply extraction and
observed conversation persistence. Busy send and autonomous reply tools remain
unqualified. Native control remains preferred where it provides stronger evidence.

Enrollment binds an explicit origin and conversation to its owner and observed
model/mode. Revalidate identity before every send, persist the intent before UI
action, and extract only recipient assistant content. A timed-out click requires
reconciliation against transcript and draft state before retry. Do not treat the
presence of a Send button as an accepted message or count a quoted user prompt
as the model reply. Any presentation normalization must be bounded and recorded;
opaque IDs and payload values must not be rewritten. No hidden endpoint or
credential extraction is required by the measured UI route.

The [targeted source inventory](spike/browser-integration.md) found service-side
Firecrawl browser APIs but no repo-owned authenticated local enrollment driver.
In-session computer-use tooling is not automatically a deployable Beep driver.
The implementation must supply a supported enrolled browser-control boundary,
owned lifecycle and receipt persistence before this can run unattended. Keep
operator inspection and removal of enrollment available.

## Runtime and storage

Proposed home: repo-operational contracts/services in tooling; external SDK,
ACP and app-server wrappers in flat drivers; CLI composition in the current
repo CLI. Use `Session` subcommands for discovery/status and a dedicated earned
command group for message operations. Names are provisional until architecture
routing runs. Do not add `shared/*` or a generic foundation runtime by default.

Run a restartable user service with a private local socket. Use schema-decoded,
transactional durable storage under the workstation state root, bounded in-memory
queues and cursor replay. Prefer a proven repository store if it meets atomic
recipient/receipt updates; otherwise select SQLite behind a narrow store service
in the spike. Append-only exported receipts are useful for audit, but an unlocked
shared JSONL file is not the concurrent queue implementation.

Expose discover, send, reply, inbox, acknowledge, subscribe, inspect-delivery and
cancel through CLI/MCP. Provider channel/app bridges connect separately. Keep
MCP tools stable during a running session; enroll/restart only owned test sessions
when changing tools. Stream progress with backpressure and coalesce low-priority
updates. Never drop task requests or replies to preserve progress chatter.

For remote hosts, connect host services over authenticated encrypted transport,
retain local spool on disconnect and bind credentials to participants/scopes.
A2A can map external tasks into this contract; ACP remains the coding-agent
control edge. Do not expose provider control sockets directly to the network.

## Orchestrator integration

Consume existing Yeet facts and route them to the registered owner and coordinator.
A `final-head` event includes repo, PR, commit, owner and evidence references.
A merge-ready notice prompts the existing `yeet merge-gate` to re-read current
state. No cached message can authorize a stale-head merge. Replies, thread
resolution, ready flips and retirement remain existing Yeet operations.

Peer discussion is direct and does not require the coordinator to relay every
message. Cross-provider launch, fallback and merge actions retain their current
policy owners. Cursor/Grok workers can report and request assistance without
acquiring permission to launch another provider. Detect loops by causation ID,
per-task hop/turn budget and bounded fan-out; route exhausted loops to the owning
coordinator as a blocker.

## Rollout and reversal

1. Test adapters on isolated sessions with pinned models and minimal config.
2. Enable one existing/managed pair, keeping pull and durable inbox available.
3. Enroll remaining providers only after their compatibility receipts pass.
4. Wire production orchestration after restart and fencing tests.
5. Remove enrollment to disable a bridge; stop the new service and retain/export
   pending messages for recovery. Existing register, ledger and Yeet remain usable.

No global app settings, shell wrappers or provider binaries are patched by this
packet. A future bridge requiring those changes must include backups, exact
version guards and a tested revert in its implementation goal.
