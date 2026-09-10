# R27 foundation UI Boolean-state source adjudication and P2 handoff

Source: `8f266b878445ca8a7f751f9248da428a4dde39a1`.
Corpus: `origin/main@663904610cce2a38c06b0619a8c414646b69361c`.
The refs remain frozen; no fetch, merge, source implementation, package
command, browser run, canonical inventory edit, or status change occurred.

Audited all three raw rows and all three footer claims in
`data/sweeps/refresh-2026-09-09-r27-main-663904/r27-boolean-state-foundation.jsonl`
and its `.execution.json:13`. This is source adjudication and authorized
P2 design work, not a census replacement or independent P3 review.
Graft discovery/caller receipts were followed by exhaustive targeted
symbol/subpath searches because top-N graph results cannot prove absence.
Applied schema-first-development, atom-reactivity-specialist, and
browser-qa-loop design requirements. No additional agent was launched.

## Dispositions and current owners

| Raw/canonical ID | Actual carrier | Disposition |
| --- | --- | --- |
| `r27-boolean-state-foundation-spinner-state` | `packages/foundation/ui-system/ui/src/hooks/useSpinner.ts:36`, private `SpinnerState` | Confirm 8/4; correct raw line 38 to declaration 36; new full-payload union design |
| `r27-boolean-state-foundation-use-scribe-result-connected` | `packages/foundation/ui-system/ui/src/hooks/use-scribe.ts:134`, `UseScribeResult` returned by exported hook | Confirm 6/3; correct raw line 140 to declaration 134; coordinate existing ScribeStatus owner |
| `r27-boolean-state-foundation-sidebar-context-open-state` | `packages/foundation/ui-system/ui/src/components/sidebar.tsx:37`, private context returned by exported hook | Confirm 4/2; correct raw line 39 to declaration 37; remove duplicate desktop projection |
| `path-safety-atomic-write-remove-options` | Concrete inline `fs.remove` options in `packages/foundation/capability/file-processing/src/PathSafety/PathSafety.service.ts:291` | Retain D2; kind → object-literal, actual enclosing source owner → `writeWithinCanonicalRootAtomically` |
| `r2-foundation-youtube-watch-event-init` | Concrete inline CustomEvent initializer in `packages/foundation/ui-system/editor/src/youtube-embed.tsx:233` | Retain D2; kind → object-literal, actual enclosing source owner → `onWatch`; line → 233 |
| `chat-composer-props-gates` | `packages/foundation/ui-system/editor/src/chat/chat-composer.tsx:151`, actual exported `ChatComposerProps` | Retain D1 and existing declaration anchor 151; fields are at 185/191 |

No footer row is withdrawn. A descriptive or stale type-like census symbol
needs metadata repair when a concrete object literal is still instantiated.
That differs from an excluded anonymous function flag-parameter declaration
or a synthetic row that has no actual co-carried data object. Here both
external options objects are real `object-literal` carriers, consistent
with the accepted compiler/XML-parser configuration census treatment.

## Spinner: four concrete states and exact lifetime

`SpinnerState` declares `interval: number | undefined`, `runOnce: boolean`,
and `timeout: number | undefined` at
`packages/foundation/ui-system/ui/src/hooks/useSpinner.ts:36–40`.
The numeric members are **actual absence-bearing payloads**, not required
counts projected to zero/nonzero. Their full numeric handle values matter.

| `runOnce` | timeout | interval | Supported sequence |
| --- | --- | --- | --- |
| true | undefined | undefined | initial value at 51; stop reset at 79 |
| true | number | undefined | start from idle or initial delay, 84–101 |
| false | number | undefined | start again after timeout has installed a repeating interval, 90–101 |
| false | undefined | number | timeout callback at 88–94 |

These four rows exhaust concrete producers; the finite quotient is 8/4.
Start preserves the prior `runOnce` value at 99, so a restart after
repetition does not execute the immediate callback at 84. The two delay
states must remain distinct. The delay is 300 ms and interval 50 ms at
32–33; the delay callback creates the interval without itself calling
`run`, so the first repeat is at 350 ms after an ordinary initial start.
`clearSpinnerTimers` reads both handles at 57–64; stop, start, and finalizer
call it at 78, 82, and 111. Preserve handle zero and operation ordering.

The scoped state family at 66 and cleanup family at 109 are separately
mounted at 179 and 180. The source's TTL regression receipt at 172–178
explains why neither can be removed. Cleanup uses the latest state via
`get.once` at 111; it clears timers without writing a reset. The returned
`up`, `down`, and `stop` commands at 182–194 remain callback operations;
they are not additional Boolean members.

Graft identifies `useNumberInput.ts:845` as the caller. Exhaustive TS/TSX/
MDX symbol and import-subpath searches found the same executable caller,
its import at 17, starts at 858/867, and release/leave/touch-end stops at
988–990/997–999. No executable caller of `useNumberInput` was found;
its documentation example at 813 is not a running component. Existing
`test/hooks.test.ts:2` and `test/schema-parity.test.ts:13` import number
helpers rather than the hook. The hooks remain exported: package wildcard
paths at `packages/foundation/ui-system/ui/package.json:108,130`, and the
number-input barrel at `src/hooks/index.ts:18`. This is not a claim about
unknown external consumers and does not justify deleting a public hook.

## Scribe: one local status owner across two qualified projections

The local `ScribeStatus` at
`packages/foundation/ui-system/ui/src/hooks/use-scribe.ts:77` contains
exactly `idle`, `connecting`, and `connected`. It is authored by this
hook, not imported from ElevenLabs. `UseScribeResult` at 134 has
`isConnected: boolean` at 140 and `status: ScribeStatus` at 142.
The only return object at 365–374 sets the bit to
`state.status === "connected"` at 371. Thus the exact supported tuples
are `(false,idle)`, `(false,connecting)`, `(true,connected)`, giving 6/3.

The sibling nullable error and complete transcript arrays/strings remain
real payloads with their existing alternatives; no status/payload
restriction is established here. In particular, after OPEN has set
`settled` true and status connected at 297–301, `settleReject` at 305
still updates error and emits callbacks but its idle write at 314 is
skipped. ERROR/AUTH/QUOTA after OPEN can therefore leave connected status
with error until CLOSE at 324 or explicit disconnect at 226. Pre-OPEN
errors reject and return idle; unhandled synchronous failure returns idle
at 234–242. The two callback latches remain a separate existing D1 row
`r3-foundation-scribe-connect-latches`.

The only executable `useScribe` consumer found by graph and exhaustive
source/subpath search is
`packages/foundation/ui-system/ui/src/components/speech-input.tsx:210`.
It reads the hook bit at 289 and 316. The separately qualified
`foundation-ui-system-speech-input-connection` covers that component's
context `[isConnected,isConnecting]` at 53–54. It already designed promotion
of the same `ScribeStatus` to a LiteralKit. Reuse that owner once and land
both projections' removal in the same Tier 1C change. The prior design's
instruction to preserve the hook convenience bit is now superseded.

The companion update also corrects two source-behavior claims without
changing implementation: token lookup at `speech-input.tsx:248` leaves
status idle until `connect` at 254; post-OPEN errors need not return idle.
Preserve request IDs at 208/239–267, including the stale continuation's
existing disconnect, stop/cancel order at 270–285, and unmount at 302–307.
Do not introduce a second status family, error variant, service redesign,
or broad legacy-hook rewrite. The public hook return loses only the
redundant decoded property; SDK input/output and component contracts remain.

## Sidebar: derived desktop state, independent mobile state, exact persistence

`SidebarContextValue` at
`packages/foundation/ui-system/ui/src/components/sidebar.tsx:37` carries
`state: "expanded" | "collapsed"` and `open: boolean`. The provider
resolves the Boolean at 134 and derives the literal at 189 before returning
both at 191–199. This sole writer supports `(true,expanded)` and
`(false,collapsed)`: 4/2. Neither value is a virtual required-number axis.

Keep the underlying `SidebarState` at 49 and its `[open,openMobile]` D1
row `sidebar-open-surfaces`. Field-specific writes at 143 and 164 and
independent media-query state at 133 support the separate surfaces,
including both true across viewport changes. The existing D1 context
row `sidebar-context-open-flags` is valid at this source pin; after the
qualified change removes `open` from the context, its surviving Boolean
members will be `[openMobile,isMobile]`. Reconcile that census only when
implementation lands.

All current context consumers already use `state` or controls, at
`sidebar.tsx:256,404,439,788`; no consumer reads its `open`. The required
render branches are at 311, 347, and 813. Exhaustive source searches found
no outside `useSidebar` or `SidebarContextValue` consumer, but the hook is
exported at 1058 through the component subpath (`package.json:102,124`).
The public component story file
`packages/foundation/ui-system/ui/stories/components/sidebar.stories.tsx`
imports public components at 1–25. Its IconCollapsible example at 281 uses
only an onOpenChange spy, and the play test at 309–320 asserts trigger
visibility; it is not proof that clicking collapses the panel.

Preserve optional Boolean props at 95–99, defaultOpen true at 115,
controlled resolution at 134, callback-presence routing at 148,
functional updater behavior at 149/158, and storage exceptions. The
persisted key is `sidebar_state` at 25, writes are Boolean strings at
152/160, and only exact `"true"` hydrates true at 68. Missing storage
preserves state; other present strings hydrate false. The design removes
the duplicate context field without changing any of these contracts or
the independent mobile `open`/`closed` DOM strings at 283.

## Footer seed corrections: real API objects remain D2

`path-safety-atomic-write-remove-options` currently claims a type-like
`writeWithinCanonicalRootAtomically.removeOptions`. There is no separate
type/binding by that name, but the actual options object at
`packages/foundation/capability/file-processing/src/PathSafety/PathSafety.service.ts:291`
is `{ force: true, recursive: true }`, passed to Effect FileSystem.remove
inside `writeWithinCanonicalRootAtomically` (declared at 241). It is not
an anonymous function flag parameter. The external API's optional Boolean
members are declared in `.repos/effect/packages/effect/src/FileSystem.ts:271–282`.
Correct kind to `object-literal`, symbol to the actual enclosing function,
and retain D2. Do not change force/recursive cleanup behavior or claim a
qualification from this one concrete both-true call.

`r2-foundation-youtube-watch-event-init` has no actual named
`YouTubeWatchEventInit` type. Its concrete object at
`packages/foundation/ui-system/editor/src/youtube-embed.tsx:233–238`
sets `bubbles`, `cancelable`, and `composed` true and carries the full
`YouTubeWatchRequest.make({url: watchUrl})` payload. It is inside the named
`onWatch` callback at 227, in `YouTubeEmbed` at 215. Correct to that real
enclosing owner and `object-literal`; retain D2 because the three fields
are the browser EventInit contract, confirmed in
`node_modules/typescript/lib/lib.dom.d.ts:734–737`, inherited by
CustomEventInit at 550. Preserve event name, payload, dispatch return
semantics at 239, and window fallback at 240. The presence of an app-owned
detail payload does not make the DOM option flags app-owned lifecycle bits.

`chat-composer-props-gates` is already anchored to the actual
`export interface ChatComposerProps` at
`packages/foundation/ui-system/editor/src/chat/chat-composer.tsx:151`.
Its members are optional Booleans at 185 (`sendDisabled`) and 191
(`streaming`). Keep line 151 rather than treating the move of a field as
loss of the declaration anchor. All four resolved Boolean pairs are
supported: streaming selects Stop at 269, and only the Send branch
consumes sendDisabled at 287. Both omitted inputs default false at
579–580; their full optional input domain (absent/false/true for each)
remains supported. No independent-presence flags or new qualification is
needed. Footer/surface/body mirror rows remain outside this bounded
metadata repair and retain their current behavior.

## Proposed inventory records

The three confirmed proposals and three corrected D records below are
source-valid handoff data only. Parent owns canonical admission and status.
The design files do not imply that these proposals have already reached
designed or reviewed status.

```jsonl
{"schemaVersion":"boolean-creep-inventory/v1","id":"r27-boolean-state-foundation-spinner-state","file":"packages/foundation/ui-system/ui/src/hooks/useSpinner.ts","line":36,"symbol":"SpinnerState","kind":"type-literal","members":["runOnce","timeout","interval"],"status":"confirmed","evidence":[{"class":"E1","cite":{"file":"packages/foundation/ui-system/ui/src/hooks/useSpinner.ts","line":90},"note":"The hold callback stores interval, runOnce false and timeout undefined; start at 97 stores only timeout while preserving prior runOnce."},{"class":"E4","cite":{"file":"packages/foundation/ui-system/ui/src/hooks/useSpinner.ts","line":97},"note":"Concrete states are idle, initial-delay, repeat-delay after a previous interval, and repeating. An interval implies runOnce false; no producer stores both timer handles or idle with runOnce false."}],"cardinality":{"representable":8,"legal":4},"storage":"stored","exposure":"internal","targetShape":"tagged-union","tier":1,"notes":"Actual number|undefined timer payloads retain every handle including zero. Preserve initial versus repeated-start delay, 300/50 ms timing, command behavior, both mounted atoms, and latest-state cleanup finalizer. P2: designs/r27-boolean-state-foundation-spinner-state.md."}
{"schemaVersion":"boolean-creep-inventory/v1","id":"r27-boolean-state-foundation-use-scribe-result-connected","file":"packages/foundation/ui-system/ui/src/hooks/use-scribe.ts","line":134,"symbol":"UseScribeResult","kind":"interface","members":["isConnected","status"],"status":"confirmed","evidence":[{"class":"E4","cite":{"file":"packages/foundation/ui-system/ui/src/hooks/use-scribe.ts","line":371},"note":"The only result producer makes isConnected exactly status === connected and forwards the same status at 373. The local literal domain at 77 is idle, connecting, connected."}],"cardinality":{"representable":6,"legal":3},"storage":"derived","exposure":"internal","targetShape":"literalkit","tier":1,"notes":"Remove the redundant decoded result property and reuse the one ScribeStatus kit jointly with foundation-ui-system-speech-input-connection in Tier1C. Preserve complete transcript payloads, nullable errors, and post-OPEN error/settlement behavior. P2: designs/r27-boolean-state-foundation-use-scribe-result-connected.md."}
{"schemaVersion":"boolean-creep-inventory/v1","id":"r27-boolean-state-foundation-sidebar-context-open-state","file":"packages/foundation/ui-system/ui/src/components/sidebar.tsx","line":37,"symbol":"SidebarContextValue","kind":"type-literal","members":["open","state"],"status":"confirmed","evidence":[{"class":"E4","cite":{"file":"packages/foundation/ui-system/ui/src/components/sidebar.tsx","line":189},"note":"The provider derives expanded/collapsed exactly from resolved open, then copies both values into the sole context producer at 191-199."}],"cardinality":{"representable":4,"legal":2},"storage":"derived","exposure":"internal","targetShape":"literalkit","tier":1,"notes":"Keep only the desktop display literal in context. Underlying desktop/mobile Boolean state remains D1; public controlled/uncontrolled Boolean props, functional setters, storage truth-string behavior, and independent mobile DOM state stay exact. P2: designs/r27-boolean-state-foundation-sidebar-context-open-state.md."}
{"schemaVersion":"boolean-creep-inventory/v1","id":"path-safety-atomic-write-remove-options","file":"packages/foundation/capability/file-processing/src/PathSafety/PathSafety.service.ts","line":291,"symbol":"writeWithinCanonicalRootAtomically","kind":"object-literal","members":["force","recursive"],"status":"disqualified","disqualifier":{"class":"D2","note":"Concrete inline fs.remove options object at 291 inside the real function declared at 241. Both flags belong to the Effect FileSystem API contract; this call sets both true. There is no named removeOptions type, but the instantiated object remains an eligible external-API census carrier."}}
{"schemaVersion":"boolean-creep-inventory/v1","id":"r2-foundation-youtube-watch-event-init","file":"packages/foundation/ui-system/editor/src/youtube-embed.tsx","line":233,"symbol":"onWatch","kind":"object-literal","members":["bubbles","cancelable","composed"],"status":"disqualified","disqualifier":{"class":"D2","note":"Concrete CustomEvent initializer at 233-238 inside onWatch at 227. The three true flags are browser EventInit members, not an app lifecycle. Preserve full YouTubeWatchRequest detail and dispatch/fallback behavior. YouTubeWatchEventInit was a descriptive invented type name; object-literal metadata identifies the real carrier."}}
{"schemaVersion":"boolean-creep-inventory/v1","id":"chat-composer-props-gates","file":"packages/foundation/ui-system/editor/src/chat/chat-composer.tsx","line":151,"symbol":"ChatComposerProps","kind":"props","members":["sendDisabled","streaming"],"status":"disqualified","disqualifier":{"class":"D1","note":"Actual interface remains at 151; optional Boolean fields are at 185 and 191. Omitted values default false at 579-580. Every resolved pair is supported: streaming selects Stop at 269 while sendDisabled only controls the Send branch at 287, including combined true. Preserve absent/false/true public inputs."}}
```

## Deliverables, validation, and remaining review

Created these three P2 designs:

- `designs/r27-boolean-state-foundation-spinner-state.md`
- `designs/r27-boolean-state-foundation-use-scribe-result-connected.md`
- `designs/r27-boolean-state-foundation-sidebar-context-open-state.md`

Updated only the authorized companion
`designs/foundation-ui-system-speech-input-connection.md`: it now removes
the hook convenience bit jointly, gives the hook-result design sole
ownership of the shared status-kit promotion, preserves token/settlement
semantics, and requires fresh combined review. All four designs contain
the exact required Current shape, Cardinality gap, Target schema,
Migration inventory, Guard-deletion accounting, Encoded-side impact,
Test impact, and Risk sections.

The companion's exact pre-edit bytes are preserved in the existing index
blob `3c4c3cacd1710c4389528144d3140bedc5053f83`: 11,137 bytes,
210 lines, SHA-256
`436e06e8075ad7774aba509fd62443342538ea5bfba8ae082681a0eee1f4b69b`.
The index was not edited. The parent can copy these exact bytes into its
packet archive with
`git cat-file blob 3c4c3cacd1710c4389528144d3140bedc5053f83`.
Do not substitute the design at HEAD: that older committed version has
106 lines and is not the pre-edit source read by this lane. The working
diff against the index contains only the coordinated edits documented
here. Archiving outside the five assigned files remains parent-owned.

The schema API choices are grounded in the current LiteralKit implementation
at `packages/foundation/modeling/schema/src/LiteralKit/LiteralKit.schema.ts:708,791–812`
and Effect reference `SCHEMA.md` tagged-union helpers. The current
`useAtomMount` implementation at
`node_modules/@effect/atom-react/src/Hooks.ts:225` mounts the atom in the
registry; it is not interchangeable with merely holding a setter or reading
the hook's returned commands. No new service or broad Atom migration is
needed for these carrier changes.

Validation for this documentation pass: extracted the six complete proposal
rows and ran `bun goals/boolean-creep/ops/validate-inventory.ts /dev/stdin`:
`inventory OK: 6 records, 6 unique ids` (exit 0). All eight required
sections are present in each of the four designs; the superseded
hook-retention instruction is absent. The scoped diff whitespace check
passed, and both frozen refs were re-read unchanged.
Runtime/package/browser acceptance remains
pending implementation and independent review. Each design specifies
focused behavior tests, full `@beep/ui` package verification, and a
recorded portless Storybook QA round with capture-green and
`requiredCount: 0`. No such acceptance is claimed here.

Parent actions: independently review/admit the three qualifications with
the corrected declaration anchors, integrate the three D metadata repairs
without withdrawing the real API objects, coordinate the two Scribe
designs in Tier 1C, and obtain fresh evidence/design review before apply.
Preserve prior source receipts and all concurrent work. This lane changed
only this audit and the four explicitly assigned design files.
