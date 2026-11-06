# Connect discovery and both owned diff directions

The private post-cleaning preparation stage now builds actual source geometry
from already-cleaned native plain text and original native markup. It is not
the original Document argument-mode constructor: receiving both prepared inputs
here does not implement the source branch where a caller supplies both arguments.
Cleaning and those source constructor branches remain separate unfinished work.

## Source order and existing Effect ownership

HtmlGeometryPreparation reuses the existing captured metadata operation owner,
shared native admission, invocation text budget, per-call Scope and Clock.
Discovery's existing runner is split into separately callable placeholder and
emphasis phases, preserving the actual Document order:

1. Original placeholder regex and reserved native replacement.
2. Owned default diff from plain text to placeholder markup.
3. Owned default diff from original markup to plain text.
4. Original-equivalent emphasis matching and frozen native stripping.

The same existing regex worker handles both regex calls; the existing diff
worker handles both diff calls. All four children retire independently before
publication. The result uses existing geometry input and span-plan schemas,
with no new transport, scheduler, matcher, retirement loop or span algorithm.
The shared metadata dependency snapshot additionally captures Effect Path for
the diff asset location. Later caller contexts cannot substitute this service.
The discovery runner captures the current text reservation authority explicitly;
its placeholder method does not request a later caller's budget.

Both input layouts, exact default edit sequences and original markup identity
survive preparation. Configuration owns its fixed programs and snapshots the
diff runtime. The public-facing private stage method has R=never and a closed
error channel. Its complete geometry is data for later HTML-name composition;
the source count/coordinate/width distinction from the preceding correction is
preserved.

## Proof and initial fixture failure

The shared sealed span corpus reader now lives in CitationSpanOffsets.fixtures;
the existing geometry tests and new connected tests read one authenticated
source rather than parallel decoders. Discovery configuration and actual diff
runtime construction also reuse existing fixtures.

The first Node composition test failed with invalid-frame. Both test entries
had been compiled to the same temporary node-worker.mjs, overwriting the regex
entry with the diff entry. Separate scoped build directories correct the fixture
collision. The failed initial receipt remains in
.beep/html-geometry-preparation-tests.log. No production acceptance rule or
deadline was weakened.

The repaired regression run passes all nine tests across preparation, existing
geometry and standalone discovery in 18.46 seconds. The final preparation run
passes three tests in 6.83 seconds, including an added forward-diff refusal.
Each runtime replays three real source Documents, including both attribute
counterexamples. Every produced layout, ordered step sequence and emphasis
tuple matches the sealed source, and every source downstream tag query and
conversion matches through the resulting geometry. Twelve successful child
exits per runtime are independently confirmed, with no retained native or
operation capacity. A forward diffSteps refusal retires exactly the two started
children and publishes no partial geometry; neither later job starts.

Compile-time assignment proves the preparation method's R=never with its
inferred closed error union. Package lint/source/test type checks pass. Initial
yield-in-call test diagnostics were corrected by binding results before asserts.

Hosted integration requires all 16 original Documents, both exact worker edit
sequences, all 362 tag queries and 17 conversions per runtime, and 64 confirmed
child exits per runtime. That full replay remains pending. The geometry queries
in these tests use a separate read budget to verify source observations; they do
not claim whole-engine cumulative allocation proof. Cleaning integration,
Document input modes, HTML names, builtin difflib, whole-family scaling/safety,
the public service/Layer, exhaustive accounting and all other goal acceptance
requirements remain open.
