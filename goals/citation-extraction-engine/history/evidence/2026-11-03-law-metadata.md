# Native law metadata composition — 2026-11-03

LawMetadata.ts composes the actual add_law_metadata field-update behavior using
the existing native context matcher, captures, pincite/parenthetical helpers
and captured year parser. Its source-native patch is private data; Python point
positions remain unverified until document mapping. This does not implement the
subsequent FullLawCitation.add_metadata superclass edition inference.

## Source capture

ops/probe-law-metadata.py verifies the clean official commit
04d82c032ad5fd0f9ab72a61c87110c46ee8f52e and tree
a35a58fac03400f71a93a93485b77f1d56f2b02f, CPython 3.11.15 and regex
2023.12.25. It constructs actual FullLawCitation objects and executes the original
helper without replacing any result. Recording wrappers delegate both regex
functions and retain law/parenthetical-year search order. The source upper year
is explicitly frozen at 2027, matching the existing calendar profile.

Thirty-two token/text vectors, two existing numeric years and two span-end
values produce 128 cases and 156 source searches. Metadata starts with seeded
values and full_span_end=777, so empty matches prove clearing/reassignment rather
than coincidentally comparing default None. An unrelated pin-span field remains
unchanged. Cases cover subsections, publisher/month/day/year, year ranges and
bounds, Unicode digit versions, nested/extra parentheses, empty captures,
literal surrogates, stop tokens, split text and source 300-point truncation.

The exact source law/year patterns and their forward/backward descriptors are
authenticated against context-matches.json SHA-256
4b91de078a8cd6fedcd2c01fb98f3ef525497d207340265f4ff1318b5cea564d and compared
with the imported original constants. Installation additionally verifies raw
width-plus-native-word fingerprints:

- POST_LAW: bcfd81892211f7373d1a515cebf32c58ad43da653d5f20dab85df00dbcc6edef.
- YEAR: 82554a3e0f705f6f6a95a3920c1c93da975dee85e28a60956fdd0c70a8220fa9.

Producer SHA-256:
`c8f1e6a457b73a17188214e7f7076ade70ce4323670f18e7798ea392c0aeedb4`.
Formatted law-metadata.json SHA-256:
`098ed3007ff63ca34b63310f822b037fea3ee5fb3c1874351bbeb67c373b6dea`.
Repeat capture under PYTHONHASHSEED=57 compares byte-identical after formatting.

## Composition and ownership

One admitted call runs within a fresh Effect Scope. Its captured dependency
Context contains Clock, Digest, ChildProcessSpawner and shared native admission;
it contains no outer Scope. Pattern bytes, descriptors/name records, runtime
paths and the captured year ceiling are owned installation snapshots. The
existing descriptor copier is reused rather than adding another clone path.
Fingerprint/decoding failures are closed errors without source payload/cause.

Without an enclosing owner each call gets a fresh TextBudget. An installed
owner is reused; a larger owner ceiling is refused as incompatible with this
stage's policy. Context copies, worker preparation, captured slices, string
cleanup and numeric-year preparation all share the selected counter. A patch
is returned only after complete processing and scoped cleanup. A source no-match
is Option data; failure does not return a partially assigned citation.

The helper sets fullSpanEnd from the citation's span override plus m.end(),
assigns all six source metadata fields, and preserves the previous numeric year
when the raw year is absent. Present invalid years become None while retaining
the original raw year field. Parenthetical early-return behavior and source
native Unicode distinctions remain delegated to the qualified components.

## Validation and boundaries

Twenty-two focused tests pass across LawMetadata, RegexDescriptors, TextBudget
and MetadataYear. Ten law source cases compare through each actual runtime,
with exactly thirteen spawned and independently confirmed child exits per
runtime. Scope closure, frozen-year/pattern ownership, captured deadlines under
a disabled caller Clock, exact allocation and enclosing-budget refusal are
checked. Shared operation/native admission returns to zero after smoke replay.

For the nine-point unrelated text vector, the five-point citation token plus
four nine-point receiving/context copies require 41 parent text units. Limit
40 fails after one acknowledged law worker and publishes no patch; exactly 41
succeeds. Repeating the call starts a fresh owner. An enclosing limit-44 owner
already charged four units refuses the next receiving copy at 36 reserved units.
This is parent text accounting; transport/child memory and complete physical
memory proof remain separate obligations.

Quick server lint/source-and-test checks, scoped Oxlint, new-only Fallow and
both policy checks pass with no new findings, exception or reduced quality floor.
Full new-head hosted replay requires all 128 field updates and exactly 156
confirmed child exits per runtime, and remains pending. Journal/case metadata,
edition inference, extraction/document integration, remaining regex grammar,
family safety/scaling, public Layer and the full goal accounting remain open.
