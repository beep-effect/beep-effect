# Frozen court lookup and native normalization

The private CourtLookup adapter ports eyecite 2.7.6 helpers.get_court_by_paren.
It authenticates the complete ordered courts-db 0.10.22 table rather than using
current court aliases or changing the source's collision policy. Empty normalized
input returns None; the first exact key wins, otherwise the last prefix in source
order wins. All 2,798 retained identities resolve through the public CourtId and
findCourtById API under artifact crv1:f353e51400a5:fad63b383b92. Historical court
selection remains separate from the current vocabulary's descriptive metadata.

Normalization filters non-word points using the existing pinned regex V0 Unicode
facts, then applies existing Python Unicode 14 lowercase semantics. Filtering
precedes lowercasing: punctuation removal can alter contextual Greek sigma.
Native storage remains authoritative, including literal surrogate controls; the
final projection is only a lookup key, never a source span. The source all-point
scan proves retained/lowercased word points cannot be literal surrogates, and every
frozen court key is ASCII. No semantic waiver or new normalization law is added.

## Effect and native text ownership

The adapter reuses the existing schema policy, captured Clock/timing, optional
CitationTextBudget owner, frozen regex ranges and native Unicode/lowercase helpers.
The alphabet's existing interval search is shared through a dual utility. A common
native point writer serves slicing and the new cooperative native filter. The
filter measures exact width/units before allocation; lowercase now also offers
a reservation callback while retaining the original standalone method behavior.
No worker, transport, scheduler, timer implementation or public identity is added.

Each standalone lookup owns a fresh budget; composition captures its enclosing
owner. Source copy, filtered output, lower input/output and final receiving copy
are reserved before allocation. For S.C. the exact charge is 12 UTF-16 units:
4 + 2 + 2 + 2 + 2. Ceiling 11 refuses; an enclosing ceiling 12 primed with one
unit refuses at cumulative usage 11. Lowercase expansion of U+0130 requires seven
units, while six refuses. Captured source ceilings, malformed native layout,
same-length authenticated-table mutation and a disabled caller Clock are tested.
Inner Unicode timeouts map to the captured extraction deadline safety failure;
no partial normalized result is returned. Returned lookup methods have R = never.

## Source and target evidence

The producer runs the original helper directly with its real regex functions and
ordered court list. It requires a clean oracle at commit
04d82c032ad5fd0f9ab72a61c87110c46ee8f52e, tree
a35a58fac03400f71a93a93485b77f1d56f2b02f, Python 3.11.15,
regex 2023.12.25 V0 and courts-db 0.10.22. It captures 17,156 complete calls:
2,798 original court strings, 14,325 distinct normalized prefixes and 33 controls.
There are 16,306 interned native words and 14,338 normalized keys. The source
all-point scan covers 1,114,112 points, retains 140,234 word points and produces
140,235 lowercase points, digest
5406900a24bf9d0004b82c95f4e452f1e3d3b242381b58d21b9ee18037de3abf.

Independent producer runs under PYTHONHASHSEED 193 and 197 are byte-identical
for all three fixtures. Producer SHA-256:
27aa1067f11cf79ef74b7f7b0001707aee41ffb4f92440d72e4e9854e9a134a4.
Canonical ordered table payload is 81,475 bytes, SHA-256
22a917e998d65b6e4edf7990ef79dd2f2affa74702c9be1068b7f30f33ce2831.
Separate string-payload fixtures preserve every entry and remain individually
below the formatter's existing one-MiB limit:

| Fixture | Bytes | SHA-256 |
| --- | ---: | --- |
| court-table.json | 93103 | 2a0ee8d810577297440ff5a52da8b479a265953262ea1fb479005ef95ae6054c |
| court-words.json | 559909 | 8b354b13a3d6314568a76c7689690dd9ae547072897cb452825dcf639ca7fc4e |
| court-lookup.json | 734815 | fcd99932bfab35fc94de74ecb9c8a335a8700bf0d0da57f835f5ef0054bc75db |

The target test authenticates all three fixtures and compares every one of the
17,156 source results and native normalized words. Fourteen focused tests across
CourtLookup, PythonCase and RegexAlphabet pass. Server package lint/type checks,
exact-file Oxlint and schema-tag idioms pass. Effect-vitest and schema-first
policy scans introduce zero findings; Fallow reports zero introduced dead code,
complexity and duplication findings. The divergence checker retains 11 laws,
four open fidelity questions and 15 unfinished proof rows. Broad local aggregate/install verification is
deferred to hosted CI under the operator's hosted-first instruction.

Full-case post metadata must still compose court lookup with pin, year and
parenthetical processing. General custom object protocols, full engine admission,
public service/Layer, remaining extraction families, complete accounting and
hosted coverage remain open. This phase proves the bounded native built-in helper;
it does not mark the GOAL, source operation ledger or representation proofs complete.
