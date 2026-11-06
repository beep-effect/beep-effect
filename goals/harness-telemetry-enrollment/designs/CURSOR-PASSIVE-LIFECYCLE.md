# Cursor CLI passive lifecycle: source and admission contract

Private preparation on main `e66013fb6c6e7b8e9b91ceb590275c32b6c118d2`.
No hook installation, native/provider/auth call or real native callback has occurred.
This is distinct from the blocked strict zero-tool fixed-response canary.

## Version-matched local CLI witness

Public documentation: <https://cursor.com/docs/hooks>. Its IDE/cloud distinctions
cannot establish local CLI behavior by themselves. The installed public source
for **2026.11.05-86047df** does establish the local dispatch path:

| File | SHA-256 | Decoded-text character offsets |
|---|---|---|
| `1212.index.js` | `15b18cb92aa4093acc886d1ef6f6f308bc97a9abca69b89cde805f91e9760042` | `run-agent.tsx` module 704886; end callback 716227; start callback 724929; memoized end dispatch 728667 |
| `5504.index.js` | `02ddf6e240a6f229fcf6e2b414479b26dfd4ad64199fd33ce7a872a391d6fe9c` | `executeHookForStep` 74256; common payload construction 74743 |

The `1212.index.js` character offsets above correspond to byte offsets 705842,
717183, 725885 and 729623 respectively. The distinction matters because the
preceding decoded source contains multibyte text.

The local start callback runs for a new, unresumed conversation; it is asynchronous
and reports `is_background_agent:false`. The local end callback supplies a reason,
final status and wall-clock-derived `duration_ms`; shutdown memoizes the end
dispatch. Resuming a conversation may therefore produce an end without a new
start. The common executor supplies `session_id` from native `session_id` or
`conversation_id`, and adds event name, version and workspace roots. The worker
claim lifecycle in `8493.index.js` is a separate population and is not this proof.

No native absolute timestamp is present in the reviewed lifecycle payload.
Reported duration is session duration, not model latency. Collector receipt time
must be labelled observer-clock time. Neither an end reason of `completed` nor a
native session occurrence establishes successful inference or all activity.

## Smallest coherent implementation slice

1. Add one schema-first **positive native lifecycle metadata** codec, with a
   versioned Cursor CLI adapter. Decode only start/end; reject inconsistent
   session/conversation IDs, unknown kinds/reasons, invalid numeric bounds and
   oversized/truncated input. Project finite event kind/reason/status, salted
   native IDs, reported duration when present, and explicitly unknown native
   absolute time. Drop raw model descriptions, email, paths, transcript, prompt,
   message, exception, tool and arbitrary maps before logging or storage.
2. The installed reader observes bounded Linux ancestry, process start ticks,
   executable identity, kernel cwd and the enrolled hook/runtime artifact pins.
   Receiver-owned policy binds host/root/namespace/route. Callback JSON fields,
   workspace_roots, environment strings and `callerVerified:true` never establish
   that binding. Label assurance **same-UID, nonexclusive, native-reported event
   plus kernel-observed runtime**, not security attestation or merge authority.
   The reader does not inspect process argv/environment or client auth files.
3. Add a narrow bridge to existing `NativeTraceMetadata`/`NativeTraceBatch` and
   the existing `journal.acceptBatch` storage. Preserve lifecycle metadata as its own typed
   positive field instead of manufacturing `ManagedControllerObservation`, whose
   exact-response contract is unsuitable. Receiver policy authorizes that field;
   arbitrary raw OTLP custom attributes cannot mint it. Reuse native intake's
   transaction, expiry/conflict/idempotency rules, scheduler and readback.
4. Use a stable event identity from enrolled runtime-instance/generation + salted
   native conversation/session ID + lifecycle kind. Duplicate same payload gets
   the same committed receipt; conflicting payload under the same identity is
   refused. A resumed process has its own observed runtime instance. Missing start
   or end remains Unknown, never fabricated or inferred from duration.
5. Construct an allowlisted record before any disk write. Durably commit record
   and receipt before acknowledging local intake; bounded delivery uncertainty
   retains the same event and never replays a model invocation. Do not claim
   durable acknowledgement to Cursor itself: these hooks are fire-and-forget.
   Hook stdout is always empty; no env/context/followup/blocking instruction is
   emitted. One designated real callback and same-event backend readback remain
   later admission, not preparation.

## Concrete current codec boundary

The private source slice now adds a positive lifecycle codec to
`NativeTraceMetadata`, a receiver-owned scoped Unix bridge, and the native export
mapping. The helper is embedded in the installed source artifact and launched by
Effect's process service with an empty environment. It owns its socket, observes
`SO_PEERCRED`, rechecks bounded process ancestry and hashes the approved public
runtime/source files. The bridge uses the existing observation pause gate and
native SQLite intake; it sends its private acknowledgement only after the durable
transaction. The callback forwarding function projects known native fields before
transport and prints nothing. No hook configuration or listener is activated by
importing these modules.

## Offline and later runtime acceptance

Executable tests in `ai-metrics/test/cursor-lifecycle.test.ts` replace the initial
admission-failure fixture draft (retained privately). Synthetic Unix peers exercise
actual kernel observation, content removal, source/root/runtime refusal, paused
and full intake, host mismatch, duplicate/conflict readback and a lost local ACK.
The backend wire test preserves lifecycle labels and the first durable intake's
observer-clock point; source absolute time and model usage remain unknown. An end
without a start stays a standalone observation; reported duration never becomes a
fabricated interval. The helper neither reads native auth nor starts Cursor.

This is a bounded per-occurrence receiver primitive. Host admission still must
qualify the installed listener/supervisor and callback configuration, peer ancestry,
current runtime and root binding. Same-UID provenance is nonexclusive and does not
provide merge authority or a complete activity denominator. The callback's
fire-and-forget behavior can lose observations before local durable acceptance;
local ACK uncertainty permits metadata readback, never an automatic native replay.

Before enabling a project-scoped hook, independently bind the exact installed
version/source/config and kernel/runtime/root observation. Do not edit global
hooks, weaken the controlled canary, open a public receiver, reuse worker-claim
semantics or require successful inference before observing a bounded callback.
Only later positively observed/accepted/visible event counts may be reported;
original launches, missed hooks, usage and all-seven populations stay Unknown.
