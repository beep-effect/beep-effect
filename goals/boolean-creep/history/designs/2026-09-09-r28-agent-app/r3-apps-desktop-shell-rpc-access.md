# Instance

- id: `r3-apps-desktop-shell-rpc-access`
- file:line: `apps/professional-desktop/src/App.tsx:775`
- symbol: `DesktopShell.rpcAccess`
- members: `transport.ipc`, `desktopRpcAvailable`
- evidence: E4 at `App.tsx:124-125` — `hasDesktopRpcAccess` is
  `transport.ipc || Option.isSome(transport.rpcSessionToken)`, so IPC always
  implies desktop RPC access and the IPC-without-access pair is impossible.

# Current shape

The decoded `SidecarTransport` wire model carries the independent transport
bit and optional RPC session token. `App.tsx` repeatedly re-derives a broader
desktop-RPC capability boolean, then combines that capability with the
transport bit for protocol binding, gated surfaces, shell navigation, and the
IPC spike. Those decisions describe one session kind: chat-only HTTP,
authenticated HTTP, or IPC. The wire model itself remains valid and must not
change in this Tier 1 migration.

# Cardinality gap

The derived pair exposes four combinations, while three application session
states are legal: `chat-only-http`, `authenticated-http`, and `ipc`.
`ipc && !desktopRpcAvailable` cannot occur by construction. Both IPC payload
forms accepted by `SidecarTransport` map to the `ipc` application state; this
does not tighten the transport codec.

# Target schema

Define a private annotated `DesktopSession` tagged union from the LiteralKit
already imported by `App.tsx`, with payload-free `chat-only-http` and `ipc`
cases plus `authenticated-http { rpcSessionToken: NonEmptyString }`. Add one
pure classifier from `SidecarTransport`: IPC wins first, an HTTP transport with
a session token is authenticated and carries that token, and an HTTP transport
without one is chat-only. This is a tagged union rather than a payload-free
literal because the authenticated branch owns the token required to construct
its protocol layer. Derive all capability and transport-specific UI/protocol
decisions from this union.

# Migration inventory

- `App.tsx:69-126` — add the private annotated tagged union near the
  application helpers and replace `hasDesktopRpcAccess` with the single
  session classifier. Reuse the existing `$I` identity composer and LiteralKit
  import; use a named non-empty-string schema for the authenticated payload.
- `App.tsx:169-184` — make `DesktopSessionGate` permit
  `authenticated-http` and `ipc`, and render the current notice for
  `chat-only-http`; preserve loading/failure behavior.
- `App.tsx:232-253` — classify once in the protocol-layer binding and match
  exhaustively. Keep IPC on `IpcChatProtocolLive`, authenticated HTTP on
  `makeDesktopHttpProtocolLive(rpcSessionToken)`, chat-only HTTP on
  `HttpChatProtocolLive`, and retain the current ontology fallback for the
  chat-only state. Consume the authenticated case payload directly; do not
  re-check the original Option or use a non-null assertion.
- `App.tsx:763-853` — replace `desktopRpcAvailable` and the direct
  `transport.ipc` UI branch with exhaustive session-kind decisions. Preserve
  the Beliefs/contradiction-triage visibility rule and render `IpcSpikePanel`
  only for `ipc` plus the independent query-string spike flag.
- `App.tsx:856-921` — keep `DesktopBootstrapState.ready.transport` as
  `SidecarTransport`; bootstrap and probe failure shapes are independent and
  unchanged.
- `transport/SidecarTransport.ts:1-35` and the Tauri/Rust
  `sidecar_transport` response remain byte-for-byte compatible. Do not move
  the session literal into the wire schema.
- `test/App.test.tsx`, `test/dock-shell.test.tsx`,
  `test/tauri-ipc-socket.test.ts`, and `test/schema-parity.test.ts` cover the
  affected shell, transport, and codec seams; add explicit three-state shell
  assertions without weakening existing IPC token tests.

# Guard-deletion accounting

Delete `hasDesktopRpcAccess`, the `desktopRpcAvailable` local, the duplicated
`transport.ipc || Option.isSome(sessionToken)` protocol guard, the protocol
layer's second token-presence match, and the direct `transport.ipc`
shell-render guard. One `DesktopSession` classifier owns the implication and
token presence, and exhaustive matches/derived union guards own the capability
and IPC-only decisions.

# Encoded-side impact

None. `SidecarTransport` remains the decoded wire model with the same `ipc`
boolean, optional `rpcSessionToken`, defaults, accepted combinations, and
Tauri command payload. No session tag is serialized, persisted, exported, or
sent over HTTP/IPC. Protocol URLs, headers, and authentication behavior remain
unchanged.

# Test impact

Cover all three application states plus both accepted IPC token-presence
forms. Assert chat-only HTTP hides Beliefs and renders gated notices,
authenticated HTTP exposes desktop RPC surfaces without the IPC spike, and
IPC exposes them while the spike still requires its separate query flag.
Retain exact protocol-layer selection and SidecarTransport decoding tests.
Because shell navigation is gesture-bearing, record the affected browser flow
through the portless package script and complete record, extract, and judge
with `requiredCount: 0`. Run focused app/dock/transport tests and full
`@beep/professional-desktop` package verification.

# Risk and sequencing

Land in Tier 1D with the application UI state batch. Classifier precedence is
part of compatibility: any `ipc: true` transport remains IPC regardless of
token presence. Keep the query-string spike flag independent and do not turn
this internal view-state refactor into a `SidecarTransport` wire migration.
