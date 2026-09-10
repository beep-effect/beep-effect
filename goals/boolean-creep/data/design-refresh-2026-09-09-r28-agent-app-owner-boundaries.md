# R28 agent/app owner-boundary adjudication

Date: 2026-09-09. Frozen source HEAD
`93217d998f851e2e93d9864e2b5315552eaa58a7`; frozen main
`d1b4d769fbaffddd55717f3b1ba461897dd545c5`.

This is a bounded P2 audit of four existing qualified records, not a census
resweep or independent P3 receipt. Only this new audit and the accompanying
provisional Hero design are written. Current inventory, current designs,
archives, finalized apps audits/provisionals, source, tests and refs are untouched.

## Verdicts

| Existing id | Actual carrier | Proposed disposition |
| --- | --- | --- |
| `r2-domains-anthropic-turn-holding-after-failure` | One Boolean Ref, two required-array Refs | Withdraw qualified record and current design during parent integration: the claimed 8/5 vector fabricates two array-emptiness axes. |
| `r3-apps-desktop-shell-rpc-access` | One local Boolean and a nested field of a separate required transport object | Withdraw qualified record and current design: the claimed 4/3 vector crosses owners. |
| `r2-apps-hero-clip-playback` | Actual React props `active`, `layered`; bound Boolean locals `playing`, `posterHidden` | Retain qualification; expand incomplete 8/4 cluster to complete connected 16/6 cluster. Provisional replacement supplied. |
| `receipt-fallback-draft-occupancy` | Actual sibling Option values in one synchronous block | Retain 4/3 qualification and existing payload-bearing design; refresh the enclosing symbol, exact Option wording, evidence citation and source provenance. |

An analytical suffix in an inventory `symbol` is not itself a reason to withdraw.
Eligibility depends on actual declarations and co-carried values. The surviving
rows below use their real enclosing symbol names, retaining their stable ids.

The SPEC's same-scope net and DECISIONS' E1–E4 gate both apply. A required array
does not supply a presence bit merely because a reader asks whether it is empty.
A nested field does not become a sibling Boolean merely because an expression
reads it. Conversely, a destructured React prop and a bound Boolean local are
real values; an Option storing a complete payload is not just a predicate.
The two withdrawals are eligibility withdrawals, not new D1 or D2 records.

## Prior proof and source drift

Read first:

- `data/design-refresh-2026-09-09-agent-turn-surfaces.md`, including the
  correction that the Anthropic drain sequence exposes coarse state 101.
- `data/design-refresh-2026-09-09-app-playback-observability.md`, including
  the legitimate inactive-playing render and the former 8/4 Hero conclusion.
- `data/design-refresh-2026-09-09-fallback-retirement-coverage.md`, including
  complete receipt payload, serial selection and concurrent update behavior.
- The four current `designs/<id>.md` files and their current inventory rows.

A bounded read-only diff from the prior audited
`7440cb8c4302ce64b87860069a464bafbf65f576` to frozen HEAD shows
`AnthropicTurnKernel.ts`, `App.tsx` and `HeroVideo.tsx` byte-identical.
`Chat.atoms.ts` only adds the `isChatActionError` declaration and uses it in
`toTurnError`; the receipt block shifts two lines without changing its algorithm.
These are corrections to source interpretation, not newly introduced product bugs.

## Anthropic: withdraw the fabricated required-array axes

`packages/agents/server/src/AssistantTurn/AnthropicTurnKernel.ts:84-90`
declares `routeBlock` as a curried callback factory with Ref parameters.
The actual state allocations are inside `Stream.unwrap(Effect.gen(...))` at
lines 189-197:

| Allocation | Actual value |
| --- | --- |
| `failures`, 191 | `Ref<ReadonlyArray<IssueReport>>`, initially empty |
| `buffered`, 192 | `Ref<ReadonlyArray<IndexedBlock>>`, initially empty |
| `holdingAfterFailure`, 193 | Boolean Ref, initially false |
| `modelId`, 194 | `Ref<Option<string>>`, initially None |
| `finish`, 195 | `Ref<Option<Response.FinishPart>>`, initially None |
| `repairInputTokens`, 196; `repairOutputTokens`, 197 | Required numeric Refs, initially zero |

The two required arrays are not Boolean, optional or nullable state members.
There is no `hasFailures` or `hasBuffered` sibling binding. At 95 the valid-block
route reads the actual latch; at 96 it appends the complete indexed block.
At 102 the failure route sets the latch true; at 103-112 it appends a complete
issue report. At 210-211 the repair tail drains the arrays in sequence, and
212 tests the drained required array with `A.isReadonlyArrayEmpty`.
That call's Boolean result is a predicate, not a new member of the Ref owner.

The prior coarse H/F/B observations `000,100,110,111,101` remain an accurate
description of those observations, including the 101 interval between drains.
They do not establish three eligible Boolean/presence members. The existing
8/5 claim and proposed single-Ref state machine therefore lack an eligible net
carrier. Counting guards or the usefulness of making writes atomic cannot
repair that eligibility failure. Treating `routeBlock`'s Ref parameters as a
separate admitted carrier would also violate the callable-parameter exclusion.

The complete allocated owner was checked, rather than stopping at the three
named fields. `modelId` and `finish` capture different provider events at
124-131; `makeProviderUsage` reads their complete metadata at 136-164 and
finalization uses them at 222-230. The source gives no failure-latch implication
that would substitute either Option for a fabricated array-emptiness member.
The numeric repair totals likewise remain payload. No additional qualified
cluster is proposed from those independent facts in this bounded audit.

All affected reads/writes are private: route construction at 204, valid-block
buffering at 92-99, failure reporting/metrics/logging at 101-118, sequential
repair and sorted merge at 208-219, then block/error/usage finalization at
234-241. Withdrawal changes none of these operations, ordering, complete issue
or block payloads, retry/repair behavior, token totals, logs, public events or
provider encoding. Do not perform the old design's atomic-Ref rewrite as part
of this campaign on the strength of the withdrawn row.

## Desktop RPC access: withdraw the cross-owner projection

`apps/professional-desktop/src/App.tsx:765-771` gives `DesktopShell` two
required object props: `graph: DesktopDockGraph` and
`transport: SidecarTransport`. Its actual local `desktopRpcAvailable` is
bound at 775 and read by the navigation filter at 776. There is no local or
Boolean prop named `ipc`. `transport.ipc` is a nested member of the separate
`SidecarTransport` schema at
`apps/professional-desktop/src/transport/SidecarTransport.ts:29-33`.

`hasDesktopRpcAccess` at `App.tsx:124-125` is a callable predicate returning
`transport.ipc || O.isSome(transport.rpcSessionToken)`. Its logical implication
is true but does not create an actual sibling `ipc` binding in `DesktopShell`.
The JSX expression at 852 again directly reads the nested member and calls
`hasIpcSpikeFlag`; it does not materialize the inventory's supposed pair.
The required `transport` object itself is not an absent/present axis.

The neighboring protocol binding at 236-252 was also checked: it binds a
required `transport` object, `sessionToken: Option`, and a required Layer value;
its `transport.ipc` tests are expressions. It does not supply an alternative
two-Boolean owner for the shell row. The shell's focused-group Option at 774
belongs to dock focus; no source implication connects its presence to RPC
availability. Its `isPanelCurrent` binding at 779 is callable. These values
cannot be substituted into the claimed access cluster without inventing a law.

The real transport owner remains the existing separate D1 record
`sidecar-transport-ipc-token`: `ipc` and `rpcSessionToken` at
`SidecarTransport.ts:31-32`. The token uses an optional encoded key with None
default, and the schema provides `decodeUnknownEffect` at 38.
`browserSidecarTransport` at `App.tsx:121-122` supplies HTTP with the dev-token
Option; the IPC boundary accepts a tokenless probe. This last point is actual
compatibility behavior: `schema-parity.test.ts:73-75` round-trips `{ipc:true}`
with the key omitted; `tauri-ipc-socket.test.ts:78-92` constructs that probe,
decodes it and asserts the subsequent write failure. The token requirement
is enforced at send time in `TauriIpcSocket.ts:385-404`, specifically 396-401.
Do not narrow these accepted transport inputs or absorb this separate D1
owner into the proposed withdrawn three-case access model.

No schema, protocol layer, token default, credential path, navigation guard,
bootstrap gate, IPC spike gate, DOM prop or public transport encoding changes
with this disposition. The old design is useful historical reasoning about
access modes but is not an authorized campaign application.

## Hero: real owner survives, but the connected cluster is incomplete

`apps/oip-web/src/components/HeroVideo.tsx:208-222` declares the private
`HeroClipLayer` React component. `active` and `layered` are actual destructured
Boolean props at 216 and 218. `playing` at 224 is a bound Boolean value read
from the clip-keyed atom, whose schema/default and independent writes are at
56-97. `posterHidden` at 229 is a bound Boolean, exactly `active && playing`.
These are real co-carried values, unlike an inline JSX expression or an
invented `video.playing` member. Required `index`, `mp4` and `poster`, optional
`webm`, the DOM element in a separate atom owner and the parent `clips` array
are not additional axes of this cluster.

The only private component writer is `HeroVideo.tsx:319-328`. Public
`HeroVideo` accepts a required full `ReadonlyArray<HeroClipMedia>` at 305.
The empty collection returns no layers at 310-312. Otherwise `activeIndex`
is the rotation index modulo the collection length at 314 and `layered` is
the actual Boolean binding `clips.length > 1` at 315. The writer passes
`active={index === activeIndex}` at 322 and `layered={layered}` at 324.
The private rotation atom starts at zero and advances modulo the same count
at 172, 189-192. Thus a one-clip render is active and nonlayered; a multi-clip
render is layered and may be active or inactive. `!active` implies `layered`.
The absence of a public export or other writer was checked by targeted source
and fixture searches, not inferred from missing graph edges.

`playing` remains independently writable at 86-97; `onPlaying` writes true
at 253 and the ref setter clears it only when the element becomes null at
73-82. Rotation can render an old clip inactive while its atom still reads
true before cleanup commits. Duplicate clip keys also must not be forbidden
by a new uniqueness assumption. Preserve inactive-playing; do not claim
`playing => active`.

The minimal connected cluster is therefore four actual Booleans, with both
`posterHidden === (active && playing)` and `!layered => active`:

| Presentation | active | layered | playing | posterHidden |
| --- | --- | --- | --- | --- |
| single loading | true | false | false | false |
| single playing | true | false | true | true |
| layered active loading | true | true | false | false |
| layered active playing | true | true | true | true |
| layered inactive idle | false | true | false | false |
| layered inactive playing | false | true | true | false |

This is **16 representable / 6 legal**, without inventing a Boolean from the
required collection. The previous 8/4 table is still a correct projection
onto three members; its claim that `layered` is independent of the complete
owner is the error. The layout-selection projection has 4/3 states, while
its three legal cases factor independently with the two playing observations.

The existing D1 row `hero-clip-layer-flags` owns `[active,layered]`. Its note
acknowledges that false/false has no actual writer but nevertheless calls the
pair independent. The complete private producer contract above supplies a
positive law excluding that tuple; generic TypeScript acceptance does not
establish a supported extra writer. On admission of the 16/6 correction,
archive that narrow row as a superseded, wholly contained projection. Preserve
its exact D1 reasoning/history and prior report receipt. Do not retain a
redundant broad-four plus narrow-two live census pair.

The separate D1 `r25-apps-hero-video-state-playing-element` remains separate:
its actual schema owner is `HeroVideoState`, and its unrestricted playing
writer supports playing with a null element. This audit does not change that
payload owner's contract or infer a missing field from it.

The provisional replacement is
`data/provisional-r28-hero-clip-playback.md`. It replaces the two private
selection props with three placement literals and derives six presentation
literals from placement and the unchanged playing atom. It removes the
poster alias and repeated Boolean rendering decisions without adding stored
presentation state. Public `HeroVideo` remains unchanged. The in-repo public
consumer at `OipHomePage.tsx:157-163` passes complete asset payloads. The
single-clip fixture at `oip-web.test.tsx:443-445`, multi-clip fixture at
493-500 and reduced-motion fixture at 532-539 exercise the public constructor.
Tests at 422-480, 482-525 and 529-553 prove existing autoplay/rotation behavior;
they are not claimed as a complete six-state regression suite already run.

## Receipt fallback: genuine sibling Option state remains 4/3

`packages/agents/client/src/Chat.atoms.ts:998-1054` binds the actual
`reconcileReceiptFallbacks` Effect value. Inside its `Effect.sync` callback
at 1017, `currentDraftOccupied` is an actual const Option binding at 1019
and `draftToRestore` is an actual mutable `Option<StreamingTurn>` at 1020.
They are neither anonymous flag parameters nor synthetic names for predicates.
`currentDraftOccupied` is inferred from `O.map(..., () => true)`; every
produced Some contains true. Do not describe it as an explicitly annotated
`Option<true>` or require an invented Some(false) producer. Cardinality here
counts the two real Option-presence dimensions while preserving payloads.

The only Some assignment to `draftToRestore` is 1032. The `not_persisted`
branch begins at 1028; **the `O.orElse` call is at 1030**, and the
`O.getOrElse` thunk begins at 1031. The const occupancy snapshot is never
reassigned. Local Effect v4 source proves that both combinators are lazy:
`.repos/effect/packages/effect/src/Option.ts:582-587,619-624`. The Some
assignment is reached only when the occupancy Option is None and no earlier
restore candidate exists. The legal presence pairs are None/None,
Some/None and None/Some; Some/Some is unreachable. This is the existing
4/3 E1/E4 gap, not an array-emptiness abstraction.

The full enclosing operation and consumers preserve the existing design:

- Receipt statuses are read from an initial fallback snapshot with
  `concurrency: 1` at 999-1015. The occupancy snapshot is taken afterward,
  in the synchronous block at 1017-1019, so newer composer drafts win.
- The filter rereads the current fallback array at 1021, locates decisions
  by object identity at 1022, retains pending/accepted/unknown statuses at
  1027, removes persisted/user-persisted at 1037 and retains absent statuses
  or newly appended fallback objects at 1041 and 1044-1045.
- The first eligible not-persisted candidate becomes the complete selected
  `StreamingTurn`; later candidates remain in order. The selected document
  is restored at 1049, the selected turn's thread revision increments once
  at 1050, and the retained array publishes at 1052.
- `StreamingTurn` at 439-472 retains required `threadId`, complete
  `userContent: Document`, required ordered `blocks`, optional request id
  and truncate target, and the reconciliation literal/default. None of
  those nested payload dimensions is a fabricated sibling flag in this
  local owner. No codec or constructor/default changes are needed.
- `run-turn-reconciliation.test.ts:609-725` supplies actual complete
  StreamingTurn fixtures, ordered mixed receipt/timeline outcomes, first
  restoration, a newer draft arriving during receipt I/O and a newly
  appended fallback. Assertions at 692-698 and 715-717 preserve the exact
  draft/revision/retained behavior. The existing design also retains the
  isolated restoration cases at 357-405.

No other reader or writer of the two locals exists outside this block.
The existing `available | occupied | selected { turn: StreamingTurn }`
design remains appropriate. Its guard-deletion inventory remains real:
remove the two Option locals, their projections to true, the nested lazy
occupancy wall, the mutable Option assignment and final Option-to-array loop.
Keep unrelated receipt-status Option handling. Only source provenance and
wording/citation repairs are proposed; no new receipt provisional is needed.

## Exact proposed live rows and archival actions

These are parent-integration proposals, not canonical edits. Keep Hero's
status `confirmed` until the corrected provisional is independently admitted
and promoted; do not claim the old three-member design covers the new row.
Receipt remains `designed` because its complete algorithm and payload design
are unchanged. Normalize the analytical suffixes to actual enclosing symbols.

```jsonl
{"schemaVersion":"boolean-creep-inventory/v1","id":"r2-apps-hero-clip-playback","file":"apps/oip-web/src/components/HeroVideo.tsx","line":216,"symbol":"HeroClipLayer","kind":"sibling-state","members":["active","layered","playing","posterHidden"],"status":"confirmed","evidence":[{"class":"E4","cite":{"file":"apps/oip-web/src/components/HeroVideo.tsx","line":229},"note":"Actual bound posterHidden equals active && playing. The playing writer remains independent, so inactive-playing is preserved before ref cleanup."},{"class":"E4","cite":{"file":"apps/oip-web/src/components/HeroVideo.tsx","line":322},"note":"The only private props writer passes active=index===activeIndex and layered=clips.length>1. Empty clips render no layer; one clip is always active. Therefore !layered implies active. Together with the poster alias this gives six legal tuples for the complete four-Boolean owner."}],"cardinality":{"representable":16,"legal":6},"storage":"derived","exposure":"internal","targetShape":"literalkit","tier":1,"notes":"Frozen HEAD93217d998f851e2e93d9864e2b5315552eaa58a7/main d1b4d769fbaffddd55717f3b1ba461897dd545c5. Corrects incomplete 8/4 projection; normalize analytical symbol HeroClipLayer.playback to actual HeroClipLayer. Supersede wholly contained hero-clip-layer-flags with preserved D1 history. Private placement and presentation literals preserve full media payloads, public HeroVideo props, atom state/defaults, inactive-playing, callbacks, mount order and crossfade behavior. See data/design-refresh-2026-09-09-r28-agent-app-owner-boundaries.md and data/provisional-r28-hero-clip-playback.md; pending independent correction/admission."}
{"schemaVersion":"boolean-creep-inventory/v1","id":"receipt-fallback-draft-occupancy","file":"packages/agents/client/src/Chat.atoms.ts","line":1019,"symbol":"reconcileReceiptFallbacks","kind":"sibling-state","members":["currentDraftOccupied","draftToRestore"],"status":"designed","evidence":[{"class":"E1","cite":{"file":"packages/agents/client/src/Chat.atoms.ts","line":1032},"note":"The only Some assignment to draftToRestore is the lazy O.getOrElse thunk, reached only after the const currentDraftOccupied and existing restore candidate are both None."},{"class":"E4","cite":{"file":"packages/agents/client/src/Chat.atoms.ts","line":1019},"note":"The actual const Option binding maps a draft snapshot to Some(true) or None and is never reassigned. O.orElse at1030 is lazy; occupied Some bypasses the restore probe and writer. Restore Some therefore implies occupied None throughout the synchronous block. Count presence dimensions, preserving the full selected StreamingTurn payload."}],"cardinality":{"representable":4,"legal":3},"storage":"stored","exposure":"internal","targetShape":"tagged-union","tier":1,"notes":"Frozen HEAD93217d998f851e2e93d9864e2b5315552eaa58a7/main d1b4d769fbaffddd55717f3b1ba461897dd545c5. Actual enclosing symbol reconcileReceiptFallbacks replaces analytical suffix draftRestoration. Existing available/occupied/selected(turn) design remains valid. Preserve the post-I/O draft snapshot, serial traversal, object-identity decision lookup, complete StreamingTurn, first selection, later retention, concurrent drafts/appended fallbacks, retained order and one revision increment; no codec/default changes. See data/design-refresh-2026-09-09-r28-agent-app-owner-boundaries.md."}
```

Archive/remove from the live projection only under the parent's integration
receipt:

| Id | Action and evidence |
| --- | --- |
| `r2-domains-anthropic-turn-holding-after-failure` | Withdraw qualified row and archive current design together. Required-array allocations at `AnthropicTurnKernel.ts:191-192`; sole Boolean Ref at 193; no actual Boolean array-occupancy members. |
| `r3-apps-desktop-shell-rpc-access` | Withdraw qualified row and archive current design together. Required object props at `App.tsx:769-770`; sole access Boolean local at 775; `ipc` belongs to `SidecarTransport.ts:31`. |
| `hero-clip-layer-flags` | On admission of corrected full Hero cluster, archive as wholly contained superseded D1 projection; preserve its original false/false reasoning and independent receipt. Do not keep duplicate live coverage. |

The five prior inventory rows are already retained at
`history/inventory/2026-09-09-post-r27.jsonl:18,329,407,581,897`.
The current design bytes are still present and untouched; their hashes below
are the exact design-archive inputs for parent integration. No new withdrawal
status is invented. No current corpus totals are asserted during concurrent
integration.

## Source and evidence hashes

SHA-256. Every product source/test below was compared byte-for-byte with
`git show 93217d998f851e2e93d9864e2b5315552eaa58a7:<path>` and matched.
Test files were read as constructor/compatibility evidence, not run.

| Path | SHA-256 |
| --- | --- |
| `packages/agents/server/src/AssistantTurn/AnthropicTurnKernel.ts` | `ed0ee6337fcadd0f6421489f248b96511acf80c59789a95ff61820fd7a9af354` |
| `apps/professional-desktop/src/App.tsx` | `d29376441f5566e197291c37478ca21bac2dc8f2d0bf2c253525ba6b2de5ec17` |
| `apps/professional-desktop/src/transport/SidecarTransport.ts` | `c331eeb810a3b0a361a0fd03470e9e58465402aa155623fcfb8454efad653754` |
| `apps/professional-desktop/src/transport/TauriIpcSocket.ts` | `6411dd32eb66dbe36926335bb2d86499baca287865adf22042f5b3a12e17c8e5` |
| `apps/professional-desktop/test/schema-parity.test.ts` | `be142de3bef997c73819cbe4e89531616b61d6e69f7beac0c1da62e013a55b7b` |
| `apps/professional-desktop/test/tauri-ipc-socket.test.ts` | `44a177d779793dd8cf75aae20f97f4e4c03b5dde37d89745f1c5d82406dfc9d8` |
| `apps/oip-web/src/components/HeroVideo.tsx` | `e794854408bf5c76eb73c9a25a021c760ff1f082282ba0021c48990c2b9f469d` |
| `apps/oip-web/src/components/OipHomePage.tsx` | `0f206bd0762ea1a65adeb4103c0436b2b7b3f450b7eb578c6989bfe040340b66` |
| `apps/oip-web/test/oip-web.test.tsx` | `a8a0cf693a8b5cec5e1adf15771638e4ed410e38564be527d5fde967bc55db9a` |
| `packages/agents/client/src/Chat.atoms.ts` | `91d8040ca676201732ecab34e6a8de8951598b1495ac800529b8609d82a0ad6a` |
| `packages/agents/client/test/run-turn-reconciliation.test.ts` | `d8e2aa5f7ecff76be42fbfae531e0be62ca039dbe0b0ac3f7bb969da57123e2e` |
| `designs/r2-domains-anthropic-turn-holding-after-failure.md` | `e890c5d7878a98ffd4f43ce6c59be967841137ee9e31e0fa27561cfe40caeb05` |
| `designs/r3-apps-desktop-shell-rpc-access.md` | `cf7f92ffc986a815e5d415b86729eb1c6ac32182b72b10aa37a1a4e00c4cfd4e` |
| `designs/r2-apps-hero-clip-playback.md` | `980a35c9342cb22cb3a0906435ede9424371ecffae464bb4f1ddaff7744e82b5` |
| `designs/receipt-fallback-draft-occupancy.md` | `8e1070589700615ea7b0804716049a44cdfca3eab3a3b8615fe716e1b15a0a2f` |
| `data/design-refresh-2026-09-09-agent-turn-surfaces.md` | `8a7cdfab9556fd6a5f55152b63e292c8e3cdb604c3a28edb57353b7d874f7f4b` |
| `data/design-refresh-2026-09-09-app-playback-observability.md` | `1b6f660aa4762b05eb79a7e581397f5379a0f9a10aef94cd36ccdaa924984e13` |
| `data/design-refresh-2026-09-09-fallback-retirement-coverage.md` | `ea5bfe06795e95577fe4917ecad18bc74e390e3788c36692183515832a2a4291` |

Supporting API sources were also read directly: the local Effect reference
`Option.ts` has SHA-256
`852c273cfe37456930806f80c3b886a1e2ee01f0f8e22f0d2fd3175f01485238`,
and `packages/foundation/modeling/schema/src/LiteralKit/LiteralKit.schema.ts`
has SHA-256
`36915d6791ed01e0f1e33384513441570597e84d9b5750f6b6cc009a4aea24be`.
The `.repos/effect` reference is separate from the product corpus freeze.

## Validation and limits

Validated both proposed JSONL rows syntactically, their source anchors,
the six-row Boolean cardinality, receipt's three presence states and all
eight exact provisional design headings. Source, current-design and prior
audit hashes in the table still match. The five finalized apps/chart/first-D
artifacts from the previous handoff also retain their recorded hashes.
The bounded duplicate check covers the four records, the contained
Hero props projection and the separate HeroVideoState/SidecarTransport owners.
No broad new residue or authoritative independent acceptance is claimed.
The frozen source proves the conclusions; no product test, package command,
browser QA or service was executed. Parent must bind independent correction,
archive the affected live rows/design bytes and promote the provisional before
implementation. Graft-first discovery reported 46,118 tokens saved this turn;
exact span, writer and fixture reads supplied the owner-boundary proof.
