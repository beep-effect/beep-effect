# CLI inline Exit tags and multiline Option comparisons

## Scope and behavior

This batch addresses 62 existing EV006 inventory rows in five files. Three
multiline `Option.some` comparisons use public `assertSome`, retaining their
subjects and payloads. The earlier preparation selector required no whitespace
after the matcher opening parenthesis and therefore missed these files;
selection now accepts that formatting without a fresh repository inventory.

The other 59 assertions compare a yielded `Effect.exit` value against the
single-property pattern `{ _tag: "Failure" }`. They now pipe the identical
yielded Exit through `Exit.isFailure` and public `assertTrue`. This retains
failure on a successful Exit and accepts the same typed failures, defects and
interruptions. The operation is still evaluated once; the Exit wrapper is
retained because replacing it with typed-error-only `Effect.flip` would change
what the original assertion accepts.

Preparation restricts this rewrite to inline yielded Exit calls with a sole
Failure tag expectation, checks public bindings and shadowing, and preserves
the complete subject expression. Structural statement comparison verifies all
62 replacements. Formatting and one now-unused Option namespace import are
accounted for. No registrations, native resources, property settings or
explicit timeouts change. Existing non-EV006 debt remains visible.

## Detector and inventory

The actual detector comparison removes exactly 62 EV006 findings. Other
finding groups preserve multiplicity and traversal order. Only occurrence and
evidence fields on 25 enclosing-statement baseline anchors are updated;
all other fields and statuses remain unchanged. All 62 removals match existing
open ledger rows by file, rule and occurrence. There are no new ledger findings
or baseline exceptions in this batch. All 62 ledger records now reference source
commit `56df0aa64cdecb1b22d4404cb63256c9064290f9`; their historical identities and evidence remain intact.

## Proof status

The before cohort passes 119 tests on Node in 31.366266221 seconds and Bun in
20.947982352 seconds, with zero failures/skips and stable source hashes. The
final generated Effect diagnostic artifact reports exit zero with empty output.
The after cohort passes all 119 tests on Node in 31.617997754 seconds and Bun
in 21.449470444 seconds. All four before/after runs preserve identical file/title
registration multiplicities, zero failures/skips and stable source hashes. The
ratchet passes with 3,819 findings, zero introduced and 1,198 resolved baseline
findings. Full CLI package verification passes: audit in 672.8 seconds and
docgen in 19.1 seconds, with unchanged test source throughout the proof. Load, pressure, runtime and process limits are
captured with each timing; no causal performance claim is made.

Private receipts use `cli-assertion-residual-batch-*`, with preparation inputs
from `cli-option-some-residual-*` and `cli-exit-tag-*`. The complete baseline,
remaining judgment inventory and hosted proof still gate goal completion.
