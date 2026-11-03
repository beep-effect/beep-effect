# Source-point alphabet and complete parsed feature inventory

The independent pinned-Python producer `ops/probe-regex-program.py` parses every
one of the 13,610 source-bound extractor instances through CPython 3.11.15's
stdlib `re._parser`. It authenticates the clean oracle commit/tree and existing
operation/inventory artifacts through the source reader, records both producer
hashes and an identity-ordered per-instance feature-vector hash. The portable
fixture is `regex-program-facts.json`; its focused test authenticates metadata,
feature totals and both producer files without requiring a live Python runtime.

The observed domain is LITERAL, IN (literal/range/category/negation), ANY,
AT_BEGINNING/AT_END, BRANCH, MAX_REPEAT and SUBPATTERN. All 67,814 subpatterns
have zero local flag additions/removals. The largest program has ten capturing
groups; eight instances have global ignore-case and 13,602 have flags zero.
No identity-sensitive backreference or lookaround assertion appears in these
captured programs. Every instance has positive whole-pattern minimum width and
none has a capturing group inside a repetition whose maximum exceeds one.
There are 0 instances with nullable multi-repeat bodies; the fixture records
an independent identity-ordered profile vector and minimum-width histogram.
This is an exhaustive feature inventory of the frozen
extractors, not a claim about every arbitrary Python regular expression.

## Representation argument

The private alphabet builder receives complete, already reviewed atomic
predicates as canonical interval sets over Python points 0..0x10ffff. Literal
surrogate points are included. It partitions the domain at zero, the terminal
point and every interval start/end+1. Every predicate is constant within each
cell. Assigning one distinct safe BMP symbol per cell therefore preserves all
supplied atomic predicate truth values and consumes exactly one UTF-16 unit
per original source point. Captures can retain Python source-point positions.
Original text is retained separately for materializing captured values.

The flat descriptor has at most 8,192 interval rows, so there are at most
16,385 cells. Symbols begin at U+0100, avoid regex syntax and remain below the
surrogate range. Sorted disjoint maximal intervals and valid atom indices are
schema invariants. The builder owns a metadata snapshot, charges the combined
encoded atom text against effective patternUtf16 before retaining fragments,
uses the existing canonical native input preparation, and captures the total
extract/operation deadline and Clock. Empty predicates remain explicit never-
matching atoms. Native flags are fixed at dgu; source case behavior must be
resolved in the supplied predicates.

This representation is deliberately not an execution capability. Mapping two
points with the same atom membership can lose identity needed by a
backreference. The program compiler must reject such a strategy for an
identity-sensitive feature or implement it separately; it must not silently
reinterpret one. The remaining full goal is unchanged.

## Passed and pending evidence

Four focused suites pass 23 tests, including a schema-derived interval property
test, intersecting predicates, empty/universal sets, native surrogate/scalar
separation, canonical-set rejection, expansion limits, source input regressions,
capture result regressions, producer authentication and captured Clock timing.
Server test compilation, package laws, scoped lint and normal commit hooks are
checked with this checkpoint. No existing oracle fixture or producer is changed.

The existing fixed hosted native qualification child is strengthened to check
all 1,114,112 source points against four frozen atom sets (4,456,448 additional
checks), including surrogate points. It also requires two exact source-point
capture spans over astral scalars mixed with literal surrogate points. The
checks run in bounded native input batches inside the existing independently
observed child, with its parent deadline/output/retirement controls. This new
native branch has not run locally and is not claimed passed until hosted CI
provides exact-head evidence. Previous-head native receipts remain historical.

## Still required

The complete reviewed program compiler must derive every atom from native
pattern storage, expand source flags, lower anchors and dot with original
newline semantics, and preserve groups, alternatives and repetition. It must
not feed original syntax or host word/case classification to this alphabet.
The actual regex child/supervisor, iteration, routing, full source matching,
family safety/scaling, work admission and public verified-span mapping remain
open. The old direct translator is a separate candidate; it is not automatically
approved by the alphabet's atomic representation argument. No fidelity question,
target proof row or semantic waiver is closed here.
