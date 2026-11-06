# Nullable single-match worker profile

The existing typed Effect RPC worker now accepts zero-width programs and empty
whole-match captures for single search and prefix match. The pull is marked
finished before publication, so either operation executes at most one native
exec. Existing source-descriptor binding, capture validation, frame sizing,
quota checks, shared admission, captured deadline and acknowledged physical
retirement remain in force. A zero match quota rejects an actual empty match;
it does not mistake that match for no result.

The synthetic producer runs CPython 3.11.15 re (Unicode 14) and third-party
regex 2023.12.25 independently. Eight literal/group/anchor patterns over seven
native inputs yield 56 cases and 336 engine/mode observations. Both engines
agree on every recorded capture span. Empty versus unmatched captures, optional
branches, a literal star, an empty program, start anchoring, a final newline,
a supplementary scalar and adjacent literal surrogate points are retained.
All finditer observations are retained even though nullable finditer execution
is still unqualified. The source fixture is not a narrower source inventory.

Producer SHA-256:
`799a16c68a8a8ce254b9cc100a2f404788ae8b3329eed14945bb5688edd5f952`.
Formatted fixture SHA-256:
`ffffdf0f2964c5f0d7c250d19aa00ab9dc71a1e2669fd05afb089479018e27b1`.
A second capture under PYTHONHASHSEED=137 is byte-identical after the standard
formatter. The test authenticates the committed bytes before decoding.

Local verification: 26 tests in four files pass, including the existing real
worker lifecycle/result suites, canonical tokenizer smoke, and new actual Bun
and Node nullable controls. Each new runtime smoke confirms fifteen spawned
children and fifteen independent exits: twelve comparisons, explicit nullable
finditer refusal, zero-quota refusal and a fresh successful call. Admission
returns to zero with no quarantine. The shared actual-runtime fixture replaces
duplicated runtime selection; the tokenizer and regex tests use that same
verified Node discovery. Only existing filesystem/path/spawner/digest layers
are provided; no broad new resource exception is introduced.

Hosted integration requires all 56 cases in both single-result modes under
each runtime, plus the same three negative/recovery controls: 115 independently
confirmed exits per runtime. That full replay is pending; it is not run locally.
Quick server lint/type checks and scoped Oxlint pass. Source-family safety,
geometric scaling and full goal accounting remain independent obligations.

Nullable finditer still requires Python's empty-then-nonempty advancement at
the same position. Repeated captures, nullable repeated bodies and more than
ten groups retain their explicit unqualified status. These are unfinished
implementation profiles, not approved limitations of the final engine.

Third-party boundary: these literal/group controls do not qualify regex's
Unicode or case-insensitive semantics. Direct pinned-engine checks find re
rejects U+0301 and U+200D for word while regex accepts them; re accepts U+001C
for whitespace while regex rejects it; regex accepts U+11F50 as a digit while
re rejects it. Under flag 2, re matches i against U+0131 and I against U+0130,
while regex rejects both. The helpers engine therefore needs its own frozen
character/folding profile before full metadata matching. Existing CPython re
character tables must not be relabeled as proof for it.

The end-anchored b-or-end control includes later search hits, empty hits at
nonzero positions and prefix no-match with zero quota, so single-result
nullable qualification does not depend only on patterns that match at zero.
The current compiler also rejects flag 64; verbose syntax and distinct
third-party character facts must be qualified before helper integration.

Final local policy checks pass: staged new-only Fallow has zero introduced
findings; Effect test policy reports zero introduced findings without adding
resource exceptions; schema-first retains a zero parity ratchet. Divergence
accounting remains eleven representation laws, four open fidelity questions
and fifteen unfinished target-proof rows, with no semantic waiver.
