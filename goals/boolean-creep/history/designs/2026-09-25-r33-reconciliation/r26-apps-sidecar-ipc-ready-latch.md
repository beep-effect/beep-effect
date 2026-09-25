# Instance

- id: `r26-apps-sidecar-ipc-ready-latch`
- source: `3330f9881a50c96d3f2ec0fcad76f0f7a09027e4`
- corpus: `origin/main@52fcc8d1353db9481ef9edb6cc9619500f95568d`
- file:line: `apps/professional-desktop/src-tauri/src/lib.rs:1426`
- symbol: `Sidecar.ipcReady`
- members: `ipc`, `ipc_ready`
- evidence: E1/E4 at `lib.rs:1426,1530` and `lib.rs:1277-1297` —
  HTTP initializes ready, IPC initializes not ready, and the listener-ready
  command can only advance the IPC handshake to ready. HTTP-not-ready is not a
  supported delivery state.

# Current shape

The setup path reads `CHAT_TRANSPORT` into `ipc`, threads that boolean through
process spawning and the event bridge, and initializes a separately shared
`AtomicBool` as `!ipc` (`lib.rs:1426-1539`). The atomic means two different
things: HTTP events may emit immediately, while IPC events may emit only after
the webview registers listeners and invokes `sidecar_ipc_ready`. Before that
command, complete IPC frames and close payloads are buffered
(`lib.rs:634-729, 1025-1195`). The ready command drains frames while holding
their lock, sets the atomic, and then replays any pending close payload
(`lib.rs:1273-1315`).

The serialized `SidecarTransport.ipc` field at `lib.rs:32-37,356-387` is a
separate Tauri boundary projection. The frontend uses it to choose HTTP versus
IPC and invokes the listener-ready command only for IPC
(`TauriIpcSocket.ts:348-404`). That wire field remains unchanged.

# Cardinality gap

Two booleans represent four combinations. Three delivery states are legal:

| Delivery state | `ipc` | `ipc_ready` |
| --- | --- | --- |
| HTTP ready | false | true |
| IPC buffering | true | false |
| IPC ready | true | true |

HTTP-not-ready is absent by construction. IPC buffering and IPC ready are both
observable across threads and must remain distinct.

# Target schema

Use an idiomatic private Rust enum, `SidecarDeliveryState`, with
`HttpReady`, `IpcBuffering`, and `IpcReady` variants. Store it behind the shared
`Arc<Mutex<SidecarDeliveryState>>` currently occupied by `SharedIpcReady`.
Provide narrow enum/owner methods for transport selection, immediate-delivery
permission, and the one-way IPC-ready transition. Do not model this Rust state
with a TypeScript LiteralKit or duplicate it with boolean fields/getters.

Initialize the enum once from the configured transport. Use the enum as the
event bridge's transport/readiness owner, while projecting the existing `ipc`
boolean only at the `SidecarTransport` command boundary. A mutex is preferable
to a hand-encoded `AtomicU8`: the domain remains type checked and the existing
pending-frame lock ordering can make the buffering-to-ready transition atomic
with frame replay. Mutex lock/unlock supplies the synchronization previously
provided by sequentially consistent atomic loads/stores.

# Migration inventory

- `apps/professional-desktop/src-tauri/src/lib.rs:9-12` — retain
  `AtomicBool` and `Ordering` for the independent `DesktopShutdownState` latch;
  this migration removes only their IPC-readiness uses.
- `lib.rs:446-456` — replace `ipc_ready: SharedIpcReady` and its alias with the
  private enum and shared mutex owner. Keep pending-close, pending-frame, and
  process fields unchanged.
- `lib.rs:594-602, 1358-1437` — classify `CHAT_TRANSPORT` into the delivery
  enum for bundled-sidecar setup and logging. Preserve the default that every
  value other than exact `ipc` means HTTP. The standalone transport probe must
  still work in debug HTTP mode, where setup deliberately manages no `Sidecar`.
- `lib.rs:634-729` — replace readiness loads with exhaustive enum decisions.
  HTTP and IPC-ready emit immediately; IPC-buffering stores frames/close
  payloads exactly as today.
- `lib.rs:966-995, 1025-1195` — drive raw-versus-line stdout handling,
  buffering, incomplete-frame termination, and transport logging from the
  enum owner rather than a parallel `ipc` function parameter. Preserve all
  error paths and lifecycle transitions.
- `lib.rs:1273-1315` — while retaining the pending-frame lock, replay frames
  in order and advance only `IpcBuffering` to `IpcReady`; then replay the
  pending close payload. Preserve repeat-call behavior, log text, and errors.
- `lib.rs:1426-1542` — initialize one delivery owner, pass it through spawn and
  bridge setup, and remove `AtomicBool::new(!ipc)`.
- `lib.rs:356-387, 608-621, 1202-1270` — retain the Tauri transport response,
  independent debug-HTTP probe path, RPC token authorization and error
  precedence. Project the configured mode to the existing wire boolean only
  where required; do not make the probe depend on `State<Sidecar>` because no
  such state exists for the external development sidecar.
- `apps/professional-desktop/src/transport/SidecarTransport.ts:1-35` and
  `TauriIpcSocket.ts:348-404` — no decoded or protocol changes.

# Guard-deletion accounting

Delete `SharedIpcReady`, the `ipc_ready` field, `AtomicBool::new(!ipc)`, every
`ready.load(Ordering::SeqCst)`, the ready `store(true, ...)`, and the parallel
`ipc` flag threaded through event-bridge decisions. Exhaustive enum matches
own transport parsing, buffer-versus-emit behavior, and the one-way handshake.
Do not add boolean compatibility accessors to the private owner.

# Encoded-side impact

None. Preserve the exact `CHAT_TRANSPORT` interpretation, child environment,
camel-cased `SidecarTransport { ipc, rpcSessionToken }` payload, Tauri command
names, event channel names, NDJSON frames, session-token checks, error strings,
and log events. The private enum never crosses Tauri, stdout, IPC, HTTP, or disk.

# Test impact

Add Rust unit coverage for construction of all three variants, the sole
`IpcBuffering -> IpcReady` transition, repeated ready calls, and immediate
delivery for HTTP/IPC-ready versus buffering for IPC-buffering. Exercise races
between frame arrival and listener readiness, ordered frame replay, a pending
close before readiness, close arrival after readiness, malformed/oversized
frames, and termination with a partial frame. Assert the existing lock order
and absence of deadlock without opening a real sidecar service.

Retain frontend tests for the exact `sidecar_transport` payload, listener
registration before `sidecar_ipc_ready`, token forwarding, and cleanup on
failed listen/ready calls. Run the Rust test target, focused Professional
Desktop transport tests, and full app verification during implementation.

# Risk and sequencing

Land in the Tier 1 Professional Desktop batch. The main risk is changing a
cross-thread happens-before relation or acquiring the new state lock in an
inconsistent order with pending-frame/pending-close locks. Keep the current
frame-lock-before-readiness transition during replay, release state locks
before emitting or acquiring pending-close locks, and preserve event order and
failure short-circuiting.
