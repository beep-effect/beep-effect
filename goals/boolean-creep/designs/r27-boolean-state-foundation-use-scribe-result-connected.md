# Instance

- ID: `r27-boolean-state-foundation-use-scribe-result-connected`
- Source: `8f266b878445ca8a7f751f9248da428a4dde39a1`
- Corpus: `origin/main@663904610cce2a38c06b0619a8c414646b69361c`
- Owner: `packages/foundation/ui-system/ui/src/hooks/use-scribe.ts:134`, `UseScribeResult`
- Members: `isConnected`, `status`; derived, internal, Tier 1C.
- Companion: `foundation-ui-system-speech-input-connection` in the same batch.
- P2 design only; no implementation, P3, or status advancement is claimed.

# Current shape

The private interface returned by the exported `useScribe` hook at
`use-scribe.ts:207` includes `isConnected: boolean` at 140 and
`status: ScribeStatus` at 142. `ScribeStatus` is the locally owned literal
union `idle | connecting | connected` at 77, not an ElevenLabs SDK type.
The sole return object at 365–374 writes `status: state.status` and
recomputes `isConnected: state.status === "connected"` at 371.

The source atom at 154 stores only status, complete committed transcript
messages, a partial transcript string, and `error: string | null`.
The result also exposes clear/connect/disconnect functions. These
operational capabilities remain functions; the data invariant is the
duplicate status projection, not the presence of those callable members.

# Cardinality gap

Boolean × three real literal values represents six states. The only
supported tuples are `(false,idle)`, `(false,connecting)`, and
`(true,connected)`. Every atom state, including an error-bearing connected
state, passes through the same return expression. There is no supported
fixture or alternate result constructor that independently selects the bit.
The full transcript payloads and nullable error remain orthogonal; this
proof does not restrict them by lifecycle state.

# Target schema

Use **one canonical `ScribeStatus` LiteralKit** at its existing owner
`hooks/use-scribe.ts:77`, as already designed by the companion speech-input
instance. The hook-result design owns the implementation of that promotion;
the companion imports the value and type. Do not create a second status
kit, new vocabulary, or another state atom.

```ts
const $I = $UiId.create("hooks/use-scribe")

export const ScribeStatus = LiteralKit(["idle", "connecting", "connected"]).pipe(
  $I.annoteSchema("ScribeStatus", {
    description: "Lifecycle state of a Scribe realtime connection.",
  })
)
export type ScribeStatus = typeof ScribeStatus.Type
```

Remove `isConnected` from `UseScribeResult` and its return object. Keep
`status: ScribeStatus`; use the kit's existing literal values and guards
at source status writes/reads. The interface remains an operational hook
result with methods, not an exported pure-data wire model requiring a
new all-encompassing class schema. No alias/getter of `isConnected` remains.

Preserve `ScribeState`, its Atom family scope and subscription, SDK
configuration, connection refs, callbacks, promise orchestration, and the
entire existing nullable/error/transcript behavior. Existing legacy React
hooks are not replaced in this bounded carrier migration, and no new
React state/effect/ref mechanism is introduced. That separate broader
hook modernization is not needed to remove the duplicate projection.

The lifecycle proof must follow current source rather than an idealized
connection state machine:

- Initial state and explicit disconnect are idle (`155–160`, `223–226`).
- Connect disconnects the prior connection and writes connecting before
  calling the SDK (`247–252`). OPEN writes connected only on first
  settlement (`297–302`).
- Before OPEN, ERROR/AUTH/QUOTA reject and return idle (`305–336`);
  unhandled synchronous connection failure records error and idle at
  `234–242`.
- **After OPEN, ERROR/AUTH/QUOTA still update error/callbacks but do not
  change status**: `settled` is already true, so the idle write at 314
  does not run. Error may coexist with connected. CLOSE writes idle at
  324 regardless of that settlement state. Do not repair this behavior
  while removing `isConnected`.
- Unmount closes the ref and nulls it (`357–363`); retain exact listener,
  stale-connection, settlement, and callback ordering. The D1
  `handledError`/`settled` row is a separate cluster and stays unchanged.

# Migration inventory

- `packages/foundation/ui-system/ui/src/hooks/use-scribe.ts:35–42,61–77`:
  add the existing package identity/schema imports and promote the local
  status declaration once. Retain all three strings and same-name type
  export; annotate the value and update its examples.
- `use-scribe.ts:134–143`: delete only `isConnected` from the result's
  lifecycle surface. Keep functions, readonly complete SDK messages,
  error nullability, and both transcript fields.
- `use-scribe.ts:154–160,223–251,297–324`: use the same kit's Enum values
  at status writes without changing the state spread, event conditions,
  or operation timing.
- `use-scribe.ts:365–374`: return the one upstream status; remove line 371.
- `packages/foundation/ui-system/ui/src/components/speech-input.tsx:10,19`:
  import the canonical kit alongside `useScribe` and existing SDK type
  exports. This is the sole executable in-repo hook caller, at 210.
- `speech-input.tsx:288–300`: companion migration passes `scribe.status`
  into `SpeechInputContextValue`, removing both context flags, including
  the current read of `scribe.isConnected` at 289.
- `speech-input.tsx:316`: use `ScribeStatus.is.connected(scribe.status)`
  for root styling; this is the only other direct `scribe.isConnected`
  reader. Remaining child context migrations belong to the companion.
- `packages/foundation/ui-system/ui/package.json:108,130`: retain the
  existing wildcard hook subpath export. `ScribeStatus` gains a runtime
  value export at the same path; `useScribe` keeps its signature except
  removal of the redundant decoded result property. No manifest change.

Exhaustive symbol/subpath searches across current packages/apps and
repository TS/TSX/MDX found only `speech-input.tsx` as an executable caller;
there is no separate `UseScribeResult` export or external in-repo result
constructor. The hook's public return type still changes, so land its two
direct readers and the companion context migration atomically. Do not
retain a compatibility Boolean merely because the hook is exported.

# Guard-deletion accounting

- Delete the returned comparison at `use-scribe.ts:371` and the redundant
  `isConnected` interface member at 140.
- Delete the direct materialization into the second context's Boolean
  at `speech-input.tsx:289` in the coordinated companion change.
- Migrate root styling at `speech-input.tsx:316` to the existing status
  guard; do not count its necessary presentation branch as deleted logic.
- The companion separately accounts for its connecting projection and
  compound icon coherence conditions. Count shared status-kit promotion
  and shared source edits once, not as two independent implementations.

The saving is removal of a redundant derived member. No request-id,
settlement, error-recovery, or connection cleanup guard is deleted.

# Encoded-side impact

None for persisted/wire data. The hook result is in-memory UI data and
functions. SDK event payloads, token/config inputs, exported
`AudioFormat`/`CommitStrategy`, option omissions, transcript event payloads,
and nullable error values remain exact. `ScribeStatus` keeps its three
runtime strings. The exported decoded hook return loses `isConnected`
in the same change that migrates every known reader.

# Test impact

No current test or story imports `useScribe` or `SpeechInput`. Add focused
hook coverage through the public hook using an isolated Atom registry and
a deterministic ElevenLabs connection double. Assert exactly the three
statuses; cover initial, pending connection, OPEN, pre-OPEN error/close,
post-OPEN error with status still connected, later CLOSE, disconnect,
clearTranscripts, partial/committed messages, reconnect, and unmount.
Assert full message objects and nullable error values survive, controls
keep their invocation behavior, and the returned object has no
`isConnected` member. Avoid testing only the implementation comparison.

Run the companion's component and request-race tests in the same batch.
Recorded QA uses its portless Storybook microphone/SDK doubles and actual
record/cancel buttons. Pending token lookup remains idle; connecting
begins after token resolution invokes `connect`. Include a post-OPEN error
followed by CLOSE to prevent the schema refactor from hiding the current
status/error semantics. Require record → extract → judge, capture-green
and `requiredCount: 0`, plus
`bun run beep quality package-verify @beep/ui` before implementation
handoff. None of these runtime checks is claimed by this design-only pass.

# Risk

Land with `foundation-ui-system-speech-input-connection` in Tier 1C.
The main risks are leaving a stale public-result reader, promoting two
independent status kits, conflating error with idle, or changing stale-start
and close/error ordering during an unrelated hook rewrite. Shared schema
promotion is owned here; the companion owns context and visual-reader
migration. Both designs require fresh independent review together.
