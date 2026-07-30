# Citation Parity and Transformation Method

This document defines how the goal proves capability parity without copying
Python object layout into the Effect-native domain model.

## Oracle production

1. Run the detached official eyecite pin with CPython 3.11.
2. Enumerate every independently asserted upstream fixture/subtest case.
3. Execute a versioned oracle exporter that emits schema-decoded normalized
   records.
4. Commit the normalized records and metadata; CI never requires the external
   Python clone.
5. Keep a live differential command for maintainers with the clone available.

Each oracle record includes:

- stable case ID and upstream file/method/case ordinal;
- repository commit and license class;
- raw input and operation options;
- applicable stage outputs;
- Python offset unit and UTF-16 conversion result;
- normalized-output hash and exporter version; and
- expected success, typed failure, warning, or ambiguity.

Use Effect Schema JSON codecs for in-repo fixture IO. Do not use native
`JSON.parse`/`JSON.stringify` in the TypeScript harness.

## Comparison stages

Compare the earliest stage that can explain a divergence.

| Stage | Compare |
| --- | --- |
| Clean | cleaned text, applied steps, raw-to-clean/clean-to-raw mapping |
| Tokenize | token kind, text, groups, extractor identity, clean coordinates |
| Extract | semantic citation tag/fields, metadata, corrected/full spans, component anchors |
| Filter/group | kept/dropped reason, overlap choice, parallel/string/authority memberships |
| Resolve | source mention, candidate authority IDs, outcome tag, chosen authority, ambiguity/failure reason |
| Annotate | replacement boundaries, balanced markup, output text, pincite inclusion |
| Report | pattern family, bounded-execution diagnostics, vocabulary/anchor versions |

An aggregate final-output match does not waive an earlier unexplained mismatch.
Stage-only implementation details may differ if their observable downstream
behavior and safety evidence are equivalent.

## Normalized citation record

The comparison representation separates:

1. semantic legal fields;
2. occurrence/source evidence;
3. document/group relationships;
4. resolution outcome; and
5. diagnostics.

Python class names map to target union tags through one committed mapping table.
Absent Python values normalize to explicit schema-modeled absence, not missing
ad-hoc object keys. Reporter/court strings normalize through the prerequisite
vocabulary API while retaining the captured spelling as occurrence evidence.

Fields may be excluded from exact equality only when the mapping table classifies
them as:

- representational (class/module name, mutable object identity);
- runtime-only diagnostics with no canonical counterpart; or
- intentionally canonicalized presentation covered by semantic equality.

Every exclusion needs a reason. Dropping an inconvenient legal field or source
span is not normalization.

## Offset law

Python string indices count Unicode code points; JavaScript indices count UTF-16
code units. The canonical public source-anchor unit is half-open UTF-16.

For every oracle span:

1. retain the Python code-point start/end;
2. convert both boundaries against the exact raw source;
3. store canonical UTF-16 start/end;
4. assert `raw.slice(start, end) === matchedText`; and
5. compose the verified-span source identity/version and normalization mapping.

Fixtures must cover surrogate pairs, combining marks, curly quotes, ligatures,
collapsed whitespace, HTML removal, duplicate matches, page boundaries,
straddles, malformed boundaries, and source drift. Ambiguous or stale mapping
fails closed with the prerequisite's typed error.

## Equality laws

### Exact parity

Use exact equality for:

- cleaned and annotated output text;
- citation tags and noncanonicalized semantic fields;
- token/citation ordering;
- matched raw substrings and canonical anchors;
- resolution outcome and authority relationships; and
- warnings/failures after the committed warning/error mapping.

### Semantic parity

Use schema-derived semantic equivalence for:

- stable vocabulary ID versus canonical captured reporter/court spelling;
- normalized punctuation/spacing explicitly classified as presentation;
- structured Bluebook canonicalization; and
- repo-native tagged error payload versus donor exception class.

Semantic equality cannot hide a changed authority, section, party, date,
pincite, reference target, or occurrence span.

## Transformation laws

Every transformation module declares one category in its JSDoc/schema
annotation and tests it with `S.toArbitrary` derived from the production source
schema.

### Reversible

For `CitationWireFromCitation`:

```text
encode(decode(wire)) = wire
decode(encode(citation)) = citation
```

If constructor defaults make encoded key presence canonical, compare against
the documented canonical encoded form in the first law.

### Semantic/canonicalizing

For `BluebookFromFullCitation` where the structured presentation contains all
supported legal meaning:

```text
toFullCitation(toBluebook(citation)) ≈ citation
```

The equivalence is the production semantic citation equivalence, not string
equality.

### Text rendering/parsing

For supported `BluebookTextFromBluebookCitation` grammar:

```text
parse(render(bluebook)) ≈ bluebook
render(parse(text)) = canonical(text)
```

Parsing unsupported or ambiguous text fails with a typed schema issue.

### Projection

When a representation discards information, encoding the projection back must
fail explicitly. Tests assert the unsupported reverse path; it may not invent
defaults or silently return a partial citation.

## Divergence ledger

Every intentional canonical difference records:

- source case IDs;
- observed Python and target outputs;
- classification: representation, confirmed upstream defect, repo safety
  requirement, or accepted extension interaction;
- legal/technical rationale and source;
- normalized comparison rule, if any;
- focused regression test; and
- reviewer/date.

A suspected Python defect is not silently “fixed.” Preserve canonical behavior
or document the divergence with independent evidence and a focused regression.

## TypeScript extension proof

For each extension family:

1. run the pinned donor suite and record baseline;
2. enumerate unique exports and test-observed cases;
3. remove cases already covered canonically;
4. verify source/license and domain ownership;
5. check interaction with canonical cases;
6. run exact-anchor and bounded-runtime proof; and
7. assign the terminal ledger disposition.

Adopted cases join the same normalized manifest and stage comparison harness.
Rejected/follow-up cases do not leave placeholder public types.

## Regex safety

Inventory every incorporated pattern family with:

- source path/commit/license;
- JavaScript compatibility;
- unsupported constructs and rewrite;
- literal prefilter/extractor routing;
- adversarial input family;
- measured input sizes and runtime;
- native fallback, if any; and
- bounded failure behavior.

Prefer a pure-JavaScript literal prefilter plus per-extractor regexes. Do not
combine the whole reporter corpus into an opaque alternation. Do not claim a
timeout interrupts an already running JavaScript regex.

## Required test lanes

- official normalized case manifest;
- first-slice product fixtures;
- stage-level differential tests;
- source-anchor hostile Unicode/HTML/drift cases;
- schema decode/encode and typed-error tests;
- transform property laws from production arbitraries;
- adopted-extension regressions;
- regex compatibility/adversarial runtime;
- package tests and dtslint;
- schema-first lint and documentation examples; and
- local Yeet verification before the single publish.

## Completion rule

Parity is complete only when:

- all canonical case rows pass;
- all canonical capability rows are complete or explicitly subsumed with
  equivalent case proof;
- every TS extension row has a terminal disposition;
- every adopted extension case passes;
- every divergence is explained and tested;
- every source anchor obeys the raw-slice law; and
- every transformation passes its declared law.

Passing a percentage threshold, a sample corpus, or only the four public wrapper
operations cannot close the goal.
