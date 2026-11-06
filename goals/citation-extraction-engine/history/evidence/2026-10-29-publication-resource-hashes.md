# Exact law/journal resource hashes and stable edition ties

Date: 2026-10-29. Private hashing proof and evidence-based comparison-rule
qualification. Live edition-artifact lookup and callback integration remain open.

## Source and observations

The producer invokes actual FullLawCitation, FullJournalCitation and Resource
hash methods under clean eyecite 2.7.6 at commit
`04d82c032ad5fd0f9ab72a61c87110c46ee8f52e`, tree
`a35a58fac03400f71a93a93485b77f1d56f2b02f`.
Python is CPython 3.11.15 with 64-bit hashes and hash seed zero; the oracle
clock remains 2026-10-28. Frozen reporters/courts versions remain 3.2.53/0.10.22.
The fixture records source, producer, normalizer, lock and license digests.
Attribution remains Free Law Project, BSD-2-Clause, under the root notice.

Artifact:
`packages/law-practice/use-cases/test/fixtures/eyecite/publication-resource-hashes.json`.
SHA-256:
`57962d12465617aca8f4f483329ac1c0ef94b2f2c866e7f836edc0a29a7e8599`.

Twenty-two observations cover actual U.S.C. and Harvard Law Review editions,
metadata/selected-edition independence, empty and duplicate edition lists,
reversed distinct abbreviations, reversed tied abbreviations, complete reporter
fields, exact naive/aware/microsecond datetime strings, Unicode edition and
group-key ordering, extra/null/empty groups, reserved group names, absent groups
and journal-specific extra/empty-edition cases. Synthetic edition variations
are actual frozen source dataclasses made with dataclass replacement; they do
not claim membership in the production reporter dataset.

## Stable ties qualify candidate-bag normalization

The source sorts all_editions only by short_name. Python sorting is stable:
reversing two distinct editions with the same abbreviation changes the hash.
The observed resource hashes are 1688041276245499301 and 299135432516611241.
Reversing distinct abbreviations retains the same hash, as does reversing the
BMP/astral pair after code-point sorting. Edition multiplicity also matters.

This deterministic counterexample limits the prior broad candidate-bag law.
The six earlier seeded case pairs remain representation observations, not
proof that law/journal resource hash inputs are unordered. The revised rule
permits candidate-bag sorting for representation only when observable behavior
is retained. Raw relative order must reach resource hashing when stable ties
can distinguish it. The helper requires occurrence-ordered lookup descriptors
matching the semantic edition references. It never sorts by artifact identity
before constructing the source hash input.

Existing normalized operation fixtures do not recover discarded raw candidate
order. A live/source input adapter must retain or obtain the required order;
final corpus comparison cannot infer it from a sorted bag. AuthorityIdentity's
older bag-based fallback is likewise not proof of exact runtime equality for
these cases. This obligation remains open; no semantic waiver is introduced.
The divergence row remains in audit and its evidence references are refreshed.

## Implementation and verification

PublicationResourceHash encodes every group and full edition/reporter payload,
then applies the source's sorted-key JSON, ASCII escaping, stable abbreviation
sort and CPython integer reduction. Source class/all_editions overwrite
same-named group fields. Metadata and selected edition do not enter the hash.
Exact Python datetime strings are explicit trusted-adapter payloads. Reference
and occurrence-order coherence is checked, but a reference does not authenticate
its own payload; live artifact validation remains required.

RuntimeHashEncoding shares string quoting and digest reduction with the case
helper. Its explicit code-point comparator handles BMP, astral and isolated
surrogate characters without assuming JavaScript UTF-16 sort order matches
Python. Complete preimages are captured before the first asynchronous digest.
No mutable citation-bearing object is memoized.

All twenty-two target comparisons pass, along with occurrence-order controls,
changed-input recomputation and digest-error redaction. Eight corruption
controls and a fresh source replay pass. The server package gate passes:
audit 31.9 seconds and docgen 10.9 seconds, including build, source/test type
checks, the full test suite, lint and documentation. Existing case hashes and
live-resource/table compositions remain green after the shared-code refactor.

The live frozen-edition adapter, general resource registry, callback-owner
integration, exact host-key normalization and null-page identity allocation
remain open. The three full callback mutation engine scenes remain open.
Per-entry group projection, parser safety, Bluebook, exhaustive accounting and
one-PR closeout remain required. No completion row is promoted.
