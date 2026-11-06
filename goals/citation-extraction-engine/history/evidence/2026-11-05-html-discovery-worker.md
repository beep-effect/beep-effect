# Owned HTML placeholder and emphasis discovery

Continuation of PR #2737. This implements the original discovery stage and does
not complete HTML names, bidirectional document composition, full family
qualification or the public citation engine.

## Finite lowering, including a rejected candidate

The original emphasis pattern captures only `em` or `i` and compares that
captured spelling in its closing backreference under CPython IGNORECASE/DOTALL.
The existing compiler intentionally excludes general identity-sensitive
backreferences and DOTALL. A fixed, authenticated finite lowering uses three
alternatives in the existing engine. Each alternative captures only its inner
markup, and `\s` union `\S` covers all source points without adding a flag.

An initial two-branch ignore-case candidate was rejected: `<i>x</ı>` fails in
the original but succeeds in that candidate. CPython's literal ignore-case set
and closing backreference equality are distinct. The corrected lowering keeps
`i`, `I`, `İ` together and `ı` separate using scoped case-off sets. The `em`
alternative retains the original ignore-case literals. Branches have disjoint
opening spellings, so the original leftmost/lazy search and nonoverlapping
iteration remain owned by one regex invocation rather than merged scans.

`ops/probe-html-discovery-patterns.py` compares exact whole-match and raw inner
capture positions against the original over all 250 sealed source cases and
41,371 exhaustive token sequences of length zero through four. It retains the
failed simple candidate as a negative assertion. It separately calls the actual
Document method and placeholder function on every source case. The fixture
records fixed native programs, independent CPython group/name/minimum-width
profiles and a digest of every exhaustive sequence/expected result. Two hash
seeds reproduce the fixture byte for byte.

Pattern fixture SHA-256:
83243d56a65e6f9d94602ea3922fc3b9ddbcb895096600223e37b91cbcc847fc.
The original 250-case fixture is unchanged. This finite lowering supplies no
arbitrary backreference support and grants no new general source flag.

## Existing ownership and native text operations

`HtmlDiscovery.ts` uses the existing metadata-stage owner: captured Clock,
operation admission, optional enclosing text budget, child-process services and
fresh per-call Scope. Its method has R=never. Configuration copies/authenticates
the fixed native patterns; the existing descriptor registry compares profiles
with a fresh compiler before each worker call.

The placeholder job runs the original pattern. Its complete capture table drives
native range concatenation: retain angle brackets and optional slash, replace
only the original masked positions with X. A single bounded X buffer is measured
and charged before allocation. Existing two-pass native concatenation reserves
the exact canonical output before allocating it; no UTF-16 text projection or
JavaScript replacement template is used. Traversal is linear in source points
and complete matches, excluding the independently bounded regex evaluation.

The emphasis job runs on the owned original markup, selects exactly one of the
three body captures, strips with the existing frozen CPython whitespace
predicate/boundary visitor and copies through the existing reserved native slice.
Output uses the existing emphasis schema, retaining original whole-match bounds.
Token count is checked before growing the result list. Both actual children must
retire independently before any discovery result publishes. There is no new
matcher, scheduler, framing, timer, transport or retirement implementation.

## Passed and pending proof

Three local focused tests pass in 18.86 seconds. The source smoke replays 16
observations in each runtime, proving 32 actual children and independently
confirmed exits per runtime. It includes the dotless-I negative controls,
malformed markup, NUL/native surrogate controls and stripping. Ownership controls
prove that mutating installation input cannot replace captured programs and that
effective text refusal spawns no child. A compile-time assignment proves the
method's R=never while preserving its inferred closed error channel.

Package lint, source and test type checks pass. Initial branded configuration
and test annotation diagnostics were corrected using the schema constructor and
the inferred closed error type; no rule or safety ceiling was relaxed.

Hosted integration requires every one of the 250 source observations in each
runtime, with 500 confirmed exits per runtime. This full replay is pending and
must not be inferred from the local smoke or the CPython lowering comparison.
Whole-family adversarial/scaling evidence, whole-engine budgets, HTML names,
document geometry composition, builtin difflib, exhaustive accounting and every
remaining goal acceptance requirement stay open.
