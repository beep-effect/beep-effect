# Positive lookahead for source journal matching

The pinned journal metadata regex uses PIN_CITE_REGEX's positive lookahead to
require ending punctuation, an opening parenthesis/bracket, or end of input.
The existing data-only grammar previously rejected this construct. It now
represents positive lookahead as a closed structural token, preserves balanced
structure/capture numbering, and lowers it through the existing native-point
alphabet. Raw pattern bytes, fingerprints and trusted descriptor admission stay
unchanged. Execution still belongs to the existing isolated Effect worker.

A lookahead consumes zero source points; captures inside it still participate
and contribute to repeated-capture profiles. The parser uses a noncapturing
outer group so a source-legal quantified assertion can be represented in native
Unicode regex syntax without adding a capture. Existing nullable optional
capture lowering remains active. Nullable multi-repetition remains unqualified
for execution, including the new a(?=b)* parser-only control. Nullable finditer
advancement is still open. Negative lookahead, lookbehind, word-boundary grammar
and remaining source features are not claimed by this change.

The original regex V0 parser consumes the character after '?' without verbose
space skipping for lookahead. The producer's '(? = a ) a' control is rejected by
both pinned engines. An initially over-permissive target header was corrected
against that observation; prior noncapturing/named verbose behavior is retained.

## Exact source evidence

probe-regex-lookahead.py verifies a clean eyecite 2.7.6 source checkout at
04d82c032ad5fd0f9ab72a61c87110c46ee8f52e, tree
a35a58fac03400f71a93a93485b77f1d56f2b02f, Python 3.11.15 and regex 2023.12.25 V0.
Seventeen patterns include raw POST_JOURNAL_CITATION_REGEX and the exact forward
and backward match_on_tokens wrappers. The original CPython parse tree and V0
AST independently supply capture names/counts, consumed width, repetition and
nullable profiles. Both actual engines supply 366 search/match/finditer
observations, including errors and currently unqualified routes. No descriptor
is generated from target compilation.

Producer SHA-256:
5c8c3cac2824fce2c5e6945ab3f9a57ebd2e42e3c0e319e9c18cff234d8ac6d9.
Formatted regex-lookahead.json SHA-256:
7fd24d7ff71257d1a563cb02aca1275337b08a52e327ce138cbe35c72908a971.
Regeneration under PYTHONHASHSEED=109 compares byte-identical after formatting.

## Verification boundary

Ten focused tests in three files compare all 34 original parser/profile
outcomes and run both actual runtimes. New lookahead smoke compares seventeen
evaluations per engine and runtime, hence 34 independently acknowledged child
exits per runtime. Complete captures include participating-empty groups and
capture spans beyond the consumed match. The raw journal pattern matches a
real pin/year input through both source-engine profiles. Existing verbose and
context-matcher regression tests also pass.

Full hosted replay requires 151 eligible evaluations per engine, or 302
acknowledged exits per runtime. Source observations for nullable finditer and
nullable multi-repeat remain recorded but are not substituted into those
execution counts. Full hosted proof and family safety/scaling remain pending;
no approval among the 110 unfinished regex family reviews is inferred.

Scoped package lint/type checks, Oxlint, both policy checks, deterministic
regeneration and new-only Fallow are checked for this wave. Replay helpers and
capture assertions are shared with the existing verbose fixtures; the one new
complexity finding was removed by reuse, and an unused helper export was made
private. No policy exception, lowered floor or semantic waiver is introduced.
Broad local aggregate verification and head-install preflight are deferred
under the operator's hosted-CI instruction. Journal field assignment/superclass
composition, corrected rendering, other metadata, the public engine/Layer and
exhaustive goal acceptance remain open.
