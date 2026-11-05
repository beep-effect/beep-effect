# Literal cleaner primitives and Unicode source proof

Date: 2026-10-29. Four private clean.py primitive implementations now run as
bounded, interruptible Effect operations. HTML cleaning, the named/custom server
cleaner pipeline and source-map production remain required.

## Exact primitive behavior

LiteralCleaners implements inline_whitespace, all_whitespace, underscores and
xml from pinned eyecite clean.py. These are primitive operations, not a partial
public replacement for clean_text. No public service or client surface is
published by this change.

The whitespace scans replace maximal matching runs with one ASCII space,
preserving leading and trailing spaces. Inline whitespace recognizes only space
and tab. All whitespace uses the frozen Python 3.11.15 Unicode 14 facts plus
U+200B. It does not adopt JavaScript whitespace rules or remove the BOM.

The underscore scan removes runs of two or more underscores and preserves
isolated underscores. XML removes only the first prefix matching the source's
anchored pattern: literal lowercase `<?xml`, followed by the first ?> before any
LF. CR, vertical tab, NUL and Unicode line/paragraph separators are accepted
between prefix and terminator, just as Python dot accepts them. Leading
spaces/BOM, uppercase XML and a premature LF prevent removal. A second XML
prefix remains in the output.

All algorithms preserve unchanged UTF-16 slices, including surrogate pairs and
isolated surrogates. The helper does not manufacture an anchor or normalization
mapping from the resulting string. Extraction and source restoration must still
use the verified-span substrate's mapping contracts.

## Operation safety and current boundary

Construction captures source/output ceilings, an owned deadline duration and
Clock. Each apply method has R = never and fresh operation-local output state.
Caller mutations cannot raise its captured ceilings. Fragment lengths are
charged before constructing their source slices or appending them; failures
return no partial output. Concurrent calls do not share allowance.

Each scan moves forward through the input and yields at most every 4096 UTF-16
units examined. The output uses an operation-owned Effect MutableList builder
and one final join. No native regular expression executes in these algorithms.
This is literal routing evidence, not completion of the regex-family safety
gate, process isolation or full operation performance proof.

Tests prove exact source/output ceiling equality, source-count rejection even
when cleaning would shrink the result, output rejection without truncation,
independent concurrent budgets, a captured controlled deadline timer and
interruption. The error is a closed private tagged failure without source text
or nested causes. Translation to the public CitationSafetyLimitExceeded union
remains part of the live engine composition.

Each primitive invocation owns its budget. These helpers do not yet implement
shared cumulative produced-text accounting across an entire multi-step
clean_text request, its empty-step production path, custom callables, request
modes or its public Layer. HTML requires qualification against lxml parsing and
its exact XPath selection; generic tag removal is not an equivalent
implementation.

## Independent source corpus

The literal-cleaners corpus has SHA-256
242701dc5547bc00fa441117925f934e45c4505f1515e4c51ab0e8380dd199e8. It binds the
clean oracle commit/tree, clean.py and the official UtilsTest source, Python
3.11.15, Unicode 14, seed zero, dependency versions, license/lock and producer
hashes. The existing BSD-2-Clause notice covers adapted algorithms and
source-derived fixtures.

The producer evaluates each primitive on every code point from zero through
0x10FFFF, including surrogate code points: four times 1,114,112 actual source
evaluations. Its inline classifier contains exactly tab and space. All
whitespace contains the 29 frozen Python whitespace characters plus U+200B. No
single code point changes under underscores or xml.

Another 440 source vectors cover maximal runs, leading/trailing boundaries, XML
greediness and anchoring, CR/LF differences, every matching whitespace point,
BOM/zero-width behavior, astral and isolated surrogate preservation, and cases
on either side of the 4096-unit scan boundary.

Repeated deeply immutable strings are interned into 135 content-addressed
values. Each reference hashes the ASCII bytes of Python ensure_ascii JSON string
encoding. The target verifies every content digest independently with the
existing Python-string encoder and SHA-256 service before running all 440
vectors. This reduces the corpus from repeated strings to complete retained
values and references without memoizing mutable resources.

The verifier checks provenance, complete case names/counts, classifier facts,
artifact hashes/order/reachability, and source versions. Eight corruption
controls reject missing/duplicate vectors, wrong pin/producer, changed/missing
text artifacts, dangling references and a JavaScript-only BOM classifier. Fresh
pinned replay reproduces the complete report.

## Existing observations and remaining proof

The target additionally reads the unchanged public-operation corpus at SHA-256
ae441000ddc90537864e3fdd4a9dfc4aa81af37a65818b48ce9bf37d95d1eeb1 and
supplemental corpus at SHA-256
4f462b83f10b124db4768743b0131b30954a085a0c93197be7232e0de0f0abc9. Four official
observations and six supplemental contexts contain only the implemented
primitive names. Nine nonempty compositions execute those helpers in the test
harness; one empty-step context checks the harness identity path. This does not
qualify a production multi-step pipeline. HTML and invalid-step observations are
explicitly outside this helper scope, not rejected canonical capabilities.

Source/donor target accounting, source maps, HTML/custom cleaner integration,
production native identity and historical candidate handling, live engine
assets/Layer, tokenization/extraction, annotation, full safety/scaling, Bluebook
laws and final one-PR lifecycle remain open. No completion row, normalization
proof or semantic waiver is promoted.

## Validation

The complete server package gate passes build, source/test type checks, tests,
lint and documentation generation (audit 32.0 seconds; docgen 10.4 seconds).
All four focused tests pass, including all 440 vectors and 135 content checks,
the existing literal observation harness, count isolation, controlled deadline
and interruption. The source verifier passes eight corruption controls and
fresh replay. HTML/custom composition, mappings and final safety proof remain
open; these checks do not qualify the complete engine.
