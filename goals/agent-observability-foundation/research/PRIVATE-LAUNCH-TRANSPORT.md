# Private managed-launch transport

The owned observation process now routes `/v1/launch-facts` to a bounded local
metadata intake. It is disabled by default. An explicit private launchHttp policy
allows at most 64 distinct route IDs and their declared harness/surface pairs.
The Unix socket remains owner-only. Any production frontend must expose only
its trace route and explicitly exclude this launch/control interface; production
frontend installation and qualification remain open. A matching local caller is
not independently authenticated as a specific harness, so producer truth requires
the managed driver integration.

Submissions bind version, host, namespace, evidence epoch and one immutable fact.
Bodies are streamed through an 8192-byte allocation and a configured deadline.
One upload may be active; concurrent requests are refused rather than queued.
The handler participates in the same worker pause/drain boundary as trace intake.
Only JSON with identity content encoding is accepted. Unknown fields are refused
recursively, and errors never echo payloads. Native trace intake reuses the same
byte-bounded reader with its existing 262144-byte limit and gzip behavior.

A 200 response and x-observation-receipt follow the journal transaction commit.
Retries with exact metadata return the original receipt. No request may silently
move into a new epoch: retired epochs return 410. Wrong host/namespace and lifecycle
conflicts return 409, an unenrolled route returns 403, and paused/capacity/storage
refusals return 503 without a receipt. A response lost after commit is ambiguous
until exact replay; it must not cause another agent process to be launched.

Real socket tests exercise pause/resume, replay, route/destination mismatches,
private-field refusal, fixed and streamed oversize uploads, body timeout, busy
admission and failed transactions. The actual constrained worker entrypoint also
accepts two synthetic sequences (one CLI-marked and one desktop-marked), restarts,
and returns the same eight receipts without adding rows. It preserves the private
canary boundary and all existing startup/ownership protections. These are supplied
fixture facts, not actual Codex or ChatGPT Desktop launches.

Verification is recorded in ops/launch-http-verification.json and the retained
entrypoint receipt. No producer enrollment, production deployment, Phoenix write,
raw transcript replay, historical store change or recovery-hold release occurs
through this step. Next work connects a producer to actual spawn and verified
session identity, including failure reconciliation before any launch retry.

## Producer integration boundary found in live source

The CLI consumer is `AgentMessage.runtime.ts`, which calls the managed session
service and subsequently stores the verified session identity. The shared stdio
adapter (`AiProviderCliSession.stdio.service.ts`) acquires a child handle before
negotiating Codex/ACP identity. The Claude adapter has the equivalent child and
initialization boundary. Neither exposes these lifecycle observations to the
metrics journal yet. Do not turn successful profile validation or a desired model
into evidence of an actual spawned process or verified session.

Keep the driver independent of tooling packages: supply a narrow lifecycle port
from the owning controller, and map its actual evidence into hashed observations
at the tooling boundary. The current allowlist is not itself that evidence. A
producer also needs a private read of the current destination/epoch context; it
must not assume epoch zero or open SQLite to obtain it. A stale context should
fail explicitly and never trigger an automatic second agent launch. Scope cleanup
and an ambiguous post-spawn observation need explicit reconciliation. These are
remaining implementation requirements, not verified capabilities of this endpoint.

The existing Effect Node HTTP client supports private Unix sockets through
`NodeHttpClient.layerUndiciOptions({ connect: { socketPath } })` (also through
its Node agent options). Reuse that client surface rather than introducing a raw
fetch path or a general network endpoint into managed launch profiles.


## Qualified private client and context read

The private context requirement above is now implemented. GET /v1/launch-context
returns the verified current epoch, declared routes and paused/accepting snapshot.
It works while paused and does not grant launch authority or reserve that epoch.
The handler captures the journal dependency at construction. Disabled enrollment
still exposes neither launch route.

The scoped client uses the Effect Node HTTP adapter with a fixed Unix socket;
there is no configurable TCP destination, redirect or retry policy. It checks the
canonical 0700 directory and 0600 socket against the runtime effective UID, pins
both inode identities, and refuses exposed permissions or a replaced socket.
The caller supplies expected host/namespace identity from its own enrollment.
Only one exchange is admitted at a time. Context and receipt responses are capped
at 16384 and 8192 bytes, respectively, with an exchange deadline. Receipt host,
namespace, epoch, exact fact, recomputed digest and response header must agree.

A missing or invalid acknowledgment may follow a successful commit. The client
reports uncertainty, never changes the epoch, and never launches another agent.
An explicit exact retry can recover the original receipt. Tests prove delayed
acknowledgment after commit without automatic resend, forged digest/header refusal,
oversized response refusal, destination and permission checks, replaced socket
refusal, paused context and stale-epoch refusal. The lost-response fixture is
finite so server shutdown can finish; it is not another OOM test.

The actual bounded worker proof now invokes this client in a separate process,
reads context while paused, submits eight synthetic facts, restarts the worker,
constructs a new client and recovers the identical receipts. An independent raw
HTTP retry agrees. The journal remains at eight records, and rejected private
fields never enter it. All six proof services ended with MainPID=0; four are
intentional startup refusal cases. See ops/launch-client-verification.json and
ops/launch-client-entrypoint-verification.json. Package audit and docgen passed.

These are still supplied synthetic lifecycle facts. The real managed driver,
independent launch denominator, durable producer intent/ownership, source-session
joins, live enrollment and rollout acceptance remain unimplemented. No historical
recovery state or production service was changed.
