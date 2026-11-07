# Original HTML case-name extraction observations

The pinned clean eyecite checkout is available at commit
04d82c032ad5fd0f9ab72a61c87110c46ee8f52e, tree
a35a58fac03400f71a93a93485b77f1d56f2b02f. The new producer invokes actual
Document construction, default tokenization and find_case_name_in_html. Wrappers
record calls to original tag lookup, tag-to-plain conversion, stop-word cleanup
and each of the five extraction helpers; none substitutes its algorithm.
Original citation objects retain complete metadata and span snapshots before
and after each call. Native width/bytes preserve source point coordinates and
do not substitute JavaScript display strings.

The corpus has 128 observations: 32 markup inputs crossed with full/short mode
and fresh/seeded metadata. All complete without a source exception; 88 change
metadata or source span state. Traces contain 142 tag lookups, 90 conversions,
116 cleanup calls and 136 extraction-helper entries. All five branches execute:
64 short-name, 36 versus-dispatch, 26 single-element, two separate-element and
eight stop-word defendant calls. Reaching these branches is not exhaustive
input-space or target coverage.

Cases include missing/one-sided emphasis, a whole case name inside one element,
separate plaintiff/defendant elements, nested elements, citation overlap,
attributes containing repeated name text or supplementary Unicode, uppercase
tags, versus spelling, stop words, punctuation, semicolons, entities, tabs and
newlines, empty elements and the backward word limit. Original token classes,
groups and locations are captured beside plain text and original markup.

## Source behavior to retain in the connection

HTML lookup searches up to 28 words backward, whereas the existing initialized
plain-text boundary scan has a different limit. Its skip predicate strips only
comma and ASCII space, so treating all Unicode whitespace as skippable changes
the selected word. Short-name lookup stops after the first non-skipped word,
even if that word yields no unique emphasis tag. The original map converts
original markup to plain text, not placeholder markup.

Versus handling looks two word slots left and right and requires exactly one
tag on each side. Equal tuples select the single-element path; otherwise the
separate-element path runs. The HTML single-element split pattern is
`\s+vs?\.?\s+` with IGNORECASE and maxsplit one; it differs from the existing
plain-name split pattern and flags. Cleanup order and plaintiff-length span
adjustment must remain observable. Stop-word and short overlap handling uses
the original negative slice before cleanup. No-result paths preserve seeded
metadata and full-span values rather than clearing them.

## Reproducible proof and limits

Runtime is CPython 3.11.15 with eyecite 2.7.6, lxml 5.1.0, regex 2023.12.25 and
fast-diff-match-patch 2.0.1. The fixture seals six source modules, the source
license, the producer and repository formatter version. Hash seeds 0 and 617
produce byte-identical formatted exports.

- Producer SHA-256: 5b6a1afeb93c9fb0543e498c17f357a315aa4459694d3a25994c575f5d0c5d68
- Corpus SHA-256: e6231633d7a3d4115295517539aecda42045ce2a8253f565f9db86dacfcf1670
- Portable verifier passes nine corruption controls and exact oracle replay.

The verifier rejects changes to the producer, corpus bytes, source/license
identity, words, tags, traces or final mutation. It is registered as source
evidence only. There is no TypeScript HTML case-name implementation or target
parity claim in this wave. The next connection must reuse prepared HTML
geometry, native slicing, existing stop-word cleanup, owned regex execution,
shared text accounting and captured metadata admission/timing. General host
protocols, exhaustive extraction/accounting, safety/scaling, public engine/codecs
and reflection/lifecycle closeout remain required. No semantic waiver, baseline
change or resource-limit change is introduced.

Hosted Fallow also completed successfully on the preceding generator head
f0f87efe50 (job 127739623823). That result does not qualify this new source wave
or the still-pending full hosted constructor/engine replay.
