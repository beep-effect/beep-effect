# Observation boundary structure review

Independent Astra source review accepted the five-file change against
`b88c377d77f31f294900d2eaa611af7b9e8ed2b4` without an actionable regression.
This is source-semantic review; execution evidence is recorded separately.

The worker still checks socket type, present matching UID and exact 0600 mode.
Its four journal checks remain sequential and precede the absent-socket return.
Socket cleanup remains tied to the acquired inode, with qualification,
credentials and finalizer placement unchanged. AgentMessage resolves UID lazily
at six original call sites; its inode predicate still requires both values to
be present and equal after the unchanged device and private-file checks.

The export selection schema admits precisely integer offsets 0..4095 and limits
1..512 before page lookup, retaining the invalid-selection error. No encoding
or lookup-order change follows the predicate. Discovery initialization remains
lazy and uninterruptible, consuming one operation before reading an event.
Terminal state precedes closure, and completion follows closure. Cursor, budgets,
semaphore, owner scope, interruption handling and source-order appends remain.
Read counters change only after whole-sweep validation, with partial/backlog
precedence and one-shot behavior preserved by exhaustive outcome matching.

Claim text is read inside the original descriptor scope after metadata checks,
with the same 8193-byte sentinel, empty/oversize refusal and strict UTF-8 decode.
Replay equality precedes original-record synchronization. Reconciliation retains
inspect, deliver, receipt validation, compare/resync-or-publish, then acknowledgment
inside the original permit and ten-second deadline. No error mapping, replay
condition, resource scope or publication boundary was broadened.

Reviewed SHA256s:

- ObservationWorker.ts: `d8b79d38f000eaa6c0401e305f36ba31f1532bce5b75848324a52eb9185d3617`
- AgentMessage.observation.ts: `0387bf4cb77537dcc88a0478bdb8c5c99645390649d2994f4c797d553e983098`
- internal/observation-export-reader.ts: `4dea9a8df87d480a15cd8f7d8a7d4c4954b7ca6c0f2b0214259c44c5ec08eced`
- transcript-discovery.ts: `63b0c93bdb340f663769a70f042125bd8c45928ab15c1ee3627bdb9df3645fb2`
- observation-launch-claims.ts: `54935b1fbceb57b7decb72c5913a6be7dc13419b3e37ad8f90b81f912c6b4069`

The reviewer made no edits and ran no tests or services. This review approves
no threshold change or suppression and does not lift the recovery hold.
