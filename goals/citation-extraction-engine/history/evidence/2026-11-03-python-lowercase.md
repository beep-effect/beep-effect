# Pinned lowercase prerequisite for extractor selection

The clean oracle at commit 04d82c032ad5fd0f9ab72a61c87110c46ee8f52e and tree
a35a58fac03400f71a93a93485b77f1d56f2b02f uses Python `str.lower()` when building
and querying the case-insensitive Ahocorasick extractor filter (tokenizers.py,
lines 425-443). Helpers also lowercase normalized court strings. The host
runtime's Unicode tables cannot be substituted: Effect String.toLowerCase on
the current runtime changes U+1C89 and U+10D50, while pinned Python Unicode 14
leaves them unchanged. This is a source-version behavior contract, not a waiver.

The private lower adapter uses Effect HashMap/HashSet, Schema, Clock, Duration,
timeout and cooperative scheduling. The pinned contextual-sigma operation has
no equivalent frozen-Unicode primitive in Effect String. Standard collections,
resource/timing operations and codecs remain upstream services. The adaptation
of CPython's `lower_ucs4` and final-sigma behavior is attributed under the
existing PSF license notice.

## Independent observations

The producer requires CPython 3.11.15 / Unicode 14 and the exact clean oracle
pin/tree. It enumerates all 1,114,112 Python character values, including literal
surrogates. There are 1,433 non-identity lowercase mappings, 4,453 cased points
in 155 ranges and 2,602 case-ignorable points in 427 ranges. It reads the pinned
interpreter's cased/case-ignorable predicates through typed read-only ctypes
calls and independently verifies every result against public islower/isupper/
istitle behavior and contextual lowercase observations. Any mismatch aborts.

The data vector SHA-256 is
2867105c95497978ca380fe5d57ae4cf1ea82f06f04d4ea205f5caebc02bb71c.
The fixture binds the producer and tokenizer source digests, pin/tree, versions,
point totals and the full frozen data. It includes all 1,433 changed single
points plus twenty controls: contextual sigma, ignored characters before and
after sigma, expanding dotted I, supplementary case mappings, literal surrogate
words, post-Unicode-14 characters and a long combining-mark run. Repeat
production followed by the repository checker/formatter is byte-identical for
both the generated module and observation fixture.

## Adapter and proof

The adapter snapshots/validates canonical native storage through the existing
Python Unicode service, reads original words rather than display text, computes
context from the original input, and measures the complete output width, point
count and UTF-16 growth before allocating its output buffer. Frozen mappings
include expansion and canonical storage-width shrinkage. Scans yield at least
every 4,096 source points, including contextual neighbour scans. A captured
minimum clean/operation deadline wraps preparation, measurement and emission;
caller clock or later policy mutation cannot replace it. No partial output or
source-bearing failure is returned. The enclosing operation still owns total
produced-text reservations; this helper does not issue that capability.

Three focused tests pass: all 1,453 native-word observations, expanded-output
limits with mutated caller policy, and a captured deadline despite an ambient
clock override. Test compilation, quick server lint/check, scoped Oxlint and
new-only Fallow pass. Fallow initially reported the combined measurement/emission
function; separate measurement and encoding responsibilities resolve it without
suppression. The earlier inline schema compilation finding is fixed by hoisting
the schema AST.

This supplies lowercase semantics for the upcoming extractor selector. It does
not implement or approve the selector, Ahocorasick ordering, regex family safety,
all third-party regex behavior, or complete engine parity. No family completion
row advances. Full hosted corpus checks remain required on the final pushed head.
