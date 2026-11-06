# Initialized backward case-name scan and source word boundaries

The private CaseNameScan adapter executes the default-initialized source
_scan_for_case_boundaries path. It returns all eight state fields with the selected
v token represented by its input word slot. It preserves None versus an empty
native candidate, negative Python slice starts, all offset/counter updates and
the source's branch order. State is invocation-local Effect Ref data, not a
verified mention or a persisted identity. Arbitrary externally supplied state
dicts, subclasses/protocols and concurrent external word mutation remain open.

Source BACKWARD_SEEK is 28, but the exclusive range endpoint visits at most 27
preceding words. Offset includes commas; case_name_length does not. Plaintiff
length updates precede citation-token skipping. Citation tokens move the title
boundary before punctuation checks; paragraph tokens do not stop this helper.
Year prefixes precede opening-parenthesis handling. Lowercase-after-v precedes
placeholder/v-token handling, and lowercase-without-v precedes the beginning-of-
text fallback. Stop-word keys are read only by the corresponding branch, with
missing keys, invalid token lengths and empty-word indexing mapped to closed
source-free failures. No partial state is returned on failure.

Five fixed source regex patterns use the existing typed worker, rather than a
second matcher or native approximation. Native joins/slices retain source points,
including supplementary scalars versus literal surrogate pairs. Frozen Python
alpha/lower predicates inspect the native second point after an opening paren;
the display projection cannot replace that access.

## Shared compiler boundary support

The source scanner exposed the compiler's previously unsupported word boundaries.
The existing structural grammar now carries boundary/non-boundary atom references
to the exact captured source-engine word set. Rendering uses bounded one-cell
lookbehind/lookahead on the existing one-unit-per-Python-point alphabet. Generated
assertions add no capturing groups and do not change source capture numbering.
Their complete output length is measured before construction under the existing
pattern ceiling. This does not enable arbitrary source lookbehind syntax.

CPython 3.11 re and regex 2023.12.25 V0 remain distinct: CPython non-boundary does
not match globally empty input, whereas V0 does. Combining marks and source word
classes retain their different engine behavior. Inside a class, backslash-b is
still backspace and backslash-B is rejected. CPython rejects direct quantified
boundaries; V0's parser accepts them, with repeated/nullable execution refusals
retained by the existing worker profile gate. Nullable finditer remains open.

Two-boundary patterns expand beyond the default 4,096-unit policy. Tests explicitly
provide the existing 8,192-unit policy; no default or absolute ceiling is raised.
A dedicated default-policy test confirms patternUtf16 failure with all four
already launched children independently acknowledged. Generic raw pattern and
family safety/scaling acceptance remain separate obligations.

## Effect ownership and allocation proof

The adapter reuses the existing metadata operation's captured Clock, operation
admission, fresh native Scope, typed RPC, process containment and acknowledged
retirement. All five patterns/descriptors are snapshotted and authenticated once
at installation. Each scan creates fresh Ref state and shares a fresh or captured
CitationTextBudget across receiving, concatenation, regex preparation and slicing.
Returned scan methods have R = never. No worker, transport, scheduler or lock
implementation is added.

The simple Foo control reserves exactly 22 UTF-16 units. Ceiling 21 refuses before
the fourth regex launch, after three confirmed exits. Enclosing ceiling 25 primed
with four units refuses at usage 23. Mutating caller pattern buffers after
installation leaves subsequent output unchanged. Closed parent lifetime and a
captured 997-ms extraction deadline refuse before native child creation. Shared
test assertions and the existing regex-family replay helper now cover boundary
and capture-reuse families together, retaining their exact expected exit counts.

## Source and target evidence

Both producers require a clean oracle at commit
04d82c032ad5fd0f9ab72a61c87110c46ee8f52e, tree
a35a58fac03400f71a93a93485b77f1d56f2b02f, Python 3.11.15 and
regex 2023.12.25 V0. The scan producer calls the original initializer and helper,
asserts the helper returns the same source state dict, retains every state field
and error, and wraps real regex methods only to record calls. Source token objects
and their actual str/len behavior remain in place. Scan corpus: 64 cases, 313 regex
calls and eight source failures. Local replay covers 24 cases, including all
failures and no-call paths, with 25 acknowledged exits per actual Bun/Node runtime.
Full hosted replay is registered for all 64 cases / 313 exits per runtime.

Boundary corpus: 17 patterns, 34 original parse/profile outcomes and 2,199 matching-
mode observations. Every profile is checked locally. Each actual runtime confirms
72 smoke exits: 33 admitted CPython calls plus one profile refusal, and 35 admitted
V0 calls plus three profile refusals. Complete hosted replay requires 838 CPython
and 890 V0 exits, totaling 1,728 per runtime. Nullable iterator advancement and
repeated-capture execution remain explicitly unqualified.

| Artifact | SHA-256 |
| --- | --- |
| Scan producer | fe4ef0ed1dffbe13a40f6319c44e99cf7374c07b1664be2c9945f4ca1fe08be7 |
| case-name-scan.json | 9731078b964f5daa0c075b630a5fa236efe06cb297c123f45f39a637bbac9553 |
| Boundary producer | 07ddb05961d379a1d1915014191161b03d1016d2d0d0a401ad7c7879d7a0f51a |
| regex-boundaries.json | 5bf0097c3d3b36afa4e5137e2acaa9ccd2366ec966a3b084b9133add15a7e5ae |

Independent scan runs with PYTHONHASHSEED 281/283 and boundary runs with 271/293
are byte-identical before standard formatting. Twenty-five focused tests across
five files pass, including capture-reuse, compiler and pin-extraction regressions.
Scoped package lint/type checks, Oxlint, both policy ratchets, schema-tag idioms
and new-only Fallow pass with zero introduced findings. Normal publication hooks
apply. Broad local aggregate/head-install proof
remains deferred to hosted CI under the operator's instruction.

On preceding head 4d2b6b0935, hosted Heavy / Lint Policy job 127607578795 in
run 42130156286 ended with the self-hosted-runner-lost-communication annotation.
Its verification step remained in_progress in the terminal job record; no
completed failing source check was reported. The log endpoint returns BlobNotFound.
This is retained infrastructure evidence, not a source-green claim or a speculative
CPU/memory attribution. Fresh hosted validation is required on the next head.

Candidate processing/stop-word cleanup, HTML name discovery and complete full-case
method composition remain open. General custom protocols, fresh-process hash
paths, nullable/repeated regex semantics, 110 family safety reviews, global budget
adoption, public service/Layer, exhaustive accounting/coverage and lifecycle proof
remain open. The divergence audit still has 11 representation laws, four fidelity
questions and 15 unfinished proof rows. No semantic waiver or completion claim
is introduced by these focused source comparisons.
