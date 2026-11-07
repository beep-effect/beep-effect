# Source-derived builtin annotation diff

The engine now supports the original `use_dmp=False` annotation path through
schema-owned `useDmp: false`. Omission retains DMP. The flag selects a fixed
backend in the existing isolated diff worker; request/result framing, typed
Effect RPC, parent admission/deadline, output capacity and independently
acknowledged retirement remain shared. A runtime request cannot select a worker
path, executable or arbitrary algorithm. The builtin child does not need to load
the DMP WASM asset. No Python runtime dependency or new worker framework is added.

The implementation adapts CPython 3.11.15 `difflib.SequenceMatcher` with
`isjunk=None` and `autojunk=False`, matching the exact call in pinned eyecite.
It retains ascending candidate positions, strict-greater longest-match tie
updates, iterative region splitting, adjacent-block coalescing and original
opcode order. Replacement emits deletion before insertion. Sparse row maps use
Effect MutableHashMap; intermediate state is linear in bounded input points.
Produced steps and packed byte capacity are checked before appending. The parent
process owner remains the independent stop/retirement authority for the slow
worst case. Full whole-engine allocation/scaling qualification remains open.

For the original alignment example plain `ab`, source `ba`, and annotation
`[0, 1)`, the source observes `[]ba` with DMP and `b[a]` with builtin diff.
The default public engine reproduces both outputs on Bun and Node. Annotation
keeps the existing placeholder mapping, markup handling and source evidence.
Ignored private-entry algorithm slots remain unread when an installed updater
or the unchanged/empty-source branch bypasses diff construction.

## Independent source and portable evidence

The producer executes original eyecite commit
`04d82c032ad5fd0f9ab72a61c87110c46ee8f52e`, tree
`a35a58fac03400f71a93a93485b77f1d56f2b02f`, using the existing authorized
Python 3.11.15 environment and fast-diff-match-patch 2.0.1. Source cleanliness is
checked before and after observation. CPython stdlib SHA-256 is
`0c6afc23568d55b3e9ac914f9c5361e3033e778aa5b58d3cc82835fc5c638679`.
The complete existing PSF license covers the adaptation; the eyecite opcode
projection retains BSD attribution. The notices also correct an accidental
Bluebook reference copied into the eyecite-js baseline section; the relevant
Bluebook donor remains eyecite-ts and neither license text changes.

The fixture contains 4,231 independent step observations: all 3,969 ordered pairs
of binary strings of length zero through five, Unicode/lone-surrogate controls,
long repeated no-autojunk cases and deterministic mixed inputs. Ten additional
original annotation observations retain both backend choices. No target code
constructs expected outcomes. The compact producer owns one complete row per
line; the exact formatter exclusion preserves those sealed bytes. The generated
identity formatter profile is refreshed with the standard cache-profile writer.

Corpus SHA-256:
`3b8cb9c95fd5b9525c585b9d05ab2e10cdb6b6c774c91dbfcae2100307c6bc11`.
Producer SHA-256:
`cacfe9e3bda0d6341317dcbdba03182eb89399d09314877a7a3652440f3e3b92`.
Exact source replay and eight corruption controls pass. The fixed portable parity
composition now invokes this verifier and honors an alternate fixture directory.
The composed audit passes all thirteen components while retaining the pending
final target-parity verifier; audit success is not a parity verdict.
No source/donor disposition or representation law is promoted by this addition.

## Target qualification and prerequisite boundary

The algorithm replay compares every original step and checks one-step-short
ceilings for every nonempty result. Separate controls distinguish UTF-16 units
from Python points and refuse zero packed-output capacity. Actual Bun and Node
children each replay eleven selected original cases, including the differing
tie, astral/lone-surrogate values and all long no-autojunk rows. All twenty-two
launched children have independent confirmed exits and zero remaining admission.

The default public engine compares five accepted original annotation outcomes
per runtime, including DMP/builtin tie selection, repeated text, HTML and astral
Unicode. A sixth original builtin row contains a lone surrogate. Its attempted
verified-source construction is explicitly rejected by the existing substrate;
no fabricated proof or source normalization is used. Native algorithm/worker
coverage retains that exact string. This is not a waiver of the four unfinished
fidelity questions or a claim that arbitrary Python strings are verified source.

The five runtime/algorithm tests pass after phase extraction in 38.76 seconds.
A separate canonical replay computes steps for all nineteen original builtin
SpanUpdater maps and matches their complete entries and 328 left/right queries
in 3.46 seconds. Earlier unchanged DMP/annotation regressions also pass in the combined run;
only the initial public lone-surrogate assumptions fail in that first run. Those assumptions are corrected by the
explicit prerequisite-rejection controls above. Five public input tests pass,
including default-true and explicit-false selection. Package lint/types,
declarations, targeted oxlint and blocking laws pass. Scoped Fallow reports zero
introduced findings without suppression or threshold/baseline change.

General host/document/model/callback behavior, production object identity,
further formatting forms, whole-engine safety/scaling, exhaustive source/donor
accounting and final deployment/lifecycle acceptance remain open. All eleven
representation laws, four fidelity questions and fifteen unfinished proof rows
remain open without waiver.
