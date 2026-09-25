# Design: receipt-fallback-draft-occupancy

Current P2 design refreshed at exact source
`f137beedb270a071d4aa2ecc1dd52a9d233044d1` on 2026-09-22.
Actual owner `reconcileReceiptFallbacks`; 6 representable / 3 legal,
Tier 1. This refresh is bounded to the current owner and its consumers;
it is not a new corpus census, implementation, or independent P3 receipt.
Review and the merged packet-only ratification remain required before implementation.

## Current shape

After reading receipt statuses, the synchronous block binds
`currentDraftOccupied = O.map(registry.get(draftAtom), () => true)` at
1019, and initializes mutable `draftToRestore = O.none<StreamingTurn>()`
at 1020. The first inferred type is **Option<boolean>**, as verified with
the installed Effect v4 declaration and both installed native TS7 and TS6
compilers. It is not an explicitly annotated or inferred Option<true>.

The occupancy producer returns only None or Some(true); the declared type
nevertheless admits Some(false). The restore value is a real Option of the
full selected turn. The two are actual co-carried local values, not anonymous
flag parameters, nested payload projections or required-array emptiness bits.

For a not-persisted fallback, occupancy Some bypasses the restore probe.
Otherwise an already selected candidate bypasses another selection. With
both None, the lazy writer at 1032 chooses the first candidate and returns
false so it is removed from the retained fallback array. The selected
document is restored after the filter, with one revision increment.

## Cardinality gap

The occupancy Option has three declared states; the restore Option has two
presence states while retaining its full payload. There are six declared
state shapes and three legal producer shapes:

| Occupancy | Restore | Legal state |
| --- | --- | --- |
| None | None | available |
| Some(false) | None | impossible: no false-producing occupancy writer |
| Some(true) | None | occupied |
| None | Some(turn) | selected, carrying the complete StreamingTurn |
| Some(false) | Some(turn) | impossible: false producer absent and occupancy Some bypasses selection |
| Some(true) | Some(turn) | impossible: occupancy Some bypasses selection |

The correct gap is **6/3**, not the earlier 4/3 presence-only projection.
The const occupancy binding is never reassigned. Its sole Some producer
returns true; the only restore Some assignment at 1032 is reached through
lazy `O.orElse` at 1030 and `O.getOrElse` at 1031 when both Options are None.

Some(false) is not equivalent to None: `orElse` preserves any Some,
and `getOrElse` returns its false payload without selecting a turn. Such
a value would remove a not-persisted fallback without selecting it for
restoration. Preserve this distinction in the proof; do not create a
truthiness-based legacy adapter that treats false as absent.

## Target schema

Keep the existing payload-bearing target: one private annotated schema
union `DraftRestorationState` with `available`, `occupied`, and
`selected { turn: StreamingTurn }` cases. Use schema-first class variants
and the existing full `StreamingTurn` schema for the selected payload;
derive guards/matches from the schema instead of hand-written type tests.
Declare the private finite discriminator via `LiteralKit(["available", "occupied", "selected"])` (no `as const`). Each annotated `S.Class` variant owns `kind: S.tag(Kind.Enum.<case>)`; only selected has `turn: StreamingTurn`. Do not pass the defaulted `kind` to `.make(...)`. Combine the three class schemas with `S.Union`, apply `$I.annote(...)` annotations before `S.toTaggedUnion("kind")`, then use the resulting `.match` and case schema constructors. Keep the kit's construction/helper surface intact when annotating it. The state and variants remain private next to the existing `StreamingTurn` definition, after that payload schema is defined, without changing its exports.
The literal-only cases coexist with a payload-bearing selected case, so a
payload-free option-literal would lose required restoration data.

Initialize one local state from the actual draft Option after receipt reads:
None selects `available`, Some selects `occupied`. This directly models
draft presence and eliminates the intermediate widened Boolean Option.
It is not an adapter accepting arbitrary old `Option<boolean>` values;
there is no external or persisted occupancy input to normalize.

Within the existing serial filter, `available` selects the first eligible
not-persisted fallback and changes to `selected` carrying that exact object.
`occupied` and `selected` retain subsequent candidates. After filtering,
only `selected` restores the exact `turn.userContent` and increments its
thread revision. Do not introduce a stored atom, duplicate presence bits,
an Option<true> intermediate patch or a false-to-None coercion.

## Migration inventory

| Source / boundary | Required migration and invariants |
| --- | --- |
| `Chat.atoms.ts:41-48,400-472` | Reuse existing schema/identity infrastructure, reconciliation domain and full StreamingTurn; preserve request/truncate defaults, Document and ordered blocks. Define only the private restoration state. |
| `Chat.atoms.ts:998-1015` | Keep initial fallback snapshot and serial receipt requests; timeline and request-id handling remain unchanged. |
| `Chat.atoms.ts:1017-1020` | Take the current draft snapshot after asynchronous reads and initialize one state. Replace both actual Option locals. |
| `Chat.atoms.ts:1021-1027` | Reread current fallback array, preserve object-identity lookup and pending/accepted/unknown retention. |
| `Chat.atoms.ts:1028-1035` | Match available/occupied/selected for the first-candidate transition, carrying the exact fallback. Keep filter semantics and selection order. |
| `Chat.atoms.ts:1037-1047` | Keep persisted/user-persisted retirement, absent-status retention and fallback objects appended while reads were in flight. |
| `Chat.atoms.ts:1048-1052` | Match selected to restore exact userContent and increment the selected turn's thread revision once; publish retained fallbacks in original order. |
| `Chat.atoms.ts:1251-1259` | Preserve the sole invocation after successful timeline refresh, with reconciliation before clearing the active streaming turn; keep surrounding refresh failure handling. |
| `run-turn-reconciliation.test.ts:357-405,609-725` | Preserve isolated and multi-fallback restoration, exact receipt outcomes, occupied drafts, newer draft during I/O, appended fallback and revision assertions. |

Graft and the prior complete local-source audit found the declaration,
initialization, lazy probe, sole assignment and final read of these locals;
there are no public exports or outside writers of this synchronous owner.
All existing callers of reconciliation observe the same atom updates and
receipt outcomes. Do not alter `StreamingTurn` constructors/encoders or
create another sibling cluster from fields nested within its selected payload.

## Guard-deletion accounting

Delete both local Option declarations, the occupancy projection to true at
1019, the selected-candidate projection to true at 1030, the nested lazy
Option occupancy wall at 1029-1034, the mutable Option assignment and the
final `O.toArray` restoration loop at 1048. One exhaustive state transition
and selected-payload match replace them.

The type now excludes the two Some(false) shapes as well as simultaneous
occupied/selected. No source false guard is claimed as deleted: false was
representable through inference but never guarded because no supported
writer produced it. Preserve the separate request-id/status Option checks,
identity lookup and absent-decision fallback; they govern different behavior.

## Encoded-side impact

None. Both replaced values are private, transient state inside one
synchronous reconciliation block. Carry the selected existing StreamingTurn
instance without encoding, reconstruction or payload narrowing. Its
threadId, requestId, full userContent, truncateFrom, reconciliation value
and ordered blocks remain unchanged, including constructor defaults.

Preserve all atom values, exact document payload, receipt states, fallback
order, post-I/O snapshot timing and draft revision. There is no legacy
serialized occupancy object or public Option<boolean> decoder to migrate.
Do not introduce an adapter that silently maps Some(false) to None or to
occupied; the new state is constructed from the actual draft Option.

## Test impact

Retain the three legal behavioral cases: available selects the first
not-persisted fallback; occupied selects none; selected retains every later
candidate. Assert complete selected payload/document identity, retained
order and one revision increment. Keep pending/accepted/unknown and
absent-status retention, persisted/user-persisted retirement, exact request
association, and timeline handling.

Preserve the existing fixture where a newer draft appears while receipt
requests are in flight and the fixture where a new fallback is appended
during those reads. The snapshot must occur after the I/O, and filtering
must use the current fallback array while matching earlier decisions by
object identity. Required arrays and payloads remain complete.

The companion audit's compile-only probe verifies the old declared
Option<boolean> domain and the explicit true-only control; it is not a
product test or proposed committed fixture. The eventual implementation
needs focused reconciliation checks and full `@beep/agents-client`
package verification. This P2 audit does not run product tests or claim implementation verification.
At implementation, inspect affected composer/retry gesture behavior rather than
assuming private atom code is exempt: recorded browser QA is required for any
affected gesture-bearing UI under the campaign acceptance rule.

## Risk

Tier 1 internal stored-state refactor. The main risks remain moving the
draft snapshot before I/O, selecting multiple fallbacks, changing object
identity/order, dropping turn fields, or incrementing the wrong revision.
The corrected type proof adds another risk: confusing unproduced Some(false)
with None and claiming compatibility through Boolean truthiness.

Construct the three-case state from the actual draft Option and preserve
all supported producer behavior. The 6/3 correction is integrated with the prior 4/3 design bytes and
finalized audits preserved as historical evidence. No new canonical id or
overlapping cluster is added; independent P3 review remains pending.

## Refresh evidence and limits

Current source keeps exactly six references to the two old locals: declarations
at 1019-1020, occupancy read at 1029, selected occupancy projection at 1030,
sole write at 1032, and final restoration at 1048. The full owner and sole caller
remain at the cited anchors. `@beep/utils` exports its Option module, whose
`export * from "effect/Option"` at line130 preserves the installed map API;
it does not narrow the ignored callback's inferred Boolean result.

The current private compile-only probe reran against installed native TS7 and
TypeScript TS6, each exit0. It proves exact `Option<boolean>` equality, accepts
Some(false), rejects narrowing to `Option<true>`, and confirms an explicitly
true-annotated control differs. It uses an opaque draft payload because map's
callback ignores it. This is a bounded generic-inference proof, not a whole-owner
type check. Installed map declarations and local Effect reference signatures
agree on unconstrained output B; the reference orElse/getOrElse branch on None,
not Boolean truthiness.

The current fixture at `run-turn-reconciliation.test.ts:609-725` was inspected,
not rerun: it proves the intended assertion structure for first restoration,
later retention, persisted/timeline retirement, and newer draft plus appended
fallback during receipt reads. These existing assertions mostly use structural
equality; implementation tests must add reference identity assertions where
preserving the exact selected Document/turn is the stated obligation, rather
than claiming structural equality already proves identity.

Status requests remain sequential (`concurrency: 1`), failure becomes None via
Effect.option, requestId None avoids RPC, timeline fallbacks synthesize persisted,
and missing decisions retain newly appended objects. Read the current fallback
array after all status reads; decisions still associate by object identity,
not request-id equality. Duplicate request IDs are legitimate separate fallback
objects. No asynchronous boundary is introduced inside the synchronous state
transition/filter/publication block. Draft is written before its revision and
then retained fallbacks are published, in the existing order.
