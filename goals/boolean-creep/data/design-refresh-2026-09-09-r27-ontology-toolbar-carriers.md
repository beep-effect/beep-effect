# Round 27 ontology toolbar and session carrier adjudication

Source HEAD: `8f266b878445ca8a7f751f9248da428a4dde39a1`.
Corpus main: `663904610cce2a38c06b0619a8c414646b69361c`.

Scope is the two raw records in
`data/sweeps/refresh-2026-09-09-r27-main-663904/r27-epistemic-ontology.jsonl`
and the 12 existing canonical records anchored in
`packages/ontology/ui/src/aggregates/Session/Session.document.tsx` or
`packages/ontology/client/src/aggregates/Session/Session.atoms.ts`.
Reads of directly related constructors, tests, and consumers below support
those carrier decisions; this is not another census or a P3 review.

The two raw records are both out of net because they describe anonymous
function input flags. Neither is admitted, including the raw `confirmed`
record. Of the 12 canonical rows, retain seven: all three qualified rows and
four D1 rows. Withdraw five canonical rows: three callable-only rows, one
invented sibling member, and one duplicate subset of an existing cluster.
No qualified status advances or new qualified replacements are proposed.

## The raw rows describe excluded inputs

| Raw id | Disposition and exact evidence |
| --- | --- |
| `r27-epistemic-ontology-document-toolbar-action-busy` | Reject out of net; do not admit as D1. `packages/ontology/ui/src/aggregates/Session/Session.document.tsx:74-80` declares an anonymous `input` object directly in the `documentToolbarState` function parameter. `opening`, `saving`, and `previewing` are its parameter properties at `:75-77`. Call-site values at `:143-145` are inline `AsyncResult.isWaiting(...)` expressions. There are no sibling locals named opening/saving/previewing in `OntologyDocumentRegion`. |
| `r27-epistemic-ontology-document-session-dirty` | Reject out of net; do not admit as confirmed or relabel D1. `packages/ontology/ui/src/aggregates/Session/Session.document.tsx:78-79` contains the anonymous input's sessionOpen/dirty fields. `documentBadge` at `:46` also has excluded Boolean function parameters. The actual producer relation at `packages/ontology/client/src/aggregates/Session/Session.atoms.ts:1531-1539` makes dirty false for a missing session, but valid E4 reasoning does not override carrier eligibility. The call site's sessionOpen at `Session.document.tsx:146` is an inline argument property, not a declared sibling Boolean value. |

Keep both raw rows and their execution receipt as original provider output;
the parent's adjudication records their rejection. Do not retarget either
row to a newly invented session/dirty carrier. The real `ontologySessionAtom`
continues to hold `O.Option<Session>` at
`packages/ontology/client/src/aggregates/Session/Session.atoms.ts:744`; the
region's actual `session` local reads that Option at
`packages/ontology/ui/src/aggregates/Session/Session.document.tsx:122`.

## The qualified toolbar result is a different, eligible carrier

Retain `document-toolbar-busy-disabled`, including its six members, E4
evidence, `64 -> 14` cardinality, derived storage, internal exposure, Tier 1,
target shape, and existing status. Correct only its declaration metadata:
`line: 81`, `kind: object-literal`; keep `symbol: documentToolbarState`.

The actual returned object is constructed at
`packages/ontology/ui/src/aggregates/Session/Session.document.tsx:80-92`.
Its named data fields are openBusy/openDisabled at `:81` and `:83`,
saveBusy/saveDisabled at `:84` and `:86`, and
previewBusy/previewDisabled at `:87` and `:89`. These are real output Boolean
values consumed through `toolbar` at `:142`, not the anonymous input fields
and not callable values. The open button reads its two fields at `:191`;
save reads its pair at `:198-199`; preview reads its pair at `:209-210`.

The source directly establishes the implications:

- `openBusy === openDisabled === input.opening`.
- `saveBusy` implies `saveDisabled`, because the latter is
  `!input.sessionOpen || input.saving`.
- `previewBusy` implies `previewDisabled` by the same construction.

The shared session prerequisite makes save-enabled/preview-idle-disabled
and its reverse impossible. Enumerating the four Boolean inputs that affect
these six fields gives 14 distinct output tuples; dirty does not affect
this cluster. This checks the existing cardinality against the explicit
constructor expressions, without turning the input parameters into an
eligible census record.

Supported toolbar fixtures at
`packages/ontology/ui/test/Session.workbench.test.ts:42-146` cover no-session,
open-session, and individual busy cases; the in-flight-save fixture at
`:118-131` preserves the siblings' enabled behavior. The existing design
already distinguishes the output projection from upstream inputs and keeps
the badge and session hint. No redesign finding is established by this
carrier audit. In particular, preserve the returned badge literals and
`sessionHint`'s string/undefined alternative at
`packages/ontology/ui/src/aggregates/Session/Session.document.tsx:90-91`.

## Region locals, duplicate undo/redo, and the invented sessionOpen local

Retain `ontology-document-region-edit-flags` as the existing D1 carrier with
all four members `[dirty, inferredView, canUndo, canRedo]`. Its current line
105 points inside a JSDoc example. Set `line: 120`, retaining
`symbol: OntologyDocumentRegion` and `kind: sibling-state`.

The component is actually declared at
`packages/ontology/ui/src/aggregates/Session/Session.document.tsx:114`.
Its Boolean-valued locals are dirty at `:120`, inferredView at `:125`,
canUndo at `:137`, and canRedo at `:138`. The latter two are actual named
Boolean results of stack-emptiness observations. The function-parameter
exclusion does not remove these declarations, and the required-number rule
does not remove named Boolean results that are really present in source.
The Undo and Redo buttons consume them at `:224` and `:241`.

Dirty is not simply another name for canUndo:
`packages/ontology/client/src/aggregates/Session/Session.atoms.ts:1531-1539`
compares the full changelog signature with the saved signature. The successful
save writer at `:3064-3070` records that signature without clearing the
changelog or redo stack. Therefore a saved document can still allow Undo,
and a save after an undo can be clean with Redo available. Undo at
`:3318-3328` moves the final change from the changelog to the redo stack;
Redo at `:3366-3373` moves it back. The stored inferred-view flag is separately
written at `:2637-2645`; it does not replace either stack or the saved
signature. Preserve these distinct source domains and the current D1
disposition. This eligibility handoff does not use schema permissiveness to
claim an exhaustive user-interaction trace for every four-bit combination.

Withdraw `ontology-document-undo-redo` as a duplicate subset, preserving its
prior row in the parent's archive. Its `[canUndo, canRedo]` refers to the same
two locals at
`packages/ontology/ui/src/aggregates/Session/Session.document.tsx:137-138`
already included in `ontology-document-region-edit-flags`. It introduces no
second producer, read surface, or independently owned cluster. These two
members are eligible; duplication, rather than callable or parameter
ineligibility, is the reason to withdraw this extra row.

Withdraw `r25-epistemic-ontology-inferred-view-session-open` out of net.
Although inferredView is a real local at
`packages/ontology/ui/src/aggregates/Session/Session.document.tsx:125`,
there is no sibling local named sessionOpen. `sessionOpen` occurs only in
the excluded function parameters, their reads, and the inline argument at
`:146`. The Switch disables itself with `O.isNone(session)` directly at
`:282`; it does not materialize a second Boolean member. The real local at
`:122` is the session Option. Keep that Option unchanged and do not silently
rewrite this inventory pair to `[inferredView, session]`.

## Boolean-valued atoms remain eligible

The SPEC explicitly includes sibling Boolean atoms/state fields. The Atom
runtime wrapper is not an exclusion when the observed state itself is a
Boolean. In this file:

- `packages/ontology/client/src/aggregates/Session/Session.atoms.ts:451`
  implements `workbenchState(initialValue)` as
  `Atom.keepAlive(Atom.make(initialValue))`.
- `ontologyInferredViewAtom` at `:897` is stored Boolean state initialized
  false, written from the Boolean enabled value at `:2639`.
- `ontologyDirtyAtom` at `:1531-1539` is a derived Boolean state atom; its
  value is the result of the session Option match, not the callback itself.
- `ontologyAutoOpenAttemptedAtom` at `:2985` is stored Boolean state
  initialized false. The bootstrap reads it at `:3023` and sets it true at
  `:3026`, before checking for an existing session or path at `:3027`.

Retain these three existing D1 rows:

| Canonical id | Retain/correction and supporting behavior |
| --- | --- |
| `r2-domains-ontology-workbench-boolean-atoms` | Retain D1, both members, `symbol: ontologyInferredViewAtom`, and line 897. The stored view toggle and derived saved-signature comparison have separate writers/readers at `Session.atoms.ts:2639` and `:1531-1539`. Toggling the view does not write the session changelog or saved signature. |
| `r2-domains-ontology-auto-open-and-inferred-atoms` | Retain D1 and both members. Set line to 2985 so it identifies its real `symbol: ontologyAutoOpenAttemptedAtom`; the existing line 897 identifies the other member. The once-only attempt writes only its own flag before checking session/path at `Session.atoms.ts:3023-3028`; the view toggle writes inferred state at `:2639`. |
| `r25-epistemic-ontology-dirty-auto-open-atoms` | Retain D1 and both members. Preserve line 1531; normalize symbol from invented property-like `ontologyDirtyAtom.autoOpen` to the real `ontologyDirtyAtom`. Auto-open can mark an already-open session attempted and return without changing it (`Session.atoms.ts:3026-3028`); dirtiness still depends only on the session/saved signatures (`:1531-1539`). |

These atoms do not become out of net merely because their initializers call
functions. The client test at
`packages/ontology/client/test/Session.atoms.test.ts:125-146` opens a saved
session, reads dirty false, replaces it with an equally long but different
changelog, and reads dirty true. The auto-open fixture at
`packages/ontology/client/test/auto-open.test.ts:81-103` constructs an existing
session before mounting bootstrap, and verifies bootstrap does not dispatch
another Open. Those are supported state/consumer examples, not a claim that
an arbitrary schema instance proves every lifecycle combination.

The similarly named action handles are different values:
`toggleOntologyInferredViewAtom` at
`packages/ontology/client/src/aggregates/Session/Session.atoms.ts:2637`
is a runtime function atom accepting a Boolean command, and
`ontologyWorkbenchAutoOpenAtom` at `:3020` returns void.
Open/save/preview are runtime function atoms at `:2941`, `:3053`, and
`:3098`, whose asynchronous results are probed inline in the toolbar.
Neither a Boolean input type nor an inline waiting predicate makes those
handles sibling Boolean state atoms. No new record for these handles is
proposed.

## Three directly encountered callable-only census rows

Archive and withdraw each row below out of net. Keep the original predicates
and all source behavior; do not replace the row with invented named results.

| Canonical id | Declaration and consumer evidence |
| --- | --- |
| `r3-domains-document-region-literal-guards` | `packages/ontology/ui/src/aggregates/Session/Session.document.tsx:94-95` declares two `S.is(...)` guard functions. Separate NativeSelect callbacks invoke them at `:256` and `:269`. The actual view and fold literal values are `mode` and `foldLevel`, with alternatives all/tbox/abox at `:259-261` and L0/L1/L2/L3 at `:272-275`; none is a sibling Boolean named by the row. |
| `r3-domains-graph-adjacency-edge-filters` | `packages/ontology/client/src/aggregates/Session/Session.atoms.ts:2016` declares an always-true callback; `:2191-2192` declares the importance-threshold callback. They are supplied/invoked as alternative `buildGraphAdjacency` callbacks at `:2269-2271` and `:2288`. No sibling Boolean values are declared. |
| `r3-domains-validation-runner-session-gates` | `packages/ontology/client/src/aggregates/Session/Session.atoms.ts:811-815` declares the sessionMoved function; `:1004-1005` declares hasValidationShapes. The runner invokes them at `:2769` and `:2795`. Separate control-flow checks do not create a Boolean data carrier. Preserve the actual validation status literals and Option result/error states written at `:2770-2778` and `:2796-2803`. |

## Other qualified carriers in the bounded files

`ontology-inspector-form-state` remains qualified and unchanged. Its eight
members are real Boolean data fields in the named
`OntologyInspectorFormState` schema at
`packages/ontology/client/src/aggregates/Session/Session.atoms.ts:393-407`.
The atom constructor returns that data model at `:645-675`, including the
explicit triple/graph-gesture implications at `:660` and `:671`.
`packages/ontology/ui/src/aggregates/Session/Session.inspector.tsx:81`
reads the model through the atom. Preserve the full required draft strings,
object-kind literal alternatives, and real session Option; this audit does
not turn required-string emptiness into additional inventory members or
erase the literal-object applicability case. No metadata or design change
is proposed for its existing `256 -> 29` record.

`r2-domains-ontology-graph-worker-requeue-latches` also remains qualified and
unchanged. Its members are an actual mutable `O.Option<WorkerCommand>` and
Boolean at
`packages/ontology/client/src/aggregates/Session/Session.atoms.ts:1791-1792`.
The retry flag is set true only inside the Option's Some arm at
`:1911-1917`; a fresh command is installed and the retry flag cleared together
at `:1949-1950`. Result handlers clear the flag while retaining the command
at `:1859-1868`. This is the existing three-state carrier, not a callable
predicate pair. Preserve the complete WorkerCommand payload and the absent
case. No metadata or design change is proposed for its existing `4 -> 3`
record.

## Exact parent actions

1. Keep the original two raw lane rows immutable and record both as rejected
   out of net in the parent adjudication. Admit neither row and count zero
   qualified additions from this bounded finding set.
2. Archive and remove these four canonical rows out of net:
   `r3-domains-document-region-literal-guards`,
   `r3-domains-graph-adjacency-edge-filters`,
   `r3-domains-validation-runner-session-gates`, and
   `r25-epistemic-ontology-inferred-view-session-open`.
3. Archive and remove `ontology-document-undo-redo` as a duplicate subset of
   `ontology-document-region-edit-flags`, whose complete member list remains
   `[dirty, inferredView, canUndo, canRedo]`. Do not characterize this
   duplicate as an ineligible Boolean declaration.
4. On `document-toolbar-busy-disabled`, change `line` from 74 to 81 and
   `kind` from `type-literal` to `object-literal`. Keep its id, symbol,
   members, evidence, cardinality, storage, exposure, target shape, tier, and
   current status. Its existing source/design proof is about the returned
   projection, not the anonymous function input.
5. On `ontology-document-region-edit-flags`, change `line` from 105 to 120;
   keep its four-member D1 cluster. Replace its note with this narrower
   source-grounded statement, avoiding an unsupported claim that this audit
   executed every user-interaction combination:

   > Four real toolbar Boolean locals: dirty at Session.document.tsx:120, inferredView at :125, canUndo/canRedo at :137-138. Dirty compares the current and saved changelog signatures (Session.atoms.ts:1531-1539), while Undo/Redo observe distinct stacks; save records the signature without clearing either stack (:3064-3070). Inferred view has its own Boolean state writer (:2639). This complete cluster already covers the undo/redo subset. Anonymous in-flight/session input flags are excluded; the returned busy/disabled projection remains a separate qualified owner.

6. Retain all three Boolean-atom D1 rows. Change only the auto-open/inferred
   pair's `line` from 897 to 2985, and the dirty/auto-open pair's `symbol`
   from `ontologyDirtyAtom.autoOpen` to `ontologyDirtyAtom`, as detailed
   above. Do not apply a blanket Atom-handle withdrawal to them.
7. Preserve `ontology-inspector-form-state` and
   `r2-domains-ontology-graph-worker-requeue-latches` unchanged. Preserve all
   prior source receipts and designs; advance no qualified status based on
   this handoff.

Result after these bounded canonical actions: 12 source-file records become
seven retained records, consisting of three qualified and four D1 records.
The raw lane's confirmed count is not the admitted count: both raw records
fail the binding parameter exclusion.

Validation: source HEAD was rechecked and the two audited source files have
no diff from HEAD. A bounded evaluation of the actual toolbar Boolean
expressions produced 14 distinct six-bit tuples. Tests were read as
supporting fixtures, not run; no product code was changed. The only write by
this audit is this handoff file. Parent owns inventory/archive/count
integration and resulting inventory validation.
