# Citation Parity and Transformation Method

This document defines how the goal proves capability parity without copying
Python object layout into the Effect-native domain model.

## Oracle production and independent accounting

1. Run a static AST/source inventory over the detached pin, recording every
   public operation, implementation/model/regex family, test method, assertion/
   parameter/subtest source, fixture, and source-content hash.
2. Independently run the pin with CPython 3.11 and an instrumented, versioned
   oracle exporter that emits schema-decoded normalized case records.
3. Reconcile static source IDs, runtime case IDs, aggregate capability rows, and
   target-test IDs with an executable checker.
4. Commit the inventories, normalized records, schemas, and metadata; CI never
   requires the external Python clone.
5. Keep live regeneration/differential commands for maintainers with the clone
   available.

The portable artifacts live under
`packages/law-practice/use-cases/test/fixtures/eyecite/`:

- `source-inventory.json`;
- `canonical-cases.json`;
- `typescript-extensions.json`;
- `divergences.json`;
- `regex-inventory.json`; and
- the adversarial regex corpus and benchmark metadata.

Fixture schemas/helpers export only through
`@beep/law-practice-use-cases/test`. The package command
`citation:parity-check` validates accounting without a live clone. P0 includes
negative-control tests proving it rejects every omission, duplicate,
unknown/composite state, missing proof/license/hash/test, unexplained
divergence, invalid follow-up, and unaccounted regex family.

Each oracle record includes:

- stable case ID and upstream file/method/case ordinal;
- repository commit and license class;
- raw input and operation options;
- applicable stage outputs;
- Python offset unit and UTF-16 conversion result;
- normalized-output hash and exporter version; and
- expected success, typed failure, warning, or ambiguity.

The source inventory and runtime exporter must not derive case completeness
from the same hand-maintained list. If dynamic test construction prevents exact
static enumeration, record the static assertion/parameter source plus runtime
case events and require the checker to reconcile their declared expansion
rather than silently dropping the source.

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

Every transform module annotates and tests two independent axes:

- information law: `reversible | canonicalizing | projection`; and
- decode/encode totality: `total | partial` for each direction.

The property generators come from production schemas with `S.toArbitrary`.
Every symbol also has dtslint proof for its exact encoded input, decoded output,
decode Effect, encode Effect, and error/service channels.

### Base citation codec

`Citation` itself is the structured codec. Do not add a
`CitationWireFromCitation` wrapper that merely renames `Citation.Encoded`.

```text
decode(Citation.Encoded) = Citation.Type
encode(Citation.Type) = Citation.Encoded
```

Test exact round trips. If schema defaults canonicalize encoded key presence,
declare that as the schema's canonicalizing law rather than inventing a second
wire model.

### `BluebookFromFullCitation`

The source schema is deliberately `S.toType(FullCitation)`, or a proven
equivalent, so its `Encoded` is exactly `FullCitation.Type` and this invocation
type-checks:

```ts
S.decodeEffect(BluebookFromFullCitation)(citation)
```

The transform has:

- decoded output `BluebookCitation.Type`;
- partial decode for unsupported full-citation forms;
- total encode for every member of the supported structured Bluebook union;
  and
- a canonicalizing information law.

For supported input:

```text
encode(decode(fullCitation)) ≈ fullCitation
```

The equivalence is the production semantic citation equivalence. Unsupported
decode fails through `SchemaTransformation.transformOrFail` with a typed schema
issue. The encode branch may not invent legal fields.

### `BluebookTextFromBluebookCitation`

Its encoded input is `BluebookCitation.Type` and decoded output is branded
`BluebookText.Type`. Decode is total rendering; encode is partial parsing of
the documented grammar:

```text
encode(decode(bluebook)) ≈ bluebook
decode(encode(text)) = canonical(text)
```

Unsupported or ambiguous text fails with a typed schema issue.

### Projection

A future projection declares its lossy direction and fails the unsupported
reverse explicitly. It may not manufacture defaults or silently return a
partial citation.

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

1. obtain explicit authorization, use the frozen donor lockfile, run the pinned
   donor suite, and record before/after clean status and baseline;
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

P0 freezes numeric `CitationEngineLimits` before P1. The adversarial lane uses
geometric input sizes, recorded warmups/repetitions, runtime/tool/CPU metadata,
and this stable growth gate: no accepted family exceeds a `3.5x` median-time
increase for two consecutive input doublings. Absolute latency is
informational. Deterministic pattern/work counters and configured caps are
exact. A seeded catastrophic pattern must fail.

Rewrite or reject unprovable patterns. Killable isolation is allowed only when
canonical behavior cannot otherwise be retained and P0 records the boundary;
a wall-clock timeout around same-thread JavaScript is never accepted as
interruptibility proof.

## Required test lanes

- official normalized case manifest;
- first-slice product fixtures;
- stage-level differential tests;
- source-anchor hostile Unicode/HTML/drift cases;
- schema decode/encode and typed-error tests;
- service contract, `R = never`, error-translator, and Layer boundary tests;
- transform property laws from production arbitraries;
- adopted-extension regressions;
- regex compatibility/adversarial runtime;
- limit-exhaustion/nontruncation, bounded-concurrency, and Effect
  `Clock`/`Duration` tests;
- observability span/attribute allowlist and raw-payload redaction tests;
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
- every transformation passes both declared law axes.

Passing a percentage threshold, a sample corpus, or only the four public wrapper
operations cannot close the goal.
