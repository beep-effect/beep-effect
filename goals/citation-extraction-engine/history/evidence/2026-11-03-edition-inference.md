# Source edition inference — 2026-11-03

EditionInference.ts adapts Edition.includes_year and ResourceCitation.guess_edition
for built-in immutable editions. It uses the existing authenticated frozen owner
and reference contract without changing the prerequisite vocabulary artifact.
No reporter correction or full citation-class update is claimed here.

## Source behavior

Exact candidates take precedence over variations before any filtering. A single
candidate is selected without a date check, even for a future year. Multiple
candidates are filtered only for a truthy year; None and zero skip filtering.
Duplicates remain separate occurrences and can keep the result ambiguous.
No candidates or a non-unique filtered result preserve the previous guess.
There is no fallback to variations after an unsuccessful exact-date filter.

includes_year first compares the supplied year to the live current calendar
year, then checks inclusive start/end years when present. Calendar reads occur
per predicate call, unlike helpers.get_year's import-time-plus-one ceiling.
The adapter captures Clock and the configured CurrentTimeZone service at
installation; wall time remains live and later caller contexts cannot replace
the installed zone. Final live-Layer local-zone/lifetime configuration remains
an integration duty. Authenticated Python datetime strings retain their stored
year prefixes rather than being converted through host timezone parsing.

## Independent evidence

ops/probe-edition-inference.py verifies the clean official commit
04d82c032ad5fd0f9ab72a61c87110c46ee8f52e and tree
a35a58fac03400f71a93a93485b77f1d56f2b02f under CPython 3.11.15. Original
includes_year and guess_edition bodies execute. A delegating predicate recorder
retains occurrence order, while a frozen datetime provider explicitly supplies
calendar year 2026; no result is replaced.

Five synthetic editions cover absent bounds, overlapping intervals and all three
artifact families. The 2480 selection cases cover exact/variation precedence,
empty/single/duplicate/multiple candidates, ten year states and two prior guesses.
They retain 3264 predicate/clock calls. All 2533 canonical edition identities are
independently obtained from the original extractors through the existing source
normalizer. Their 25718 actual includes_year results cover current/future years,
negative/zero years, inclusive endpoints and neighboring years.

The fixture stores canonical references, not duplicate edition payloads: the
existing operation/frozen-edition bundle remains the independently authenticated
payload source. This reduces the fixture to 889700 bytes and keeps the normal
formatter size policy intact. Full payload duplication initially exceeded its
1 MiB limit; no formatter exclusion or raised limit was introduced.

Producer SHA-256:
`e68a96683ae75e75bead81ce7c9922b4b37a72ab723a5bbcbd2c4903368ac1ab`.
Formatted edition-inference.json SHA-256:
`f59cd4e6a254e1ef2df7ca962e9ccfdbcaac8a66b91979683a00eb1ae6cafed1`.
Regeneration under PYTHONHASHSEED=73 compares byte-identical after formatting.

## Validation and ownership

Six tests pass across EditionInference and FrozenEditions. Every synthetic
selection result compares, and payload-read order matches the source's date
checks after its future-year short circuit. Canonical local smoke compares 101
boundary observations through the actual authenticated owner. Existing owner
regressions authenticate all 2430 reporters and 2533 editions and their payloads.

Controls prove live wall-clock updates after installation, captured-zone behavior
across a UTC year boundary, candidate refusal before receiving arrays, and a
captured deadline under a disabled caller Clock while an injected owner waits.
Methods require no caller services and errors retain no payload/reference text.
Reference selection remains data: single/prior references are not execution or
lookup authority. Payload reads use the frozen owner only when the source date
predicate requires them.

Full hosted replay of all 25718 canonical checks remains pending. Source
metadata-to-edition composition, corrected reporter/page behavior, custom edition
protocols, other metadata families, public extraction/Layer and full goal proof
remain open. Scoped lint/type, Oxlint, policy and Fallow checks are recorded with
this wave; this receipt does not establish complete superclass parity.

Final scoped package verification and all six focused tests pass after the
compact fixture's reference schema import was corrected from type-only to a
runtime import. Both policy checks, Oxlint, deterministic regeneration and
new-only Fallow pass. No new policy exception, semantic waiver or reduced floor
is introduced.
