# R28 apps: actual carriers and transcript payload boundary

This bounded P2 source audit is bound to HEAD
`93217d998f851e2e93d9864e2b5315552eaa58a7`, main
`d1b4d769fbaffddd55717f3b1ba461897dd545c5`. It reads the completed apps
report and its receipt, proposes corrections, and supplies provisional
designs under `data/`. It changes no canonical inventory, current design,
source, tests, archive, report, or git state. The parent still owes one
bounded independent apps correction; this document is not that correction
or independent P3 review.

The raw apps report has three qualified and three D records plus two footer
withdrawals. Actual-carrier adjudication supports these dispositions:

| Report item | Source-backed disposition |
| --- | --- |
| `thread-transcript-load-state` | Keep qualified; correct to actual `empty/failed/loading/streaming` cluster, **16/7**, retaining all required array payloads and their real constraints. Reject both raw 8/4 truncation and canonical 64/21 invented array axes. |
| `r3-apps-back-to-top-hidden` | Withdraw out of net. One visibility local and a different owner's single DOM `hidden` projection do not form a co-carried pair. |
| `r2-apps-editor-proof-profile-picker` | Withdraw out of net. Both proposed named members are synthetic; actual `checked` expressions belong to two different radio inputs. |
| `composer-send-input-gates` | Keep D1; first Boolean anchor is 334. |
| `composer-shell-edit-stream` | Keep D1; first Boolean anchor is 372. Its different edit/content relation is already separately canonical. |
| `r2-apps-thread-composer-send-gates` | Recommend withdrawal of the claimed sibling-state owner. `sendDisabled` is not declared there; line212 is a JSX write to already-inventoried `ChatComposerProps`. This requires explicit independent carrier adjudication, not a silent line-only repair. |
| `r25-apps-streaming-turn-view-active` | Reject footer withdrawal. Actual Option/Boolean props support all four tuples; retain D1 with concrete source and constructor/fixture proof. |
| `r2-apps-dock-panel-open-active` | Withdraw callable pair. Preserve the actual qualified `OntologyMenuItem` props owner and repair its design's dependence on the withdrawn callable refactor. |

## Report and scope receipt

Read `data/sweeps/refresh-2026-09-09-r28-main-d1b4d7/r28-apps.jsonl` and the
full `r28-apps.execution.json` footer. The receipt records the frozen source
SHA, completion at `2026-09-09T05:15:29.615361+00:00`, exit zero,
`endTurnEvent: true`, six valid records, three qualified candidates, no
execution errors, and report validation exit zero. It claims coverage of
`architecture-lab-proof`, `oip-web`, `practice-kg-mcp`,
`professional-desktop` src/src-tauri, and `todox`. This bounded audit does not
renew that whole-lane coverage claim.

| Immutable file | SHA-256 |
| --- | --- |
| `r28-apps.jsonl` | `23b5d54a3e1967e50750233c93b2dbe689f346fd9e86b8e04ad5826d1933ea65` |
| `r28-apps.execution.json` | `b0bddcdff8bfd3b37ced0086ef25cd3e785cab505c135e1d0ff4c95145e6c5c3` |

## Display projections without eligible owners

`apps/oip-web/src/components/BackToTop.tsx:18-39` owns one Boolean atom.
Its defaults/server return and scroll updates supply only that visibility
value. `BackToTop` binds only `visible` at `77`; it uses the value for class
selection at `84` and computes `hidden={!visible}` on its button at `86`.
No `hidden` local/state/member is declared beside `visible`, and the button
does not also carry a Boolean `visible` prop. The nested SVG's `aria-hidden`
belongs to another element and is not this cluster. The button fixture at
`apps/oip-web/test/oip-web.test.tsx:390-415` checks hidden before and after
scrolling, confirming one state projected into the DOM. Complementarity is
true, but E1 does not admit a synthetic pair across different owners. Remove
the stable D1 seed from the live projection; preserve its historical reasoning
and raw correction rather than designing it.

`apps/professional-desktop/src/editor-proof/EditorProofPanel.tsx:21-49`
binds `profileId` and two action functions. `minimalChecked` and
`documentProofChecked` do not occur in source. The two radio inputs separately
compute `checked` at `33` and `42`; neither props object carries both results.
`EditorProof.atoms.ts:80` initializes the profile atom from
`referenceProfiles.minimal.id`; actions at `130-138` write the two existing
profile ids. The authored references in
`packages/foundation/ui-system/editor/src/capability/profiles.ts:69-88`
construct the minimal and document-proof profiles. This is already one
identifier displayed in two controls. Radio-name exclusivity does not supply
missing Boolean declarations or a shared two-member carrier. Withdraw the
stable D1 seed rather than retaining or qualifying synthetic names. The atom
is exported; no universal claim that its TypeScript type admits only those
two ids is necessary to reach this carrier conclusion.

## Transcript: actual Option retained, required arrays not counted

The real `ThreadTranscriptView` interface is at
`apps/professional-desktop/src/chat/ui/Thread.atoms.ts:253-261`. It carries
three Booleans (`empty`, `failed`, `loading`), a real
`streaming: O.Option<StreamingTurn>`, two required readonly arrays (`turns`,
`unreconciled`), and a required sibling-id HashSet. Its sole writer is
`visibleThreadTurnsAtoms` at `280-335`.

The flags are derived together at `326-332`: failed is an AsyncResult
Failure; loading is Initial and waiting; empty requires Success, empty
rendered arrays and `O.isNone(streaming)`. Thus the flags are exclusive, and
empty additionally implies an absent actual Option payload. Removing that
Option from the correlated member set loses an existing E4 payload-presence
constraint. By contrast, required arrays at `259-260` are not optional
members or declared Boolean fields. Turning their empty/nonempty predicates
into two extra binary census axes manufactures members. Their emptiness
constraints remain payload semantics; excluding them from the count must not
drop those constraints from the design.

The corrected cluster is exactly `empty`, `failed`, `loading`, `streaming`:
`2^3 × 2 = 16` representable presence/flag tuples and seven legal tuples.

| Load/content state | `empty` | `failed` | `loading` | `streaming` | Required payload behavior |
| --- | --- | --- | --- | --- | --- |
| Empty | true | false | false | None | Both arrays empty; timeline is Success, including Success while waiting. |
| Failed, no local stream | false | true | false | None | Keep any previous timeline turns and current unreconciled payload. |
| Failed, local stream | false | true | false | Some | Same payload preservation; own-thread local stream retained. |
| Loading, no local stream | false | false | true | None | Timeline turns empty; unreconciled array retained. |
| Loading, local stream | false | false | true | Some | Timeline turns empty; unreconciled array and stream retained. |
| Ready, no local stream | false | false | false | None | Includes Initial-not-waiting with all payload empty; does not require content. |
| Ready, local stream | false | false | false | Some | Keep exact arrays and stream; Success plus stream is not Empty. |

The count is a projection over actual finite members, not the cardinality of
all possible array/turn values. Existing array constraints remain: Empty has
two empty arrays; Loading has no timeline turns; Failed/Ready can retain
empty or populated arrays. Failure with previous Success must not lose
content. The local Effect v4 reference at
`.repos/effect/packages/effect/src/unstable/reactivity/AsyncResult.ts:416-422`
returns previous Success values on Failure and None on Initial; `217-223`
constructs Initial with waiting default false. These are API evidence, not
additional campaign corpus files.

The complete producer path is unchanged:

- `packages/agents/client/src/Chat.atoms.ts:235-237` owns the timeline RPC
  query. The payload schema `ThreadTimeline` at
  `packages/workspace/use-cases/src/aggregates/Thread/ThreadTimeline.ts:237-249`
  owns required `turns: S.Array(TimelineTurn)`. Timeline turns preserve ids,
  ordering, optional parent, items and cost (`184-205`).
- The actual `StreamingTurn` schema at `Chat.atoms.ts:439-472` retains
  `threadId`, optional request id, user document, optional truncate-from id,
  `timeline|receipt` reconciliation with timeline default, and required
  assistant blocks. The entire schema payload stays inside Some; its nested
  fields are not new axes of the transcript owner.
- `streamingTurnAtom` defaults None at `510`; unreconciled arrays default
  empty and remain alive at `530-532`. Real stream start and block updates
  write Some at `948` and `1067`. Post-refresh cleanup and retained fallbacks
  occur at `1244-1268`.
- `Thread.atoms.ts:285` filters the stream to this thread. Lines `289-291`
  keep receipt fallbacks across successful timeline reads. Lines `292-319`
  retain previous success, project the active branch, and truncate from the
  earliest local edit. `threadSiblingTurnIdsAtoms` at `226-239` remains a
  separately computed set; no new presence axis or recalculation is needed.

The registry fixtures are real constructor consumers, not invented view
objects. `test/thread-transcript-view.test.ts:24-43` constructs typed timeline
payloads and mounts the timeline atom; `65-79` constructs an editing stream;
`82-96` retains a receipt fallback; `99-116` demonstrates cross-thread stream
filtering. `test/optimistic-user-turn.test.tsx:474-489` uses Failure with
previous Success and retains/truncates its content; `415-440` preserves an
uncertain receipt across later Success. The seven-state count follows the
producer formulas and independently writable input atoms; these existing
fixtures do not claim complete seven-row coverage. A subsequent implementation
must add the missing phase/Option cases without replacing arrays by bits.

The only source reader is `Thread.tsx:237,252-265`: load and empty rendering,
ordered timeline turns with sibling markers, unreconciled turns and stream.
An all-source reference search found no other view writer, codec or public
export. `visibleThreadTurnsAtoms` is exported within the app, but its
`Atom.make` view is not a serialized RPC result. The serializable upstream
timeline query does not make this derived view a wire object.

The current canonical design already preserves much of this payload behavior;
its `64/21` count and 21-case census test requirement are wrong. The provisional
replacement is `data/provisional-r28-thread-transcript-load-state.md`. It
retains the payload-aware union, repairs the count to `16/7`, and includes
`thread-load-state-props` as the unchanged 4/3 atomic consumer. No standalone
three-Boolean LiteralKit-only view may erase the streaming constraint.

## StreamingTurnView is a legitimate independent pair

`Thread.tsx:190-220` declares actual props `streaming: O.Option<StreamingTurn>`
and `turnActive: boolean`. E3 can involve an actual Option payload; “only one
Boolean” is not sufficient grounds to erase an existing data-carrier census
record. Here the source proves D1 because all four combinations are supported:

| `streaming` | `turnActive` | Concrete support |
| --- | --- | --- |
| None | false | Stream atom defaults None (`Chat.atoms.ts:510`); inactive run is not waiting. Reader returns null at `Thread.tsx:198`. |
| None | true | Activity is global (`Chat.atoms.ts:1313`), while `Thread.atoms.ts:285` filters the stream to the viewed thread. Viewing another thread while generation continues is explicitly supported by the comment at284 and cross-thread fixture. |
| Some | true | Real stream start/update writes at `Chat.atoms.ts:948,1067`; fixture `optimistic-user-turn.test.tsx:328-329` supplies Some plus `runTurnAtom = Initial(true)`. |
| Some | false | Public atom example `Chat.atoms.ts:499-502` writes a local stream without starting the run; actual `StreamingThread` fixture at `optimistic-user-turn.test.tsx:174-181` does the same. Reader `Thread.tsx:211` deliberately renders the completed/waiting-for-refresh text for this combination. |

This uses existing supported constructors and readers, not merely a schema
that could accept inconsistent state. Preserve required `blocks`, user
document, all stream metadata and both text branches. The cardinality is 4/4;
there is no E3 equivalence or implication to encode. Retain the existing D1
row and correct the false footer withdrawal. It is a different actual props
owner and relation from transcript `empty`/stream presence.

## Callable dock withdrawal and the real menu owner

`workspace/dock.atoms.ts:643-651` and `667-672` declare dual callable queries
`isPanelActive` and `isPanelOpen`; no paired Boolean values are stored there.
Withdraw `r2-apps-dock-panel-open-active` from the live census and archive its
current design with the row during parent integration. Logical implication
between two function results does not make a data carrier.

`App.tsx:654-680` does declare real `OntologyMenuItem` props `current`/`open`.
Its sole writer at `702-708` evaluates currentness and openness together.
Both currentness branches at `779-786` imply that the panel exists in a tabs
group. `Dock.models-tree.ts:597-598` includes the active panel in the group's
panels; searches at `586-592` and `1350-1356` consequently find it. A stale
focused-group id returns false. This actual props cluster stays qualified
4/3: closed, open but not current, current.

The current menu design requires deleting both callable APIs and introducing
`DesktopPanelPresence` through the withdrawn design. That dependency is no
longer justified by an eligible case. The corrected provisional menu design,
`data/provisional-r28-desktop-panel-menu-item-state.md`, derives its existing
closed/open/current literal directly at the actual props write and preserves
the callable APIs, focus behavior, snapshots and non-menu consumers. It does
not count the callable helpers as additional qualifications. Existing
`dock-shell.test.tsx:30-51,86-101` exercises real validated workspaces and
separate open/active observations; those tests remain meaningful.

## Three proposed D anchor repairs: two survive, one carrier is synthetic

`ComposerPolicy.ts:333-338` has actual `ComposerSendInput` fields `gateOpen`
at334 and `turnActive` at337. The real constructor at
`Composer.atoms.ts:318-323` reads a per-thread safety gate and global activity
independently. `decideSend` at `402-404` intentionally gives an existing gate
priority over an active-turn refusal. Both true is a supported request whose
result is gated; no declaration claims a validated exclusive operation state.
Fixtures at `test/composer-policy.test.ts:48-82` exercise gated, active and
ordinary requests. Keep D1, repair the anchor and stale decision citation.

`Composer.atoms.ts:368-376` declares `ComposerShellView`; its first Boolean
is `isEditing` at372 and `streaming` is at375. The writer at `398-411` reads
thread-filtered edit state and global activity separately. Edit mode may
remain visible while a global turn runs. The separate `isEditing`/actual
`contentToLoad` Option relation is already canonical as
`composer-shell-edit-content` and remains 4/3; its separate existence does not
invalidate this independent two-Boolean projection or permit duplicated
qualification of it. Keep D1 with anchor372 and an explicit cross-reference.

The third proposed repair does not fix its carrier. `ThreadComposerProps`
at `Composer.tsx:149-155` contains one Boolean, `streaming`, and no
`sendDisabled`. The function at `191-221` has no `sendDisabled` local;
`sendDisabled={O.isSome(surface.safetyGate)}` at213 is an inline JSX attribute
written into `ChatComposer`, alongside streaming at212. The actual receiving
`ChatComposerProps` declaration is already inventoried as
`chat-composer-props-gates` at
`packages/foundation/ui-system/editor/src/chat/chat-composer.tsx:151,185,191`.
The actual downstream Stop/Send reader at `269-287` supports all four supplied
pairs, including disabled Send while Stop is shown. This validates the
existing foundation D1 contract; it does not create the alleged app-local
named sibling field.

Recommend withdrawing `r2-apps-thread-composer-send-gates` as the synthetic
sibling-state owner and retaining the actual receiving props record. If the
independent correction instead treats a JSX attribute write as a distinct
eligible props-object construction owner, it must explicitly identify that
actual carrier/kind and explain why it is counted separately from the
receiving declaration. A bare 150→212 line change retaining `sibling-state`
and a nonexistent local `sendDisabled` is not acceptable. This is the one
remaining carrier-taxonomy interpretation to put to the bounded independent
apps correction; no alternative synthetic replacement row is proposed here.

## Exact row proposals and withdrawal list

These four JSONL proposals retain existing ids/statuses where applicable.
The transcript remains `designed` only as a proposed canonical integration
accompanied by a complete provisional corrected design; independent evidence
correction and P3 acceptance are still required. This fence changes no live
status. The menu and its downstream load-message owner need no cardinality or
member-set change.

```jsonl
{"schemaVersion":"boolean-creep-inventory/v1","id":"thread-transcript-load-state","file":"apps/professional-desktop/src/chat/ui/Thread.atoms.ts","line":254,"symbol":"ThreadTranscriptView","kind":"interface","members":["empty","failed","loading","streaming"],"status":"designed","evidence":[{"class":"E1","cite":{"file":"apps/professional-desktop/src/chat/ui/Thread.atoms.ts","line":326},"note":"The sole atom writer sets failed from Failure and loading from Initial plus waiting; empty additionally requires Success. The three Boolean flags are mutually exclusive."},{"class":"E4","cite":{"file":"apps/professional-desktop/src/chat/ui/Thread.atoms.ts","line":328},"note":"Empty requires the actual streaming Option to be None. Three Booleans times two Option-presence states give16 representable and7 legal tuples: empty/None; failed,None-or-Some; loading,None-or-Some; ready,None-or-Some. Required turns/unreconciled arrays remain full payloads, not invented binary census axes."}],"cardinality":{"representable":16,"legal":7},"storage":"derived","exposure":"internal","targetShape":"tagged-union","tier":1,"notes":"R28 source correction replaces both canonical64/21 manufactured array axes and raw8/4 omission of the actual Option relation. Preserve Empty's empty arrays/None, Loading's empty timeline turns with arbitrary unreconciled/stream payload, failed previous-success content, ready initial-not-waiting, success-while-waiting empty, receipt reconciliation, edit truncation, sibling ids and all stream metadata. Provisional correction: data/provisional-r28-thread-transcript-load-state.md; land atomically with unchanged4/3 thread-load-state-props after independent review."}
{"schemaVersion":"boolean-creep-inventory/v1","id":"r25-apps-streaming-turn-view-active","file":"apps/professional-desktop/src/chat/ui/Thread.tsx","line":194,"symbol":"StreamingTurnView","kind":"props","members":["turnActive","streaming"],"status":"disqualified","disqualifier":{"class":"D1","note":"Actual Boolean/Option props, not a lone-Boolean withdrawal: all four pairs are supported. None/false is default; None/true occurs when the global run belongs to another viewed thread (Thread.atoms285; Chat.atoms1313); Some/true is the real run writer and optimistic fixture328-329; Some/false is the public stream-atom constructor and StreamingThread fixture174-181, with an explicit completed/waiting-for-refresh branch at Thread.tsx211. Preserve full StreamingTurn payload. This differs from the transcript empty/stream implication."}}
{"schemaVersion":"boolean-creep-inventory/v1","id":"composer-send-input-gates","file":"apps/professional-desktop/src/chat/ui/ComposerPolicy.ts","line":334,"symbol":"ComposerSendInput","kind":"interface","members":["gateOpen","turnActive"],"status":"disqualified","disqualifier":{"class":"D1","note":"Actual request interface at333-338; per-thread gate and global turn activity are independently read into one object at Composer.atoms318-323. decideSend402-404 intentionally returns gated before streaming refusal; all four input pairs, including combined true, are supported requests. Required seed/state remain payload. First Boolean anchor corrected from319 to334."}}
{"schemaVersion":"boolean-creep-inventory/v1","id":"composer-shell-edit-stream","file":"apps/professional-desktop/src/chat/ui/Composer.atoms.ts","line":372,"symbol":"ComposerShellView","kind":"interface","members":["isEditing","streaming"],"status":"disqualified","disqualifier":{"class":"D1","note":"Actual interface368-376; writer398-411 derives isEditing from this thread's edit target and streaming from global turn activity. All four Boolean pairs remain supported, including edit UI during a global stream. The different isEditing/contentToLoad Option implication is already owned by composer-shell-edit-content; do not duplicate it or claim this pair exhausts the interface. First Boolean anchor corrected from272 to372."}}
```

Proposed live-projection withdrawals (preserve historical rows/reasoning and
raw independent evidence; remove current design only with its corresponding
qualified row during parent integration):

| ID | Disposition |
| --- | --- |
| `r3-apps-back-to-top-hidden` | One Boolean plus another owner's DOM projection; no new design. |
| `r2-apps-editor-proof-profile-picker` | Synthetic checked-member names on separate inputs; no new design. |
| `r2-apps-dock-panel-open-active` | Callable pair; archive its current design and use the corrected real-menu provisional design. |
| `r2-apps-thread-composer-send-gates` | Recommended synthetic sibling-state withdrawal; explicit JSX-construction-owner interpretation remains for independent correction. |

Do **not** withdraw `r25-apps-streaming-turn-view-active`. Do not add a second
raw8/4 transcript row beside the corrected16/7 row, a 64/21 array-axis row,
or a second menu row for its same current/open cluster. The streaming D1
props and transcript implication have different actual owners and relations.

## Source hashes, duplicate check and validation boundary

Duplicate checks used current inventory SHA-256
`4f1db0cacb616281fe14ed3fc15ee00c097673109596182189df58e1dbc3b4ea`.
All proposed rows preserve existing ids. All four proposed withdrawal ids
were present; the actual foundation ChatComposer props D1 and ComposerShell
edit/content qualified row were also present. The menu current/open and
transcript failed/loading consumer have their own existing records. No new
independent owner is invented by this audit. Parent integration must reconcile
any concurrent inventory changes.

The following 21 source/fixture files were byte-compared with `git show` at
the frozen HEAD; all matched. Tests are auxiliary constructor/consumer
evidence, not census corpus. The Effect reference is separately hashed.

| File | SHA-256 |
| --- | --- |
| `apps/oip-web/src/components/BackToTop.tsx` | `3429be27cc5bbcd03b1955c896050a5e0ae2f9c75a7a17e7b063480e9a8fbd2f` |
| `apps/oip-web/test/oip-web.test.tsx` | `a8a0cf693a8b5cec5e1adf15771638e4ed410e38564be527d5fde967bc55db9a` |
| `apps/professional-desktop/src/editor-proof/EditorProofPanel.tsx` | `9690c9a6eab3ace7836bd8389814f6720f33dc74cbc13bfb68dc263e07626df9` |
| `apps/professional-desktop/src/editor-proof/EditorProof.atoms.ts` | `2e7d002e334d25a048a764690dcac8c65f55094b4f1470be677f0dc072090f86` |
| `apps/professional-desktop/src/chat/ui/Thread.atoms.ts` | `5a0796772c916f3050bffc4a9b150a5e5e90c022566e52537ec7dca24a32bf70` |
| `apps/professional-desktop/src/chat/ui/Thread.tsx` | `ec3a5389bc3e06046fb8ae9aaeee1f60c041cc02c09715671f63c31a55e459ca` |
| `apps/professional-desktop/src/chat/ui/ComposerPolicy.ts` | `dda673cbc813be6d978cdc8dd70a5fcf81455ed40a90505b64f12741ad73e65b` |
| `apps/professional-desktop/src/chat/ui/Composer.atoms.ts` | `867b59c14893a0db54207763b0aaa7756a20621ddc3ccbe1dddd162652cba139` |
| `apps/professional-desktop/src/chat/ui/Composer.tsx` | `4bef55d74924915b9eb9fa1dc2c6c6bc9bb4bacd2ab5a730cd3144d2e15e97b5` |
| `apps/professional-desktop/src/workspace/dock.atoms.ts` | `e5dd42d4913ddfb46dd2c4a6b2ca820e7c8dcf5ccd34ea36a790f10c3720e3a7` |
| `apps/professional-desktop/src/App.tsx` | `d29376441f5566e197291c37478ca21bac2dc8f2d0bf2c253525ba6b2de5ec17` |
| `packages/agents/client/src/Chat.atoms.ts` | `91d8040ca676201732ecab34e6a8de8951598b1495ac800529b8609d82a0ad6a` |
| `packages/agents/client/src/index.ts` | `0dcbc0484f2b45ed535afb92c8c044bbc2e75a3df97779148770e17b52b46ac3` |
| `packages/workspace/use-cases/src/aggregates/Thread/ThreadTimeline.ts` | `2b66e3c9f89f54cbc32648092c449bb3cd367e115641b71422233e061fd5e8d7` |
| `packages/foundation/ui-system/dock/src/Dock.models-tree.ts` | `4070036c04d14954f6c2067bd40742b71aea1626340d323f90071437afc2df41` |
| `packages/foundation/ui-system/editor/src/chat/chat-composer.tsx` | `8338ea933b1cdae163c6a0201d7672a50a2caa5a377ef29c9645e5b0e2972def` |
| `packages/foundation/ui-system/editor/src/capability/profiles.ts` | `1a75e085f70be24bc6b5f990e4a9074a9885fe1d9f79304c5d0e1e3f4fd1adad` |
| `apps/professional-desktop/test/thread-transcript-view.test.ts` | `661b95aaf8b6bccee93924752f4b0591badb294c19b1b61d264482074c387175` |
| `apps/professional-desktop/test/optimistic-user-turn.test.tsx` | `9a7a257990ce02627c50bc8670d4fe78f1a1781a122cfa282963e828ceb74d42` |
| `apps/professional-desktop/test/composer-policy.test.ts` | `a806964c1a059ad07df8249c9fb47770f34dbc99be9b21bd0a967dd11d42c312` |
| `apps/professional-desktop/test/dock-shell.test.tsx` | `b4c374f628e25b93869808c03da2028ed1f5ae08d82356ea856bc91c35ef8117` |
| `.repos/effect/packages/effect/src/unstable/reactivity/AsyncResult.ts` (reference) | `acece66051b92124e453ddc3e4edfc0009955efe822071559c0d02f125af68c4` |

Current designs were read only; their baseline hashes are transcript
`b74ffaa30546df1dcea2b906f8b1cba22d6e68b043720aa1489926955ba9b890`,
load-message props
`b0108f4f8fd0c3a63add234e1c1eb736b6d13c95c7533158ed4caa3fc1c712e9`,
menu `b4c75ff4eb1adfdb1bee3bdc61bc420981e55c9df2bd4de0b8a3110731c192e7`,
and callable dock pair
`8cef4d568db1feb968a5e5dcfbc269416e92fdf38900d28ab4f51220e80c4e32`.
The prior first-D audit and chart family remain frozen at their handed-off
hashes. Local checks parse the four proposed rows, enumerate seven legal
transcript tuples without array axes, verify citation bounds and all eight
sections of each new provisional design. No product tests, package commands,
browser sessions or services were run. Full apps census coverage and the one
explicit JSX carrier interpretation remain with independent correction.
