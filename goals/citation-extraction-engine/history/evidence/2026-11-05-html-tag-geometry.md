# Prepared diff offsets and native HTML tag geometry

The private SpanOffsets component folds prepared source edit steps into the
original relative-shift/constant-replacement index and implements built-in left
and right bisect lookup. It preserves Python's final-updater selection at index
-1 when the bisect result is zero, positions beyond the source length, duplicate
offsets, deletion constants and empty-map failures. It does not clamp lookups to
the source span or replace the two source diff algorithms with another matcher.

Source layouts and consumed/emitted point counts must agree. The combined input
UTF-16 budget and diff-step ceiling are checked before packed index allocation.
The private table uses a fixed-endian DataView, bounded by the admitted entry
count; snapshots expose copied data, not live updater functions or storage.
Construction and snapshots yield cooperatively. Lookup uses logarithmic binary
search over immutable offsets. The enclosing operation owns captured timing and
lifetime; this pure prepared-map component does not run the source diff itself.

HtmlTagGeometry reuses the two prepared map owners and existing native input,
range slicing and cumulative text budget. It requires coherent forward/backward
layouts and owned plain text. The original emphasis tuple's first value is
stripped inner markup, not an HTML element name. Unique-match lookup uses a
half-open markup range and returns empty for zero or multiple matches. Conversion
uses only the first supplied tag, maps both endpoints with bisect-right and
performs Python slicing while returning the original mapped coordinates.
Exposed native tag buffers are copied, preserving installed state after mutation.
No verified mention span or document identity is manufactured by these helpers.

## Original-source capture and limits of qualification

The producer requires clean eyecite commit
04d82c032ad5fd0f9ab72a61c87110c46ee8f52e, tree
a35a58fac03400f71a93a93485b77f1d56f2b02f, CPython 3.11.15 and
fast-diff-match-patch 2.0.1. It calls the original constructors, get_diff_steps,
get_diff_steps_builtin and update methods; it retains actual constructor offsets
and original partial-function targets as data. Two explicitly labelled supplied
step cases exercise zero runs/duplicate offsets through the original constructor.

The 68 maps include both original engines, native scalar/literal-surrogate-pair
controls, unpaired surrogates and bidirectional maps from 14 real HTML Documents.
All 2,222 original offset observations are captured. The Documents supply 312
original tag queries and 14 conversions, including uppercase/mismatched/nested
markup, quoted attribute angle brackets, entities, newlines and script removal.
Hash seeds 353/359 produce byte-identical corpora; repository formatting leaves
the fixture seal unchanged.

| Artifact | SHA-256 |
| --- | --- |
| Producer | 056e2cead2d863ed14ac2b08a1c4e8f2974c6bc8162d1e5cfb982dea05bff955 |
| span-offsets.json | d1f8800ef9c6b3730348c0f634d92d9e6c473a822ab72b8c933d57a67f030fd5 |

Four focused tests pass against every constructor entry, offset observation,
prepared tag query and conversion. They also cover step/input ceilings, incoherent
plans, invalid offsets, empty conversion input, copied buffers, duplicate tag
ambiguity, first-tag-only conversion and cumulative text refusal. Scoped
lint/type and Oxlint checks pass. Exact DMP/builtin diff generation, emphasis
regex discovery, placeholder generation, case-name HTML extraction and complete
public engine composition remain unqualified. Captured source steps are fixture
evidence, not a production diff implementation. Effect Differ supplies a patch
interface; it does not provide the pinned text edit sequence or bisect behavior.

## Hosted quality findings and shared composition

Check run 42141805406 / Fallow job 127643835598 / artifact 13468600918 reports
candidate processName complexity and repeated adapter/fixture setup. Candidate
name and year assignment are now separate named phases using the same patch
schema. MetadataComposition shares the existing admitted scope/timing/result
boundary with typed installation-time callbacks; adapters retain the same owned
configuration, closed errors and R=never methods. Pattern/descriptor ownership,
oracle-byte reading and actual-runtime fixture installation are shared as well.
No threshold, suppression, baseline or safety policy is weakened. Hosted
confirmation of these repairs remains pending.

The combined geometry/scanner/cleaner/processing regression has 17 passing tests
and one Bun replay that reached the existing extractDeadline. A focused replay
of that case passes with unchanged limits in 98.54 seconds; its terminal receipt
is .beep/html-stage-bun-replay.log. The original failed receipt remains in
.beep/html-geometry-final-tests.log. No cause beyond the observed deadline refusal
is inferred, and this is not a whole-repository green claim.

PR #2713 merged at head 0f6159a4efdf54a52aca6b1c21126d1e03937d91 as
31d8efc09b14d558df48fc3ba75add397a3d2ac1 while this work was local. The
operator subsequently authorized linked follow-up PRs for this unchanged goal,
including the prepared geometry/quality work. The authorization is recorded in
decisions/2026-11-05-linked-follow-up-publication.md. It grants no merge authority
or completion claim; full parity, accounting, resource and lifecycle duties remain.
