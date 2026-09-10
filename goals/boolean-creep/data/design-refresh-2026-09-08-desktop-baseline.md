# Desktop baseline design audit — 2026-09-08

Source `7440cb8c4302ce64b87860069a464bafbf65f576`; main corpus `9b7553f618b2b3ee10e11a3d6ee93606f3e40ce1`.
The five designs are preparation for replacement P3, not a review receipt.

## Intake vault availability

`Intake.atoms.ts:1194-1203` has the sole surface producer. Its parallel
configured/onboarding writes select Some/None only for success. Failure and
initial both become pending; a success with waiting true still selects its
Option. The existing three-state design is sound, and now explicitly preserves
that waiting-success policy. The only member readers are file controls and
onboarding in `DocumentIntakeTarget.tsx:242-247,297,362`; action identity remains
independent. Cardinality remains 4/3.

## Transcript and load-message props

`Thread.atoms.ts:326-332` projects exclusive failed, initial-waiting loading,
and success-with-no-visible-content empty. The same derived literal serves the
paired private `ThreadLoadState` props at `Thread.tsx:144,252-253`. Arrays,
unreconciled receipts, and streaming content remain independent carriers;
failure must not erase them. Initial-not-waiting is ready, and a waiting
success can be empty. The corrected prose removes an ambiguous claim that a
failed timeline could select ready. Existing assertions are at
`test/thread-transcript-view.test.ts:60-61`; retained-content failure at
`test/optimistic-user-turn.test.tsx:461` remains a required regression.
Cardinalities remain 8/4 for the producer and 4/3 for the paired props.

## Panel presence and focused currentness

`dock.atoms.ts:643-672` queries the same workspace: active implies a containing
tab group exists. `App.tsx:779-786` adds focused-group currentness. The active
panel is always in `TabsNode.panels` (`Dock.models-tree.ts:597-598`), and the
panel lookup searches those panels (`586-592,1350-1356`), proving current
implies open in either currentness branch. A stale focused-group id returns
false. Both designs preserve the distinction between an active tab in another
group and the current focused tab. Atomic replacement of both workspace
helpers and all imports in App remains required. The live consumer/test search
matches the migration map; tests at dock-shell lines36-51,86-87,101 cover both
query helpers. Both cardinalities remain4/3.

## Changes and limits

Only the five packet designs and this handoff changed. No source, tests,
encoded values, dependencies, generated files, or git refs changed. Added test
requirements pin retained-success/failure behavior and recorded thread QA.
This audit does not replace canonical validators or independent P3.
