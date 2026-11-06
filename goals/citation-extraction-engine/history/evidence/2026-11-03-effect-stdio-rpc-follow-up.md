# Effect stdio RPC follow-up

The independent reviewer continued the operator-requested module audit to compare
Socket, Channel and direct stdio RPC with mandatory Worker adapters. This follow-up
revises the initial transport recommendation: typed RPC directly over the current
Effect Stream/Sink process transport is the smallest natural fit. WorkerPlatform
and WorkerRunnerPlatform are optional, not required architecture.

Read-only scope: implementation `d449931c3ac45bd877814f57658f3a86d4a30ee8`,
installed Effect 4.1.1, canonical `7a87ff9b88b1a570995b1b5570559c1b4dd5367b`.
No additional suites or behavioral probes were run in this follow-up.

## Existing stdio module

Installed `effect/src/rpc/RpcServer.ts:1549` already implements
makeProtocolStdio/layerProtocolStdio. It reads Stdio.stdin with Stream.runForEach,
uses RpcSerialization, routes through the normal RPC server callback, and writes
stdout through a queue bounded at eight messages. It models one client, ID zero.
This is directly relevant upstream precedent and was missed in the first pass.

It cannot be adopted unchanged for this one-job native boundary:

- Both input and output pipelines retry every 500ms. The input parser lives
  outside the retry boundary, so it is retained across retries.
- Response encoding happens before Queue.offer. A bounded item queue does not
  bound encoded buffers retained by concurrent blocked senders.
- Error logging retains causes unless they have already been sanitized.
- It does not supply predecode allocation admission or physical retirement.

Use the upstream Rpc/RpcGroup, RpcClient.make, RpcServer.make, RpcSerialization
and Protocol services. Specialize only the bounded stream/process adapter: no
transport retry/reconnect, one persistent writer, terminal source-free failures,
exact allowed messages, and external retirement ownership.

## Alternatives compared

| Composition | Useful upstream behavior | Additional policy or mismatch | Assessment |
| --- | --- | --- | --- |
| Direct RpcClient.Protocol and RpcServer.Protocol over Effect stdio | Typed calls/codecs, request and error routing, direct Stream/Sink use | Bounded decoder/writer, terminal-error delivery, one-job rule, retirement barrier | Recommended |
| Socket.make plus stock RPC socket client | Scoped pull reader/writer, backpressure and RPC integration | Stream/sink adapter, retry settings, pinger, fail-closed parsing, retirement | Viable but adds policy adaptation |
| Socket.fromTransformStream | Web Streams acquisition, cancellation and backpressure | Convert already Effect-native streams/sinks and add writable bridge | Extra layer here |
| RpcServer.layerProtocolStdio | Existing stdio server and bounded item queue | Unconditional retries, retained parser, encoding before admission | Reference implementation, not a drop-in |
| SocketServer with RPC socket server | Accept-loop transport | Stdio has no listening endpoint; synthetic accept semantics or another endpoint | Poor fit |
| Channel duplex composition | Scoped pull/push and writer-failure propagation | Still needs an RPC Protocol | Useful inside the adapter, not an extra required service |
| Worker services | Worker message/readiness abstraction | Additional worker envelopes and startup semantics | Optional for a future worker-style backend |

## Source-backed details

Socket.make packages scoped reader/writer acquisition (installed Socket.ts:104).
Closing a reader's acquisition scope must unblock an outstanding pull. Normal
EOF is represented by a SocketError close reason. A stdio adapter would still
need stdout pull, EOF translation, pending-pull shutdown, one persistent stdin
writer, admission before writing and separate child retirement.

Socket.fromTransformStream (installed Socket.ts:1283) expects Web readable and
writable streams. The current ChildProcessHandle already supplies Effect Stream
and Sink, so conversion is unnecessary unless the backend changes.

RpcClient.makeProtocolSocket (installed RpcClient.ts:1276) reconnects by default.
Schedule.recurs(0) can disable reconnect attempts; retryTransientErrors:false
alone does not. It has periodic pings without an explicit disable switch. A
finite interval beyond the complete operation lifetime can avoid pings during a
bounded job, but introduces another configuration relationship. Parser failures
broadcast ClientProtocolError without inherently retiring the transport. Its
Interrupt path is not physical child termination or acknowledgement.

The public server socket protocol requires SocketServer.SocketServer. Its
single-socket makeSocketProtocol/onSocket helper is private (installed
RpcServer.ts:1704); constructing a synthetic listening server adds no value.

Channel.fromTransform/toTransform, Stream.toPull and Sink.toChannel are suitable
internal primitives. There is no public general makeProtocolChannel or
makeProtocolStream in installed 4.1.1.

The convenience RpcClient.Protocol.make and RpcServer.Protocol.make constructors
also have ordinary pre-run arrays in rpc/Utils.ts. A custom adapter must gate
reading on consumer startup and stop reading on shutdown, or construct the
Protocol service directly with an explicitly scoped run method. Do not claim a
bounded transport while messages accumulate in those convenience buffers.

## Minimal adapter responsibilities

- Consume one incoming byte stream through the selected bounded decoder.
- Route typed RPC envelopes through the upstream protocol callbacks.
- Admit outgoing allocation and byte counts before serialization/queueing.
- Use one writer lifetime. ChildProcessHandle.stdin is an Effect Sink, not an
  arbitrary reusable write function; its default endOnDone behavior closes it
  after a run. Repeated per-message sink runs can close stdin after message one.
- Fail terminally on malformed/extra input, I/O failure, EOF or scope closure.
- Deliver closed, redacted transport failure to pending calls.
- Stop accepting and decoding messages when the consumer ends.
- Implement no retry, reconnect, worker restart or native lease release.

Keep the exact process handle and native lease in the retirement owner. An RPC
Exit is a candidate result, never proof of physical exit. A synchronous child
cannot service an RPC Interrupt, so the parent deadline and hard termination
remain independent of RPC handler cooperation.

## Required focused proof

Retain the full lifecycle/fidelity suite from the primary audit, and add controls
for one malformed frame causing one terminal failure with no reread/restart,
broken streams never replaying an envelope, no pre-run/late-response buffer
amplification, scope closure unblocking reads and writes, multiple writes sharing
one stdin lifetime, stalled sinks bounding pre-encoded sender data, startup
message floods failing before buffer growth, and candidate success/error
publication waiting for exact retirement acknowledgement.

SchemaBinary remains an optional later wire-format change. Its pre-allocation
and isolated-surrogate constraints from the primary audit are unchanged.
Transactional native admission has been implemented separately in f6c8c62a45;
this follow-up does not claim that RPC transport migration is complete.
