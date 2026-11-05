# Fixed Grok native canary

This adapter supports one owner-admitted native source invocation and one fixed
user turn. It is not a session, arbitrary prompt, agent dispatcher or enrollment
completion claim. No real Grok invocation was performed during implementation.

The main model is pinned to `grok-4.7` with medium effort. The exact private profile
and `GROK_SESSION_SUMMARY_MODEL` also pin native title metadata to `grok-4.7`.
Native title operations and vendor HTTP retries are separate from the controller
source invocation; their request count and combined usage remain Unknown. Only
native private `session_title` metadata is permitted outside the main executable
tool catalog. The adapter does not export the title or claim a title was observed.

Grok's empty `--tools` argument alone leaves 23 executable tools available.
The fixed 23-tool denylist is mandatory. The wire boundary requires an empty
executable catalog and rejects every executable tool call, including any
`session_title` call appearing in the main turn's tool stream. The private profile
turns off shared leader reuse, code indexing, auto-wake and local envrc loading.

## Runtime ownership

The owner must prepare a **separate dedicated pilot worktree** at the reviewed
source revision and commit the exported `grokCanaryProjectMcp` bytes locally in
that pilot only. Never publish that override into main or change another
worktree's MCP configuration. The producer checks the exact empty project MCP
file and native inspect's actual CWD/root. It changes neither file nor worktree.

Owner-only private HOME, GROK_HOME, config, attempt directory and socket are
required. The profile must equal the exported `grokCanaryProfile` exactly. Native
inspect runs twice with no project instructions, skills, hooks, plugins,
marketplaces, MCP or LSP entries, no enabled foreign compatibility source and
only the one exact private configuration layer. Unexpected required policy or
config drift refuses admission. Existing host/user managed and requirements
files must be absent under this finite qualification; if they appear, preserve
and requalify them rather than hiding or deleting them. Remote policy and cloud
retention are not frozen by the local qualification.

Authentication uses the existing normal native login-store consumer through
`GROK_AUTH_PATH`. The adapter reads only the authentication file's owner, mode,
inode and timestamp metadata. It never opens, copies or serializes its contents.
The child inherits only the fixed environment: no API key, provider command,
transport/endpoint override or ambient environment is passed. Native credential
refresh may change metadata; such drift causes Unknown and never grants replay.
The owner separately binds the authorized existing native subscription route.

The implementation uses a direct native executable in the owned pilot worktree,
with Grok's native read-only sandbox. It does not use a bubblewrap launcher, so
there is no launcher/native PID ambiguity. The actual child must be a direct
owned process whose `/proc` parent, executable inode, start ticks and CWD match.
No argv or environment is read. The retained identifiers are salted through the
public privacy helper. The observation's wall times measure the controller
interval; they are not invented native process-creation timestamps.

The root's bounded parent/source cgroup remains required for actual execution.
The producer has finite native probe and source deadlines and scoped child
cleanup. No ordinary services, provider credentials or unrelated processes are
managed by this adapter.

## Attempt and delivery semantics

An exclusive, no-follow, fsynced 64-byte attempt fence precedes every native probe
and source launch. The create and directory fsync use the same pinned directory
inode. A fence without a complete source receipt refuses every later source
attempt. Failed, ambiguous and interrupted runs are never retried by this adapter.

Successful source completion writes an exclusive immutable safe receipt before
final delivery. Metadata-only replay validates the exact serialized request,
original epoch, source/session/process binding and evidence digest, then replays
only lifecycle facts and the identical managed-controller trace through existing
public worker APIs. It never inspects, authenticates or launches Grok again.
Backend visibility stays Unknown until the owner obtains independent readback.

Native NDJSON is bounded and transient. Response, reasoning, raw source IDs,
paths, errors, argv and environment never enter retained source evidence.
Missing native usage counters remain unknown and incomplete usage remains
explicitly incomplete. Native reported prompt-ledger counters are not normalized
into controller usage or treated as total title/HTTP/billing counters.

The native private home may retain fixed-example prompt/response, reasoning,
SQLite, identifiers, documentation and cache. No global persistence suppression
or ZDR guarantee is claimed. The owner retains these private artifacts for
cleanup review without exporting their bodies.

## Offline validation

The focused wire suite covers fixed title/main semantics, source invocation
versus native retry counters, empty executable catalogs, content/error removal,
CWD/session boundaries and invalid/truncated/extra events. The producer suite
compiles an owned synthetic C executable and uses a real private Unix socket.
It verifies actual PID/starttick/executable provenance independently, JSON salt
redaction, metadata-only replay, immutable process/session tampering, stale epoch,
unsafe inventory, auth-metadata drift and failed-attempt replay refusal. These
are local synthetic contract tests and do not establish native Grok inference or
production/backend acceptance.


Review corrections add atomic, no-replacement diagnostic checkpoints before
inventory, before source dispatch, after native exit and after source retention.
Each checkpoint uses a positive typed schema containing only a request digest,
finite operation/stage/category, dispatch count, optional native exit status,
stream byte counts and bounded known protocol-tag counts. Stderr is drained and
counted without conversion to text. No arbitrary error, body, argv, environment
or identifier enters a diagnostic. Failure retains the same invocation fence;
metadata replay never overwrites checkpoints or retries a source invocation.

A network-isolated installed 1.0.77 contract fixture returned a synthetic
successful `session_title` result and one synthetic fixed main response. It
observed two logical operations and two synthetic POST requests, with no live
provider/auth. The stream order was catalog, catalog, text, catalog, usage, end;
all three catalogs exposed zero executable tools and no title tool-call event
was emitted. The decoder therefore permits at most four empty catalogs before
terminal completion, including after text. Executable tool-call/update events
remain refused. Live HTTP retries remain unknown.

The data-only native configuration builder is ported from the current Claude
lane and extends its finite harness union with `grok`. Private separate-runtime
checks establish exact Codex/Claude output-byte parity with the prior builder
and frozen8029 Grok configuration decoding/controller/projection/protobuf
composition. These checks start no worker, service, provider or session.

The error observer retains only optional `nativeReportedNotSignedIn: true` when
a bounded native `error.message` contains the qualified documented literal
`Not signed in` and the main process has a known nonzero exit. Missing, malformed,
unmatched or oversized data remains unknown. The literal and all raw message,
CWD, spending and other fields are discarded. This reports what the native
error said; it does not attest session validity, quota, isolation correctness or
the cause of an earlier failure. The historical failed attempt stays unchanged,
and no native consumer, profile, login or retry behavior changes with this
observation-only revision.

The current candidate pins native 1.0.77 inspection and streaming protocol, matching the qualified current standalone CLI. Its no-network synthetic title/main contract uses the same exact production feature toggles, private profile, 23-tool denylist and zero source inventories. The saved native GROK_AUTH_PATH consumer, profile, native read-only sandbox, untrusted project and empty context/tool requirements remain unchanged; no separate grokv proxy/auth-provider route is inherited. A version correction does not retroactively diagnose the failed1.0.73 attempt.
