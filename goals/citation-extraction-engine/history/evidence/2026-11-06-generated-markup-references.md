# Connected original markup and combined references

GeneratedReferences now executes the original markup helper and ordered
plain/markup caller from eyecite 2.7.6 find.py at
04d82c032ad5fd0f9ab72a61c87110c46ee8f52e (Free Law Project,
BSD-2-Clause). No source fixture, producer, pattern or expected result changes.

Markup execution reuses ReferencePatterns, RegexWorker, SpanOffsets and the
existing prepared HTML geometry. It builds the original name pattern before
checking missing maps/empty markup, maps citation start with bisect-right,
then maps whole-element and name-only endpoints with the original left/right
sides. Name text comes from plain text while named metadata comes from markup.
The original following-text rejection pattern executes in match mode through
the same worker. Mismatched emphasis tag alternatives, whitespace and surrounding
punctuation retain the pinned source behavior.

Prepared geometry must agree with owned plain text and both original source
layouts. Forward placeholder markup only promises the same Python point length;
its native width/UTF-16 layout is intentionally not equated to original markup.
A disagreement refuses without starting a child. Source slicing clamps Python
indices while output coordinates retain the original mapped values.

The combined caller preserves source guards for citation family and document
end, runs plain references before markup references, retains duplicates for the
existing final filter, and checks the aggregate candidate ceiling. Both generators
run inside one existing metadata operation with one Scope, deadline and cumulative
text authority. No new scheduler, framing, diff, worker or span-map infrastructure
is introduced. Named capture reading and fresh reference construction are shared
with the previously qualified plain helper.

## Evidence

All 121 original direct pin/markup/combined cases match all 77 references on
actual Bun and Node. Comparison retains complete native metadata, token text,
class/index, token/source/full spans and unattached Document state. Empty token
groups/edition lists and short=false are also asserted. Every result projects
through the existing final-selection adapter.

Each runtime independently confirms 173 physical child exits: 108 source regex
calls, 64 children for sixteen real bidirectional HTML preparations, and the
retained plain candidate-refusal control. Active/queued/regex/quarantine counts
are zero after completion. Missing geometry, non-case and document-end source
controls remain in the original corpus. A contradictory geometry plain buffer
refuses without an additional child; malformed input also starts none.

Generated/name/pattern/final-selection regression passes five tests across four
files in 42.22 seconds. Package lint/type checks and blocking native-runtime, effect-fn,
frozen-grant-set and package-test-import laws pass. Codec-compilation lint passes.
Scoped Fallow reports no new clone or cognitive score above eight; its estimated
CRAP lacks the hosted coverage graph and is not hosted qualification. Hosted
Fallow on preceding head a9933e4806891d672dac4fb73f28e8b18214e87e passes.
Hosted verification of this wave remains pending after publication.

The complete extraction loop, public engine/Layer, all remaining canonical/donor
accounting, semantic/Bluebook codecs, general host/subclass/model/alias behavior,
whole-engine safety/scaling, reflection and lifecycle adoption remain open.
All eleven representation laws, four fidelity questions and fifteen unfinished
proof rows remain open; no semantic waiver or completion row is promoted.
