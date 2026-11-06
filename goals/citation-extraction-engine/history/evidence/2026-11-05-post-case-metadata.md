# Full-case post-citation field processing

The private PostCaseMetadata adapter ports helpers.add_post_citation from the
pinned eyecite 2.7.6 source. It searches forward from index + 1 with the original
POST_FULL_CITATION_REGEX. Unlike the law/journal helpers, this source call permits
non-string tokens and stops only at paragraph tokens. The shared token-context
owner retains those built-in stringification, indexing and 300-point behaviors.

After a match, source order is preserved: full end, pin cleanup and conditional
raw pin end, extra whitespace stripping, parenthetical processing/full-end trim,
raw date fields and conditional numeric year, then conditional court lookup.
The pin end uses the complete raw pin's Python length, without right trimming.
Parenthetical trim subtracts native source points only when the processed value
is a string and full_span_end is truthy; a discarded year parenthetical does not
trigger this adjustment. A missing raw year retains the prior numeric year.
Missing/empty raw court and pin fields retain prior court/pin-end values, whereas
a truthy unrecognized court explicitly assigns None. Option fields distinguish
untouched state from None in the atomic patch; all positions remain unverified.

The complete FullCaseCitation.add_metadata method still must call name discovery,
pre-citation extraction, guess_court and superclass metadata in the original order
after this helper. This phase does not run those later phases early or claim that
the complete class method is finished.

## Shared owners and safety

The adapter uses the existing publication pattern authentication, Effect metadata
operation admission, captured Clock/deadline, fresh native Scope, context matcher,
typed worker and independently acknowledged child retirement. A fresh or captured
CitationTextBudget covers the full composed operation. Court lookup is installed
inside the invocation owner when needed and authenticates the same frozen table;
installation also authenticates it before accepting any helper call. Returned
methods have R = never, and no callable configuration enters raw requests.

The native metadata boundary loop now also serves frozen Python whitespace trim,
using existing Unicode 14 facts and source-native slices. It does not use the host
runtime's trim/Unicode version or coalesce literal surrogate words. Existing pin
cleanup and its right-trim details retain their behavior. A shared policy/config
decoder now serves journal and post-case installation, without another transport,
timer or scheduler. The shared test installer accepts an explicit pattern ceiling;
these tests supply the existing 8,192-unit policy because the raw pattern is 5,524
units and its wrappers are 5,529. Default 4,096-unit refusal remains unchanged.

The pin-only control reserves exactly 31 produced UTF-16 units. Thirty refuses
without partial output. An enclosing ceiling 34 primed with four units refuses
at cumulative usage 33. Mutating caller pattern/year bytes and court-table text
after installation cannot change subsequent output. A closed parent lifetime and
captured 997-ms extraction deadline both refuse before spawning a child.

## Source and target evidence

The producer requires clean oracle commit
04d82c032ad5fd0f9ab72a61c87110c46ee8f52e and tree
a35a58fac03400f71a93a93485b77f1d56f2b02f, Python 3.11.15 and
regex 2023.12.25 V0. It executes the original helper directly, wrapping real
search/match only to count calls. Existing authenticated capture-reuse profiles
supply the independently proved source bindings; the original compiled pattern's
group count/names are checked again. The exact law/year and court source fixtures
are authenticated separately. No original output is replaced with a stub.

The corpus retains 184 complete helper observations and 220 original regex calls.
It varies empty/no-match input, dates/courts, pins, parallel text, unbalanced/nested
parentheticals, prior values, zero/nonzero span ends, paragraph/non-string tokens,
long context and literal-surrogate versus supplementary-scalar words. Another 37
native whitespace observations include all 29 Python whitespace points, non-space
controls and native surrogate distinctions. Two producer runs under
PYTHONHASHSEED 211 and 223 are byte-identical.

Producer SHA-256:
d08b0e2c5f799b33891628bc62ce74860ba5377e0ae35854f694cf52444a3c88.
Raw source-pattern fingerprint:
173f538b2d3f8f2522eeb298388114e59bca173d00e03ac7f7b844f02c1be040.
Committed post-case-metadata.json is 317,362 bytes, SHA-256
cbaab9900587e97522d7a442326ae4604cbed97bc655204cf919baa996d6b48a.

Local replay compares 16 original helper cases through each actual Bun/Node
runtime and independently confirms 22 child exits per runtime. All 37 whitespace
observations compare locally. Twenty-one focused tests across post-case, metadata
strings, journal, pin extraction and pre-case fixtures pass across the scoped runs.
Full hosted replay requires all 184 source cases and 220 acknowledged exits per
runtime. It is wired into the existing integration lane and remains pending.
Scoped package lint/type checks, exact-file Oxlint, both policy ratchets and
new-only Fallow pass without introduced findings; normal publication hooks apply.

On previous head f31d1e594f the Vercel commit statuses explicitly report
"Deployment rate limited — retry in 24 hours." They are infrastructure limits,
not test failure diagnostics. GitHub verification remains separate; no green
latest-head or deployment claim is made. Broad local aggregate/head-install proof
remains deferred under the operator's hosted-first instruction.

Name/HTML helpers, complete case/supra/short assembly, references/parallel/filtering,
custom protocols, fresh-process None/date hashing, nullable iterator/repeated
capture semantics, 110 regex-family safety/scaling reviews, global engine budget
adoption, public service/Layer and complete accounting/coverage remain open. The
divergence audit still carries 11 representation laws, four fidelity questions
and 15 unfinished proof rows. No semantic waiver or completion claim is added.
