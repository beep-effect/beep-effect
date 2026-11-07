# Connected original full-case metadata

The private CaseMetadata stage now executes the original
FullCaseCitation.add_metadata order: post-citation metadata, HTML/plain name
selection, pre-citation metadata, court guessing and superclass edition guessing.
It publishes the complete built-in metadata model only after every phase
succeeds. Name discovery can replace the numeric year observed by edition
selection. Pre-citation guards see the newly assigned names. Court inference
preserves a truthy prior court and checks all exact then variation editions;
edition inference uses the resulting year and preserves the prior guess when no
single candidate is selected.

The stage composes existing helpers inside one Effect operation, Scope, captured
deadline and text authority. Post/pre/name helpers expose their existing
low-level operations for enclosing composition; their standalone services remain
available. Typed RPC, admission, independently acknowledged retirement, frozen
court lookup and authenticated edition lookup are reused. The extract method
has R=never; the type-checked replay calls it without ambient services.
No new transport, scheduler or callback-bearing request is introduced.

The output preserves every built-in FullCaseCitation metadata slot, original
full-span overrides, unassigned pin positions, native text and numeric year.
Source None and empty strings remain distinct. Names already produce arbitrary
precision integer years, so edition inference now accepts that representation
without converting it through a potentially lossy number. All 2,480 existing
source selection vectors replay with both their number and bigint year
representations, including the zero-year no-filter rule. Full-law/journal input
contracts keep their existing number-year restriction by preserving the helper
schema's field precedence. This does not qualify arbitrary initial model values.

## Actual original model evidence

The producer calls the unchanged original FullCaseCitation.add_metadata using
actual Document initialization and default tokenization. Wrappers observe each
original helper's entry/exit and the original court/edition methods; they do not
reconstruct the phase decision or replace their implementations. Native model
snapshots are deduplicated by complete serialized content. Their references
preserve every observed transition and final state, without asserting object
identity. Edition references reuse the existing source artifact normalizer;
identities are prepared before instrumentation starts.

Twenty source texts are crossed with markup/plain and fresh/seeded model state.
They include post-citation court/date/pin/parenthetical data, pre-citation names
and dates, empty names, separate emphasis tags, Unicode, multiple edition
candidates, and prior metadata/span overrides. The corpus contains 80 complete
calls, 40 Documents and 150 distinct complete model snapshots. There are 80 post,
40 HTML-name, 51 plain-name, 80 pre, 80 court and 80 edition phase calls.

There are 21,065 source regex calls, including 20,164 post-phase substitutions
from original court normalization. Consecutive identical phase/method calls use
lossless run-length encoding; the verifier checks canonical runs, positive
counts, total counts and contiguous phase-state transitions. Target court lookup
reuses the independently qualified frozen table rather than spawning a worker
for each source court-name normalization. Remaining source regex calls and
four geometry children per markup Document define the physical child counts.

Source is eyecite 2.7.6 at 04d82c032ad5fd0f9ab72a61c87110c46ee8f52e, tree
a35a58fac03400f71a93a93485b77f1d56f2b02f, CPython 3.11.15 and regex 2023.12.25.
Versions, original source/license/lock hashes and formatter identity are retained.
Source calendar is fixed to 2026-11-06 and import-time highest valid year to 2027;
target replay freezes calendar reads while retaining the existing controlled
execution timer. Two hash-seed exports are byte-identical. Eight corruption
controls and exact pinned replay pass. This source verifier alone is not target
parity proof.

- Producer SHA-256: 6c15115203786794057d1b612ce3a0a710aebf7a49f538b9f93562020d8258cd
- Corpus SHA-256: a374a736cc27a3954165e0acfeca926a2adb92e7eacdbe6180794017afcd77a9
- Edition normalizer SHA-256: 9a8176ca6d55de38ff94731a1c532b9d4788651bcdd497c8d308b8520bae15e8

## Target validation

The eight-case smoke compares complete final metadata, numeric year, full-span
start/end, edition choice and HTML/plain decisions on Bun and Node. Each runtime
independently confirms 104 physical exits. Full hosted replay is registered for
all 80 calls and must independently confirm 1,061 exits per runtime; it remains
pending.

The shared-budget control measures a successful plain case, then gives the
entire composition one unit less allowance. It reaches final court production
and refuses with producedTextUtf16 after all 18 preceding children have exited.
Spent work remains charged, no partial model is returned, and all operation/
native admission is released. This guards against resetting the allowance at
post/name/pre/court boundaries.

The initial four-file regression passes seventeen tests in 21.39 seconds,
including full composition, edition inference, pre and post metadata. Package
lint and source/test type checks pass. Isolated source scans find no new
cognitive excess or full-case clone after sharing source Document schemas and
optional geometry preparation with name selection. Estimated CRAP warnings lack
the repository coverage graph and do not establish hosted gate outcomes.
No baseline, suppression or threshold is changed.

Fallow on the previously published a3aefd8cae head passes. Exact-head hosted
verification is required for this wave. Broad local suites remain skipped under
the operator's hosted-first direction.

## Remaining acceptance

This establishes connected built-in full-case metadata, not the complete public
citation engine. General mutable model/host/alias behavior, independent
all_editions mutation, initial non-number numeric years, source both-supplied/
no-map Document states, and exception translation remain open. Complete
extraction/filtering/resolution/annotation integration, public service/Layer,
Bluebook codec laws, exhaustive canonical/donor accounting, whole-engine safety/
scaling, reflection and lifecycle adoption are unchanged. All eleven
representation laws, four fidelity questions and fifteen unfinished proof rows
remain open, with no semantic waiver or acceptance reduction.

Linked continuation of PRs #2511, #2713, #2725 and #2737 under the approved
linked-follow-up publication exception.

After sharing Document/optional-geometry fixtures, the final six-file regression
passes all twenty-two tests in 26.76 seconds, including selection, connected
geometry, full metadata, edition, pre and post controls. Package lint and source/
test checks pass again (0.5/2.7 seconds). Markdown and the source-bound divergence
audit pass. These are focused local receipts; full hosted replay remains open.
