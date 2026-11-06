# Original HTML-to-plain case-name selection

The private CaseNameSelection stage connects the actual built-in caller rule:
with markup, run HTML naming first and run plain naming only if the selected
metadata field is None. Full citations select defendant; short citations select
antecedent_guess. An empty assignment and a retained empty field both suppress
fallback. Without markup, plain naming runs regardless of the initial field.
HTML assignments precede and survive fallback unless the plain helper replaces
them. The six-field patch retains native text, numeric year and span ownership.

The stage reuses the existing HTML and plain helpers and metadata factory. It
acquires operation admission once and retains one Scope, captured deadline and
text authority across both helpers. Existing Effect ownership, process admission,
RPC, physical retirement, Schema decoding and word-count preflight do the shared
work. The enclosing caller supplies the actual pre-name field and optional
prepared geometry as schema data. The extract method requires R=never. There is
no new transport, scheduler or callback-bearing request.

## Direct original caller evidence

The producer invokes FullCaseCitation.add_metadata and the original
_extract_shortform_citation. It uses actual Document initialization and default
tokenization, original metadata/court/edition processing, and wrappers around the
two original name helpers solely to observe their before/after state and order.
It does not reconstruct the fallback decision. Regex observations are restricted
to the reached name helpers. Complete final model snapshots are recorded
separately and do not establish target parity for the surrounding phases.

Thirty-two templates from the sealed HTML helper corpus plus two explicit empty
name controls are crossed with full/short and markup/plain modes. Full citations
also exercise None, empty and nonempty prior defendant fields. There are 272
calls over 68 distinct document data records: 136 use HTML, 157 use plain and
2,621 regex calls execute during naming. Deduplication shares serialized input
data, not source Document object identity. Original calls each construct their
own Document.

The unchanged oracle is eyecite 2.7.6 at
04d82c032ad5fd0f9ab72a61c87110c46ee8f52e, tree
a35a58fac03400f71a93a93485b77f1d56f2b02f. CPython 3.11.15, regex 2023.12.25,
lxml 5.1.0 and fast-diff-match-patch 2.0.1 are recorded with complete source,
license, dependency and formatter identities. Two hash-seed exports are
byte-identical. The portable verifier passes seven corruption controls and exact
pinned-oracle replay. This verifier is source evidence, not a target parity claim.

- Producer SHA-256: d4526db5c87f0343d50f08872871ae435761ca5c939b379b36e988b10651f015
- Corpus SHA-256: 20690a9a72d7206b50c8f039edd5fe531262d3bf079035c8fcb2367e6aadb29b
- Original HTML dependency SHA-256: e6231633d7a3d4115295517539aecda42045ce2a8253f565f9db86dacfcf1670

## Target evidence and limits

The eight-case smoke covers plain-only, full/short HTML, actual HTML-to-plain
fallback, newly assigned empty names and retained empty/nonempty names. Both Bun
and Node pass and independently confirm exactly 71 physical child exits per
runtime. Each complete geometry preparation contributes four children; each
original name regex call contributes one. The smoke compares all metadata,
year, full-span start, original span/end preservation and both helper decisions.
Shared patch assertions and source/configuration loaders reuse existing fixtures.

The first smoke correctly refused the fixture's too-small default pattern
allowance. The fixture now uses the scanner's existing 8,192-unit source-pattern
allowance and a controlled extraction clock for semantic replay, following the
existing plain/processing fixtures. Production limits and deadline behavior are
unchanged. Both smoke tests then pass in 16.45 seconds. Package lint and source/
test checks pass (0.4/3.1 seconds).

The final shared-fixture regression passes all nine tests across HTML naming,
plain naming and the selector in 21.05 seconds. The divergence audit retains
eleven representation laws, four fidelity questions and fifteen unfinished proof
rows with no semantic waiver.

Full hosted integration is registered for all 272 callers on both runtimes and
must independently confirm 3,165 physical children per runtime. It remains
pending. Fallow Advisory Envelopes passes on the previously published cc6bacb592
head; that is not exact-head proof for this new wave. Broad local gates remain
skipped under the operator's hosted-first direction.

## Remaining full goal

This connects built-in name selection only. Full post/name/pre/court/edition
ordering, general host/alias/model mutation, exception translation, source
both-supplied/no-map states, builtin difflib and final extraction/resolution
remain required. Whole-engine allocation/scaling, public semantic codecs/service/
Layer, exhaustive source/donor accounting, reflection and lifecycle closeout are
unchanged. All eleven representation laws, four fidelity questions and fifteen
unfinished proof rows remain open. No baseline, suppression, ceiling, semantic
waiver or acceptance requirement changes.

Linked continuation of PRs #2511, #2713, #2725 and #2737 under the approved
linked-follow-up publication exception.
