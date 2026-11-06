# Original reference-name validation using shared Python primitives

ReferenceNames now prepares the original four ordered name fields for generated
references. It reuses the existing frozen PythonCharacters, PythonCase lowercase,
PythonTextData digits, native Unicode input and captured text-budget services.
No host Unicode casing or new character table is introduced. Installation captures
all dependencies; returned isValid and collect methods require R=never.

The original predicate order is retained: None/short length, first-point uppercase,
trailing period, digit-only classification, then lowercase exclusion-list lookup.
Length counts native Python points and literal surrogate words remain distinct.
The collector follows plaintiff, defendant, resolved_case_name_short and
resolved_case_name order without deduplicating equal names from distinct fields.
These native candidates are internal preparation values, not generated references,
regex execution grants or persisted citation identities.

## Exact source data and proof

All 117 original is_valid_name observations from the sealed generated-references
corpus replay against the production predicate, including the unchanged pin's
acceptance of Commissioner and Akerman. The 93-entry original exclusion list is
authenticated before installation. Its canonical compact UTF-8 JSON SHA-256 is
4a6957a33e8862f93f0c45d8a73a27548205b7363ae8524781bbe89a887165c9.
Legaré is retained as Unicode text; an initial ASCII-escaped JSON fingerprint
correctly refused because its bytes differ from the runtime UTF-8 codec. The
fingerprint now specifies the actual canonical encoding rather than changing
source list content or case.

The sealed list has neither surrogate nor non-BMP characters. Consequently,
projecting a fully Python-lowercased native value for membership cannot collapse
a literal surrogate sequence into a list entry. Lowercase itself uses the frozen
Python implementation, including contextual mappings, rather than host casing.
The caller's original source buffers are prepared through existing bounded native
ownership. Lowercase output and its captured view consume the installed parent
text authority. An oversized enclosing authority is refused at installation;
methods cannot replace it with a caller service.

Target proof covers all 117 validity observations, four-field ordering with equal
names retained, modified-list refusal, enclosing-policy incompatibility and
one-unit parent-budget exhaustion. Name/full-constructor/final-selection regression
passes all four tests across three files in 11.78 seconds. Package lint/type checks
pass in 0.4 and 1.9 seconds. Codec-compilation lint passes. The isolated complexity
scan reports no new cognitive score over eight; its estimated CRAP warning lacks
the full repository coverage graph and is not hosted qualification.

The existing generated-reference producer, verifier and corpus hashes remain
unchanged. Source eyecite is 04d82c032ad5fd0f9ab72a61c87110c46ee8f52e,
CPython 3.11.15 and the frozen Unicode 14 primitives already qualified elsewhere
in this packet. This focused predicate replay is not exhaustive engine parity.

## Hosted state and next integration

Hosted Fallow on c524b436b9 passes, confirming the shared native-startup repair.
Reference-name preparation still needs connection to bounded literal pattern
construction, dynamic source-profile qualification, actual regex execution and
markup/plain coordinate conversion. The whole extraction loop, public service/
Layer, all remaining canonical/donor obligations, semantic/Bluebook codec laws,
whole-engine safety/scaling, reflection and lifecycle adoption remain open. No
completion row or semantic waiver is promoted by this helper.
